import { TFolder, Vault, TFile } from 'obsidian';
import { SyncMetadata } from '../types';

const METADATA_FILENAME = '.sync-metadata.json';

/**
 * Manages sync metadata files in Obsidian folders
 */
export class MetadataManager {
	constructor(private vault: Vault) {}

	/**
	 * Get the metadata file path for a folder
	 */
	getMetadataPath(folder: TFolder): string {
		return `${folder.path}/${METADATA_FILENAME}`;
	}

	/**
	 * Check if a folder has sync metadata
	 */
	async hasMetadata(folder: TFolder): Promise<boolean> {
		const metadataPath = this.getMetadataPath(folder);
		
		try {
			// Use adapter.exists to check for hidden files
			// @ts-ignore - adapter.exists is available in Obsidian
			const exists = await this.vault.adapter.exists(metadataPath);
			return exists;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Read sync metadata from a folder
	 */
	async readMetadata(folder: TFolder): Promise<SyncMetadata | null> {
		const metadataPath = this.getMetadataPath(folder);
		
		try {
			// Try reading directly with adapter for hidden files
			// @ts-ignore - adapter.read is available in Obsidian
			const content = await this.vault.adapter.read(metadataPath);
			const metadata = JSON.parse(content) as SyncMetadata;
			return metadata;
		} catch (error) {
			// File doesn't exist or can't be read
			return null;
		}
	}

	/**
	 * Write sync metadata to a folder
	 */
	async writeMetadata(folder: TFolder, metadata: SyncMetadata): Promise<void> {
		const metadataPath = this.getMetadataPath(folder);
		const content = JSON.stringify(metadata, null, 2);

		try {
			// Try to read the file directly using adapter to check if it exists
			// @ts-ignore - adapter.exists is available in Obsidian
			const exists = await this.vault.adapter.exists(metadataPath);
			
			if (exists) {
				// File exists, write to it directly using adapter
				// @ts-ignore - adapter.write is available in Obsidian
				await this.vault.adapter.write(metadataPath, content);
			} else {
				// File doesn't exist, try to create it
				try {
					await this.vault.create(metadataPath, content);
				} catch (createError) {
					// If create fails, file might have appeared - write using adapter
					// @ts-ignore
					await this.vault.adapter.write(metadataPath, content);
				}
			}
		} catch (error) {
			console.error('Failed to write metadata:', error);
			throw new Error(`Failed to write metadata: ${error.message}`);
		}
	}

	/**
	 * Delete sync metadata from a folder
	 */
	async deleteMetadata(folder: TFolder): Promise<void> {
		const metadataPath = this.getMetadataPath(folder);
		const file = this.vault.getAbstractFileByPath(metadataPath);

		if (file) {
			await this.vault.delete(file);
		}
	}

	/**
	 * Create a new metadata object
	 */
	createMetadata(
		googleDocId: string,
		folderPath: string,
		contentHash: string,
		revisionId?: string
	): SyncMetadata {
		return {
			googleDocId,
			lastSyncTime: new Date().toISOString(),
			folderPath,
			contentHash,
			revisionId,
		};
	}

	/**
	 * Update the last sync time and content hash
	 */
	async updateSyncInfo(folder: TFolder, contentHash: string, revisionId?: string): Promise<void> {
		const metadata = await this.readMetadata(folder);
		if (!metadata) {
			throw new Error('No metadata found for folder');
		}

		metadata.lastSyncTime = new Date().toISOString();
		metadata.contentHash = contentHash;
		if (revisionId) {
			metadata.revisionId = revisionId;
		}

		await this.writeMetadata(folder, metadata);
	}
}
