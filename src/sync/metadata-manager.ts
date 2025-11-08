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
		const file = this.vault.getAbstractFileByPath(metadataPath);
		return file !== null;
	}

	/**
	 * Read sync metadata from a folder
	 */
	async readMetadata(folder: TFolder): Promise<SyncMetadata | null> {
		const metadataPath = this.getMetadataPath(folder);
		const file = this.vault.getAbstractFileByPath(metadataPath);

		if (!file || !(file instanceof TFile)) {
			return null;
		}

		try {
			const content = await this.vault.read(file);
			const metadata = JSON.parse(content) as SyncMetadata;
			return metadata;
		} catch (error) {
			console.error('Failed to read metadata:', error);
			return null;
		}
	}

	/**
	 * Write sync metadata to a folder
	 */
	async writeMetadata(folder: TFolder, metadata: SyncMetadata): Promise<void> {
		const metadataPath = this.getMetadataPath(folder);
		const file = this.vault.getAbstractFileByPath(metadataPath);

		const content = JSON.stringify(metadata, null, 2);

		if (file && file instanceof TFile) {
			// Update existing file
			await this.vault.modify(file, content);
		} else {
			// Create new file
			await this.vault.create(metadataPath, content);
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
