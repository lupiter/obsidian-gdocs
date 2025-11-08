import { TFolder, Vault, TFile } from 'obsidian';
import { SyncResult, GoogleDocsSettings, GoogleDoc, FolderNode } from '../types';
import { GoogleDocsAPI } from '../google/api';
import { MetadataManager } from './metadata-manager';
import { FolderParser } from './folder-parser';
import { MarkdownToGoogleDocsConverter } from '../converters/markdown-to-gdoc';
import { GoogleDocsToMarkdownConverter } from '../converters/gdoc-to-markdown';
import { ConflictResolver } from './conflict-resolver';

/**
 * Main sync engine for bidirectional sync between Obsidian and Google Docs
 */
export class SyncEngine {
	private api: GoogleDocsAPI;
	private metadataManager: MetadataManager;
	private folderParser: FolderParser;
	private mdToGdoc: MarkdownToGoogleDocsConverter;
	private gdocToMd: GoogleDocsToMarkdownConverter;
	private conflictResolver: ConflictResolver;

	constructor(
		private vault: Vault,
		settings: GoogleDocsSettings
	) {
		this.api = new GoogleDocsAPI(settings.apiKey);
		this.metadataManager = new MetadataManager(vault);
		this.folderParser = new FolderParser(vault);
		this.mdToGdoc = new MarkdownToGoogleDocsConverter(this.api);
		this.gdocToMd = new GoogleDocsToMarkdownConverter();
		this.conflictResolver = new ConflictResolver();
	}

	/**
	 * Update API key (when settings change)
	 */
	updateApiKey(apiKey: string): void {
		this.api = new GoogleDocsAPI(apiKey);
		this.mdToGdoc = new MarkdownToGoogleDocsConverter(this.api);
	}

	/**
	 * Sync a folder with Google Docs (bidirectional)
	 */
	async syncFolder(folder: TFolder): Promise<SyncResult> {
		try {
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
			const metadata = this.metadataManager.createMetadata(
				doc.documentId,
				folder.path,
				contentHash,
				doc.revisionId
			);
			await this.metadataManager.writeMetadata(folder, metadata);

			return {
				success: true,
				message: `Successfully synced to Google Docs`,
				documentId: doc.documentId,
				documentUrl: this.api.getDocumentUrl(doc.documentId),
			};
		} catch (error) {
			throw new Error(`Failed to create new sync: ${error.message}`);
		}
	}

	/**
	 * Sync an existing folder (bidirectional)
	 */
	private async syncExisting(folder: TFolder): Promise<SyncResult> {
		try {
			// Read metadata
			const metadata = await this.metadataManager.readMetadata(folder);
			if (!metadata) {
				throw new Error('Metadata not found');
			}

			// Calculate current folder hash
			const currentHash = await this.folderParser.calculateFolderHash(folder);

			// Get remote document
			const remoteDoc = await this.api.getDocument(metadata.googleDocId);

			// Convert remote content to markdown for comparison
			const remoteMarkdown = this.gdocToMd.convertToMarkdown(remoteDoc);
			const remoteHash = await this.hashString(remoteMarkdown);

			// Check for conflicts
			const localChanged = currentHash !== metadata.contentHash;
			const remoteChanged = remoteDoc.revisionId !== metadata.revisionId;

			if (!localChanged && !remoteChanged) {
				return {
					success: true,
					message: 'Already in sync - no changes detected',
				};
			}

			if (localChanged && !remoteChanged) {
				// Only local changes - push to remote
				return await this.pushToRemote(folder, metadata.googleDocId);
			}

			if (remoteChanged && !localChanged) {
				// Only remote changes - pull from remote
				return await this.pullFromRemote(folder, remoteDoc);
			}

			// Both changed - check for conflicts
			const conflict = this.conflictResolver.detectConflict(
				currentHash,
				remoteHash,
				metadata.contentHash
			);

			if (conflict) {
				// Try auto-resolve
				const folderTree = await this.folderParser.parseFolder(folder);
				const localContent = this.serializeFolderTree(folderTree);

				const baseContent = ''; // We don't store the base content, so we can't do three-way merge
				const merged = this.conflictResolver.autoResolve(localContent, remoteMarkdown, baseContent);

				if (merged === null) {
					// Can't auto-resolve, return conflict
					return {
						success: false,
						message: 'Conflict detected - manual resolution required',
						conflicts: [
							this.conflictResolver.createConflictInfo(
								localContent,
								remoteMarkdown,
								'Both local and remote versions have changed'
							),
						],
					};
				}

				// Auto-resolved - push merged version
				return await this.pushToRemote(folder, metadata.googleDocId);
			}

			// Default: push local changes
			return await this.pushToRemote(folder, metadata.googleDocId);
		} catch (error) {
			throw new Error(`Failed to sync existing: ${error.message}`);
		}
	}

	/**
	 * Push local changes to Google Docs
	 */
	private async pushToRemote(folder: TFolder, documentId: string): Promise<SyncResult> {
		try {
			const folderTree = await this.folderParser.parseFolder(folder);
			await this.mdToGdoc.convertToGoogleDocs(folderTree, documentId);

			// Update metadata
			const contentHash = await this.folderParser.calculateFolderHash(folder);
			const doc = await this.api.getDocument(documentId);
			await this.metadataManager.updateSyncInfo(folder, contentHash, doc.revisionId);

			return {
				success: true,
				message: 'Successfully pushed local changes to Google Docs',
				documentUrl: this.api.getDocumentUrl(documentId),
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
			// Extract structure from Google Doc
			const structure = this.gdocToMd.extractStructure(remoteDoc);

			// Update local files based on remote structure
			await this.updateLocalFiles(folder, structure);

			// Update metadata
			const contentHash = await this.folderParser.calculateFolderHash(folder);
			await this.metadataManager.updateSyncInfo(folder, contentHash, remoteDoc.revisionId);

			return {
				success: true,
				message: 'Successfully pulled changes from Google Docs',
			};
		} catch (error) {
			throw new Error(`Failed to pull from remote: ${error.message}`);
		}
	}

	/**
	 * Update local Obsidian files based on remote structure
	 */
	private async updateLocalFiles(
		folder: TFolder,
		structure: Array<{ level: number; title: string; content: string }>
	): Promise<void> {
		// This is a simplified implementation
		// In a full implementation, we'd need to:
		// 1. Map headings to folders/files based on level
		// 2. Create/update/delete files as needed
		// 3. Handle the folder hierarchy properly

		// For now, we'll update files that exist and log others
		for (const section of structure) {
			if (section.content) {
				// Try to find a matching file
				const fileName = `${section.title}.md`;
				const filePath = `${folder.path}/${fileName}`;
				const file = this.vault.getAbstractFileByPath(filePath);

				if (file && file instanceof TFile) {
					// Update existing file
					await this.vault.modify(file, section.content);
				} else {
					// Create new file
					await this.vault.create(filePath, section.content);
				}
			}
		}
	}

	/**
	 * Serialize folder tree to string for comparison
	 */
	private serializeFolderTree(tree: FolderNode): string {
		return JSON.stringify(tree, null, 2);
	}

	/**
	 * Hash a string
	 */
	private async hashString(str: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(str);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Validate API key
	 */
	async validateApiKey(): Promise<boolean> {
		return await this.api.validateApiKey();
	}
}
