import { TFolder, Vault, TFile } from 'obsidian';
import { SyncResult, GoogleDocsSettings, GoogleDoc, FolderNode, SyncMetadata } from '../types';
import { GoogleDocsAPI } from '../google/api';
import { OAuth2Manager } from '../google/oauth';
import { MetadataManager } from './metadata-manager';
import { FolderParser } from './folder-parser';
import { MarkdownToGoogleDocsConverter } from '../converters/markdown-to-gdoc';
import { GoogleDocsToMarkdownConverter } from '../converters/gdoc-to-markdown';
import { ConflictResolver } from './conflict-resolver';

/**
 * Main sync engine for bidirectional sync between Obsidian and Google Docs
 */
export class SyncEngine {
	private api: GoogleDocsAPI | null = null;
	private oauth: OAuth2Manager | null = null;
	public metadataManager: MetadataManager; // Public for access from commands
	private folderParser: FolderParser;
	private mdToGdoc: MarkdownToGoogleDocsConverter | null = null;
	private gdocToMd: GoogleDocsToMarkdownConverter;
	private conflictResolver: ConflictResolver;

	constructor(
		private vault: Vault,
		private settings: GoogleDocsSettings
	) {
		this.metadataManager = new MetadataManager(vault);
		this.folderParser = new FolderParser(vault);
		this.gdocToMd = new GoogleDocsToMarkdownConverter();
		this.conflictResolver = new ConflictResolver();

		// Initialize API if we have credentials
		this.initializeAPI();
	}

	/**
	 * Initialize or reinitialize the API client
	 */
	private async initializeAPI(): Promise<void> {
		if (this.settings.clientId && this.settings.clientSecret) {
			this.oauth = new OAuth2Manager(this.settings.clientId, this.settings.clientSecret);

			if (this.settings.refreshToken && this.settings.accessToken) {
				// Get or refresh access token
				const token = await this.oauth.getValidAccessToken(
					this.settings.accessToken,
					this.settings.refreshToken
				);
				this.settings.accessToken = token;

				this.api = new GoogleDocsAPI(token.accessToken);
				this.mdToGdoc = new MarkdownToGoogleDocsConverter(this.api);
			}
		}
	}

	/**
	 * Update settings (when they change in the UI)
	 */
	async updateSettings(settings: GoogleDocsSettings): Promise<void> {
		this.settings = settings;
		await this.initializeAPI();
	}

	/**
	 * Get OAuth manager instance for use in settings
	 */
	getOAuthManager(): OAuth2Manager | null {
		return this.oauth;
	}

	/**
	 * Validate credentials by making a test request
	 */
	async validateCredentials(): Promise<boolean> {
		try {
			await this.ensureValidToken();
			if (!this.api) {
				return false;
			}
			return await this.api.validateToken();
		} catch (error) {
			console.error('Credential validation error:', error);
			return false;
		}
	}

	/**
	 * Ensure we have a fresh access token before making API calls
	 */
	private async ensureValidToken(): Promise<void> {
		if (!this.oauth || !this.settings.refreshToken) {
			throw new Error('Not authenticated. Please complete OAuth setup in settings.');
		}

		const token = await this.oauth.getValidAccessToken(
			this.settings.accessToken,
			this.settings.refreshToken
		);
		this.settings.accessToken = token;

		if (this.api) {
			this.api.setAccessToken(token.accessToken);
		} else {
			this.api = new GoogleDocsAPI(token.accessToken);
			this.mdToGdoc = new MarkdownToGoogleDocsConverter(this.api);
		}
	}

	/**
	 * Sync a folder with Google Docs (bidirectional)
	 */
	async syncFolder(folder: TFolder): Promise<SyncResult> {
		try {
			await this.ensureValidToken();

			if (!this.api || !this.mdToGdoc) {
				throw new Error('API not initialized');
			}

			// Check if folder already has metadata (existing sync)
			const hasMetadata = await this.metadataManager.hasMetadata(folder);

			if (hasMetadata) {
				return await this.syncExisting(folder);
			} else {
				return await this.syncNew(folder);
			}
		} catch (error) {
			console.error('Sync error:', error);
			return {
				success: false,
				message: 'Sync failed',
				error: error.message,
			};
		}
	}

	/**
	 * Create a new Google Doc and initial sync
	 */
	private async syncNew(folder: TFolder): Promise<SyncResult> {
		if (!this.api || !this.mdToGdoc) {
			throw new Error('API not initialized');
		}

		try {
			// Parse folder structure
			const folderTree = await this.folderParser.parseFolder(folder);

			// Create Google Doc
			const doc = await this.api.createDocument(folder.name);

			// Convert and upload content
			await this.mdToGdoc.convertToGoogleDocs(folderTree, doc.documentId);

			// Calculate content hashes
			const contentHash = await this.folderParser.calculateFolderHash(folder);
			const updatedDoc = await this.api.getDocument(doc.documentId);
			const remoteContent = this.gdocToMd.convertToMarkdown(updatedDoc);
			const remoteHash = this.folderParser.calculateContentHash(remoteContent);

			// Save metadata
			await this.metadataManager.writeMetadata(folder, {
				googleDocId: doc.documentId,
				lastSyncTime: new Date().toISOString(),
				folderPath: folder.path,
				contentHash,
				remoteContentHash: remoteHash,
				revisionId: updatedDoc.revisionId,
			});

			return {
				success: true,
				message: `Created and synced "${folder.name}"`,
				documentId: doc.documentId,
				documentUrl: this.api.getDocumentUrl(doc.documentId),
			};
		} catch (error) {
			throw new Error(`Failed to create new sync: ${error.message}`);
		}
	}

	/**
	 * Sync an existing Google Doc (bidirectional)
	 */
	private async syncExisting(folder: TFolder): Promise<SyncResult> {
		if (!this.api || !this.mdToGdoc) {
			throw new Error('API not initialized');
		}

		try {
			const metadata = await this.metadataManager.readMetadata(folder);
			if (!metadata) {
				throw new Error('Metadata not found');
			}

			console.log('Syncing existing folder:', folder.path);
			console.log('Metadata:', metadata);

			// Get current local and remote content
			const localHash = await this.folderParser.calculateFolderHash(folder);
			const remoteDoc = await this.api.getDocument(metadata.googleDocId);
			
			// Calculate hash of remote content to detect changes
			const remoteContent = this.gdocToMd.convertToMarkdown(remoteDoc);
			const remoteHash = this.folderParser.calculateContentHash(remoteContent);

			console.log('Local hash:', localHash);
			console.log('Stored hash:', metadata.contentHash);
			console.log('Remote hash:', remoteHash);
			console.log('Remote revision:', remoteDoc.revisionId);
			console.log('Stored revision:', metadata.revisionId);

			const localChanged = localHash !== metadata.contentHash;
			// Check both revision ID and content hash for remote changes
			const remoteChanged = 
				remoteDoc.revisionId !== metadata.revisionId ||
				!metadata.remoteContentHash ||
				remoteHash !== metadata.remoteContentHash;

			console.log('Local changed:', localChanged);
			console.log('Remote changed:', remoteChanged);

			if (!localChanged && !remoteChanged) {
				return {
					success: true,
					message: 'Already up to date',
					documentId: metadata.googleDocId,
					documentUrl: this.api.getDocumentUrl(metadata.googleDocId),
				};
			}

			// Handle conflicts
			if (localChanged && remoteChanged) {
				return await this.handleConflict(folder, metadata, remoteDoc);
			}

			// One-way sync
			if (localChanged) {
				console.log('Pushing local changes to remote');
				return await this.pushToRemote(folder, metadata);
			} else {
				console.log('Pulling remote changes to local');
				return await this.pullFromRemote(folder, remoteDoc, metadata, remoteHash);
			}
		} catch (error) {
			console.error('Sync existing error:', error);
			throw new Error(`Failed to sync existing: ${error.message}`);
		}
	}

	/**
	 * Push local changes to Google Docs
	 */
	private async pushToRemote(folder: TFolder, metadata: SyncMetadata): Promise<SyncResult> {
		if (!this.api || !this.mdToGdoc) {
			throw new Error('API not initialized');
		}

		try {
			const folderTree = await this.folderParser.parseFolder(folder);

			// Clear and rewrite the document
			await this.api.clearDocument(metadata.googleDocId);
			await this.mdToGdoc.convertToGoogleDocs(folderTree, metadata.googleDocId);

			// Update metadata
			const newHash = await this.folderParser.calculateFolderHash(folder);
			const updatedDoc = await this.api.getDocument(metadata.googleDocId);
			
			// Calculate hash of the remote content we just pushed
			const remoteContent = this.gdocToMd.convertToMarkdown(updatedDoc);
			const remoteHash = this.folderParser.calculateContentHash(remoteContent);

			await this.metadataManager.writeMetadata(folder, {
				...metadata,
				lastSyncTime: new Date().toISOString(),
				contentHash: newHash,
				remoteContentHash: remoteHash,
				revisionId: updatedDoc.revisionId,
			});

			return {
				success: true,
				message: 'Pushed local changes to Google Docs',
				documentId: metadata.googleDocId,
				documentUrl: this.api.getDocumentUrl(metadata.googleDocId),
			};
		} catch (error) {
			throw new Error(`Failed to push to remote: ${error.message}`);
		}
	}

	/**
	 * Pull remote changes from Google Docs
	 */
	private async pullFromRemote(
		folder: TFolder,
		remoteDoc: GoogleDoc,
		metadata: SyncMetadata,
		remoteHash: string
	): Promise<SyncResult> {
		try {
			console.log('Pulling from remote, document ID:', remoteDoc.documentId);
			
			const structure = this.gdocToMd.extractStructure(remoteDoc);
			console.log('Extracted structure:', structure);
			
			await this.updateLocalFiles(folder, structure);

			// Update metadata with both local and remote hashes
			const newLocalHash = await this.folderParser.calculateFolderHash(folder);

			await this.metadataManager.writeMetadata(folder, {
				...metadata,
				lastSyncTime: new Date().toISOString(),
				contentHash: newLocalHash,
				remoteContentHash: remoteHash,
				revisionId: remoteDoc.revisionId,
			});

			return {
				success: true,
				message: 'Pulled changes from Google Docs',
				documentId: remoteDoc.documentId,
				documentUrl: this.api?.getDocumentUrl(remoteDoc.documentId),
			};
		} catch (error) {
			console.error('Pull from remote error:', error);
			throw new Error(`Failed to pull from remote: ${error.message}`);
		}
	}

	/**
	 * Update local files based on Google Docs structure
	 */
	private async updateLocalFiles(
		folder: TFolder,
		structure: Array<{ level: number; title: string; content: string }>
	): Promise<void> {
		console.log('Updating local files with structure:', structure);
		
		for (const section of structure) {
			// Only process level 2+ headings (level 1 is the folder itself)
			if (section.level >= 2 && section.content) {
				const fileName = `${section.title}.md`;
				const filePath = `${folder.path}/${fileName}`;
				
				console.log(`Processing section: ${section.title} (level ${section.level})`);
				console.log(`File path: ${filePath}`);
				console.log(`Content length: ${section.content.length}`);
				
				const file = this.vault.getAbstractFileByPath(filePath);

				if (file && file instanceof TFile) {
					console.log(`Modifying existing file: ${filePath}`);
					await this.vault.modify(file, section.content);
				} else {
					console.log(`Creating new file: ${filePath}`);
					await this.vault.create(filePath, section.content);
				}
			}
		}
	}

	/**
	 * Handle sync conflicts
	 */
	private async handleConflict(
		folder: TFolder,
		metadata: SyncMetadata,
		remoteDoc: GoogleDoc
	): Promise<SyncResult> {
		// For now, return a conflict result
		// In the future, this should trigger the conflict resolution UI
		const localTree = await this.folderParser.parseFolder(folder);
		const remoteStructure = this.gdocToMd.extractStructure(remoteDoc);

		return {
			success: false,
			message: 'Conflict detected: both local and remote have changes',
			documentId: metadata.googleDocId,
			documentUrl: this.api?.getDocumentUrl(metadata.googleDocId),
			conflicts: [
				{
					type: 'content',
					localVersion: this.serializeFolderTree(localTree),
					remoteVersion: JSON.stringify(remoteStructure, null, 2),
					description: 'Both local and remote content have changed since last sync',
				},
			],
		};
	}

	/**
	 * Serialize folder tree for conflict comparison
	 */
	private serializeFolderTree(tree: FolderNode): string {
		return JSON.stringify(tree, null, 2);
	}
}
