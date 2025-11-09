import { Plugin, TFolder } from 'obsidian';
import { GoogleDocsSettings } from './src/types';
import { DEFAULT_SETTINGS } from './src/settings';
import { GoogleDocsSettingTab } from './src/ui/settings-tab';
import { SyncEngine } from './src/sync/sync-engine';
import { SyncCommands } from './src/commands/sync-commands';

/**
 * Google Docs Sync Plugin for Obsidian
 */
export default class GoogleDocsPlugin extends Plugin {
	settings: GoogleDocsSettings;
	syncEngine: SyncEngine;
	syncCommands: SyncCommands;
	private autoSyncInterval: number | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize sync engine
		this.syncEngine = new SyncEngine(this.app.vault, this.settings);

		// Initialize command handlers
		this.syncCommands = new SyncCommands(
			this.app,
			this.syncEngine,
			this.settings,
			this.saveSettings.bind(this)
		);

		// Add ribbon icon
		this.addRibbonIcon('sync', 'Sync with Google Docs', () => {
			this.syncCommands.showSyncMenu();
		});

		// Add commands
		this.addCommand({
			id: 'sync-current-folder',
			name: 'Sync current folder with Google Docs',
			callback: () => this.syncCommands.syncCurrentFolder(),
		});

		this.addCommand({
			id: 'sync-all-folders',
			name: 'Sync all linked folders',
			callback: () => this.syncCommands.syncAllFolders(),
		});

		// Register folder context menu
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (file instanceof TFolder) {
					this.syncCommands.addFolderContextMenu(menu, file);
				}
			})
		);

		// Add settings tab
		this.addSettingTab(new GoogleDocsSettingTab(this.app, this));

		// Setup auto-sync
		this.setupAutoSync();
	}

	onunload() {
		// Clear auto-sync interval
		if (this.autoSyncInterval !== null) {
			window.clearInterval(this.autoSyncInterval);
		}
	}

	/**
	 * Load plugin settings
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * Save plugin settings
	 */
	async saveSettings() {
		await this.saveData(this.settings);

		// Update sync engine with new settings
		if (this.syncEngine) {
			this.syncEngine.updateSettings(this.settings);
		}
	}

	/**
	 * Setup auto-sync interval
	 */
	setupAutoSync() {
		// Clear existing interval
		if (this.autoSyncInterval !== null) {
			window.clearInterval(this.autoSyncInterval);
			this.autoSyncInterval = null;
		}

		// Setup new interval if enabled
		if (this.settings.autoSyncInterval > 0) {
			const intervalMs = this.settings.autoSyncInterval * 60 * 1000;
			this.autoSyncInterval = window.setInterval(() => {
				this.syncCommands.syncAllFolders(true); // Silent sync
			}, intervalMs);

			this.registerInterval(this.autoSyncInterval);
		}
	}
}
