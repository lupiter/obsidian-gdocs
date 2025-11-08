import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { GoogleDocsSettings } from '../types';
import { SyncEngine } from '../sync/sync-engine';

/**
 * Interface for our plugin with the methods and properties we need
 */
interface GoogleDocsPlugin extends Plugin {
	settings: GoogleDocsSettings;
	syncEngine: SyncEngine;
	saveSettings(): Promise<void>;
	setupAutoSync(): void;
}

/**
 * Settings tab for Google Docs Sync plugin
 */
export class GoogleDocsSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: GoogleDocsPlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Google Docs Sync Settings' });

		// API Key setting
		new Setting(containerEl)
			.setName('Google API Key')
			.setDesc('Enter your Google Cloud API key with Google Docs API access')
			.addText((text) =>
				text
					.setPlaceholder('Enter API key')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					})
			);

		// Validate API Key button
		new Setting(containerEl)
			.setName('Validate API Key')
			.setDesc('Test if your API key is valid and has proper permissions')
			.addButton((button) =>
				button.setButtonText('Validate').onClick(async () => {
					if (!this.plugin.settings.apiKey) {
						new Notice('Please enter an API key first');
						return;
					}

					button.setButtonText('Validating...');
					button.setDisabled(true);

					try {
						const isValid = await this.plugin.syncEngine.validateApiKey();
						if (isValid) {
							new Notice('✓ API key is valid');
						} else {
							new Notice('✗ API key is invalid or lacks permissions');
						}
					} catch (error) {
						new Notice(`✗ Validation failed: ${error.message}`);
					} finally {
						button.setButtonText('Validate');
						button.setDisabled(false);
					}
				})
			);

		// Show metadata files setting
		new Setting(containerEl)
			.setName('Show metadata files')
			.setDesc('Show .sync-metadata.json files in folder view (requires restart)')
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showMetadataFiles).onChange(async (value) => {
					this.plugin.settings.showMetadataFiles = value;
					await this.plugin.saveSettings();
				})
			);

		// Auto-sync interval setting
		new Setting(containerEl)
			.setName('Auto-sync interval')
			.setDesc('Automatically sync at regular intervals (0 = disabled)')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('0', 'Disabled')
					.addOption('5', '5 minutes')
					.addOption('15', '15 minutes')
					.addOption('30', '30 minutes')
					.addOption('60', '1 hour')
					.setValue(this.plugin.settings.autoSyncInterval.toString())
					.onChange(async (value) => {
						this.plugin.settings.autoSyncInterval = parseInt(value);
						await this.plugin.saveSettings();
						this.plugin.setupAutoSync(); // Restart auto-sync with new interval
					})
			);

		// Setup instructions
		containerEl.createEl('h3', { text: 'Setup Instructions' });

		const instructionsDiv = containerEl.createEl('div', { cls: 'gdocs-setup-instructions' });

		instructionsDiv.createEl('p', {
			text: 'To use this plugin, you need a Google Cloud API key:',
		});

		const ol = instructionsDiv.createEl('ol');
		ol.createEl('li').innerHTML =
			'Go to <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a>';
		ol.createEl('li', { text: 'Create a new project or select an existing one' });
		ol.createEl('li', { text: 'Enable the Google Docs API for your project' });
		ol.createEl('li', {
			text: 'Create credentials (API Key) under "APIs & Services > Credentials"',
		});
		ol.createEl('li', { text: 'Restrict the API key to Google Docs API for security' });
		ol.createEl('li', { text: 'Copy the API key and paste it above' });

		instructionsDiv.createEl('p', {
			text: 'Note: API keys have quota limits. For production use, consider implementing OAuth 2.0.',
			cls: 'gdocs-note',
		});

		// Last sync status
		if (this.plugin.settings.lastSyncStatus) {
			containerEl.createEl('h3', { text: 'Last Sync Status' });
			containerEl.createEl('p', {
				text: this.plugin.settings.lastSyncStatus,
				cls: 'gdocs-last-sync',
			});
		}
	}
}
