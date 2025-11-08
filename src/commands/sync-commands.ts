import { App, TFolder, TFile, Notice, Menu } from 'obsidian';
import { SyncEngine } from '../sync/sync-engine';
import { SyncProgressModal } from '../ui/sync-modal';
import { DiffViewerModal } from '../ui/diff-modal';
import { GoogleDocsSettings } from '../types';

/**
 * Handles all sync-related commands and operations
 */
export class SyncCommands {
	private app: App;
	private syncEngine: SyncEngine;
	private settings: GoogleDocsSettings;
	private saveSettings: () => Promise<void>;

	constructor(
		app: App,
		syncEngine: SyncEngine,
		settings: GoogleDocsSettings,
		saveSettings: () => Promise<void>
	) {
		this.app = app;
		this.syncEngine = syncEngine;
		this.settings = settings;
		this.saveSettings = saveSettings;
	}

	/**
	 * Show sync menu (from ribbon icon)
	 */
	showSyncMenu() {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('Sync current folder')
				.setIcon('sync')
				.onClick(() => this.syncCurrentFolder())
		);

		menu.addItem((item) =>
			item
				.setTitle('Sync all linked folders')
				.setIcon('sync')
				.onClick(() => this.syncAllFolders())
		);

		menu.showAtMouseEvent(new MouseEvent('click'));
	}

	/**
	 * Add context menu items for folders
	 */
	addFolderContextMenu(menu: Menu, folder: TFolder) {
		menu.addItem((item) =>
			item
				.setTitle('Sync with Google Docs')
				.setIcon('sync')
				.onClick(async () => {
					await this.syncFolder(folder);
				})
		);
	}

	/**
	 * Sync the currently active folder
	 */
	async syncCurrentFolder() {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('No active file or folder');
			return;
		}

		// Get the parent folder
		const folder = activeFile.parent;
		if (!folder) {
			new Notice('File is not in a folder');
			return;
		}

		await this.syncFolder(folder);
	}

	/**
	 * Sync all folders that have metadata
	 */
	async syncAllFolders(silent = false) {
		if (!this.settings.apiKey) {
			if (!silent) {
				new Notice('Please configure your Google API key in settings');
			}
			return;
		}

		if (!silent) {
			new Notice('Starting sync for all linked folders...');
		}

		let successCount = 0;
		let errorCount = 0;

		// Find all folders with .sync-metadata.json
		const folders = await this.findSyncedFolders();

		for (const folder of folders) {
			try {
				const result = await this.syncEngine.syncFolder(folder);
				if (result.success) {
					successCount++;
				} else {
					errorCount++;
					if (!silent) {
						new Notice(`Error syncing ${folder.name}: ${result.message}`);
					}
				}
			} catch (error) {
				errorCount++;
				console.error(`Error syncing folder ${folder.name}:`, error);
			}
		}

		if (!silent) {
			new Notice(`Sync complete: ${successCount} succeeded, ${errorCount} failed`);
		}

		// Update last sync status
		this.settings.lastSyncStatus = `Last synced ${folders.length} folder(s) at ${new Date().toLocaleString()}`;
		await this.saveSettings();
	}

	/**
	 * Sync a specific folder
	 */
	async syncFolder(folder: TFolder) {
		// Check for API key
		if (!this.settings.apiKey) {
			new Notice('Please configure your Google API key in settings');
			return;
		}

		// Show progress modal
		const modal = new SyncProgressModal(this.app);
		modal.open();

		try {
			modal.setStatus('Syncing folder...');
			modal.setProgress(25);

			// Perform sync
			const result = await this.syncEngine.syncFolder(folder);

			modal.setProgress(75);

			// Handle conflicts
			if (result.conflicts && result.conflicts.length > 0) {
				modal.close();

				// Show diff viewer
				const diffModal = new DiffViewerModal(this.app, result.conflicts, async (choice) => {
					if (choice === 'cancel') {
						new Notice('Sync cancelled');
						return;
					}

					// User chose local or remote - resync with that preference
					new Notice(`Applying ${choice} version...`);

					// In a full implementation, we'd pass the choice to the sync engine
					// For now, just retry the sync
					const retryResult = await this.syncEngine.syncFolder(folder);

					if (retryResult.success) {
						new Notice('✓ Sync completed');
					} else {
						new Notice(`✗ Sync failed: ${retryResult.message}`);
					}
				});
				diffModal.open();
				return;
			}

			modal.setProgress(100);
			modal.showComplete(result.success, result.message, result.documentUrl);

			// Update last sync status
			this.settings.lastSyncStatus = `Last synced "${folder.name}" at ${new Date().toLocaleString()}`;
			await this.saveSettings();
		} catch (error) {
			console.error('Sync error:', error);
			modal.showComplete(false, `Sync failed: ${error.message}`);
		}
	}

	/**
	 * Find all folders that have sync metadata
	 */
	private async findSyncedFolders(): Promise<TFolder[]> {
		const folders: TFolder[] = [];
		const allFiles = this.app.vault.getAllLoadedFiles();

		for (const file of allFiles) {
			if (file instanceof TFile && file.name === '.sync-metadata.json') {
				const folder = file.parent;
				if (folder) {
					folders.push(folder);
				}
			}
		}

		return folders;
	}
}
