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
	private metadataManager: MetadataManager;
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

			// Calculate content hash
			const contentHash = await this.folderParser.calculateFolderHash(folder);

			// Save metadata
			await this.metadataManager.writeMetadata(folder, {
				googleDocId: doc.documentId,
				lastSyncTime: new Date().toISOString(),
				folderPath: folder.path,
				contentHash,
				revisionId: doc.revisionId,
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

			// Get current local and remote content
			const localHash = await this.folderParser.calculateFolderHash(folder);
			const remoteDoc = await this.api.getDocument(metadata.googleDocId);

			const localChanged = localHash !== metadata.contentHash;
			const remoteChanged = remoteDoc.revisionId !== metadata.revisionId;

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
				return await this.pushToRemote(folder, metadata);
			} else {
				return await this.pullFromRemote(folder, remoteDoc);
			}
		} catch (error) {
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

			await this.metadataManager.writeMetadata(folder, {
				...metadata,
				lastSyncTime: new Date().toISOString(),
				contentHash: newHash,
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
	private async pullFromRemote(folder: TFolder, remoteDoc: GoogleDoc): Promise<SyncResult> {
		try {
			const structure = this.gdocToMd.extractStructure(remoteDoc);
			await this.updateLocalFiles(folder, structure);

			// Update metadata
			const newHash = await this.folderParser.calculateFolderHash(folder);
			const metadata = await this.metadataManager.readMetadata(folder);

			if (metadata) {
				await this.metadataManager.writeMetadata(folder, {
					...metadata,
					lastSyncTime: new Date().toISOString(),
					contentHash: newHash,
					revisionId: remoteDoc.revisionId,
				});
			}

			return {
				success: true,
				message: 'Pulled changes from Google Docs',
				documentId: remoteDoc.documentId,
				documentUrl: this.api?.getDocumentUrl(remoteDoc.documentId),
			};
		} catch (error) {
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
		for (const section of structure) {
			if (section.content) {
				const fileName = `${section.title}.md`;
				const filePath = `${folder.path}/${fileName}`;
				const file = this.vault.getAbstractFileByPath(filePath);

				if (file && file instanceof TFile) {
					await this.vault.modify(file, section.content);
				} else {
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
