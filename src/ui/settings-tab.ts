import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { GoogleDocsSettings } from '../types';
import { SyncEngine } from '../sync/sync-engine';
import { OAuthCallbackServer } from '../google/oauth-server';

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

		// Authentication status
		const isAuthenticated = !!(
			this.plugin.settings.refreshToken && this.plugin.settings.accessToken
		);
		const statusText = isAuthenticated ? '✓ Authenticated' : '✗ Not authenticated';

		const statusEl = containerEl.createEl('div', {
			cls: 'gdocs-auth-status',
		});
		statusEl.style.padding = '12px';
		statusEl.style.marginBottom = '1em';
		statusEl.style.borderRadius = '4px';
		statusEl.style.border = isAuthenticated
			? '2px solid var(--color-green)'
			: '2px solid var(--color-red)';
		statusEl.style.backgroundColor = 'var(--background-secondary)';

		const statusSpan = statusEl.createSpan();
		statusSpan.createEl('strong', { text: 'Status: ' });
		const textSpan = statusSpan.createSpan({ text: statusText });
		textSpan.style.color = isAuthenticated ? 'var(--color-green)' : 'var(--color-red)';

		// OAuth Credentials Section
		containerEl.createEl('h3', { text: 'OAuth2 Credentials' });

		// Client ID setting
		new Setting(containerEl)
			.setName('Client ID')
			.setDesc('OAuth2 Client ID from Google Cloud Console')
			.addText((text) =>
				text
					.setPlaceholder('Enter Client ID')
					.setValue(this.plugin.settings.clientId)
					.onChange(async (value) => {
						this.plugin.settings.clientId = value;
						await this.plugin.saveSettings();
						await this.plugin.syncEngine.updateSettings(this.plugin.settings);
					})
			);

		// Client Secret setting
		new Setting(containerEl)
			.setName('Client Secret')
			.setDesc('OAuth2 Client Secret from Google Cloud Console')
			.addText((text) => {
				text
					.setPlaceholder('Enter Client Secret')
					.setValue(this.plugin.settings.clientSecret)
					.onChange(async (value) => {
						this.plugin.settings.clientSecret = value;
						await this.plugin.saveSettings();
						await this.plugin.syncEngine.updateSettings(this.plugin.settings);
					});
				text.inputEl.type = 'password';
				return text;
			});

		// Authorize button
		new Setting(containerEl)
			.setName('Authorize with Google')
			.setDesc(
				isAuthenticated
					? 'Click to re-authorize (will generate new tokens)'
					: '⚠️ Desktop only: Click to start OAuth flow. Once authorized, tokens will work on mobile too.'
			)
			.addButton((button) =>
				button.setButtonText(isAuthenticated ? 'Re-authorize' : 'Authorize').onClick(async () => {
					if (!this.plugin.settings.clientId || !this.plugin.settings.clientSecret) {
						new Notice('Please enter Client ID and Client Secret first');
						return;
					}

					const oauth = this.plugin.syncEngine.getOAuthManager();
					if (!oauth) {
						new Notice('OAuth manager not initialized');
						return;
					}

					button.setButtonText('Authorizing...');
					button.setDisabled(true);

					try {
						// Start local callback server
						const callbackServer = new OAuthCallbackServer();
						const { redirectUri, codePromise } = await callbackServer.startServer();

						// Generate and open authorization URL
						const authUrl = oauth.getAuthorizationUrl(redirectUri);
						window.open(authUrl, '_blank');

						new Notice('Browser opened. Please authorize the app. Waiting for callback...');

						// Wait for the authorization code from the callback
						const code = await codePromise;

						// Exchange code for tokens
						const tokens = await oauth.exchangeCodeForTokens(code, redirectUri);

						// Save tokens
						this.plugin.settings.accessToken = tokens.accessToken;
						this.plugin.settings.refreshToken = tokens.refreshToken;
						await this.plugin.saveSettings();
						await this.plugin.syncEngine.updateSettings(this.plugin.settings);

						new Notice('✓ Successfully authenticated with Google!');
						this.display(); // Refresh UI
					} catch (error) {
						new Notice(`✗ Authorization failed: ${error.message}`);
						console.error('OAuth error:', error);
					} finally {
						button.setButtonText(isAuthenticated ? 'Re-authorize' : 'Authorize');
						button.setDisabled(false);
					}
				})
			);

		// Test button - only show if authenticated
		if (isAuthenticated) {
			new Setting(containerEl)
				.setName('Test Connection')
				.setDesc('Verify your authentication works (creates a test document)')
				.addButton((button) =>
					button.setButtonText('Test').onClick(async () => {
						button.setButtonText('Testing...');
						button.setDisabled(true);

						try {
							const isValid = await this.plugin.syncEngine.validateCredentials();
							if (isValid) {
								new Notice('✓ Authentication is valid! A test document was created.');
								await this.plugin.saveSettings(); // Save refreshed token
							} else {
								new Notice('✗ Authentication failed');
							}
						} catch (error) {
							new Notice(`✗ Test failed: ${error.message}`);
						} finally {
							button.setButtonText('Test');
							button.setDisabled(false);
						}
					})
				);
		}

		// Other Settings
		containerEl.createEl('h3', { text: 'Other Settings' });

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
						this.plugin.setupAutoSync();
					})
			);

		// Setup instructions
		containerEl.createEl('h3', { text: 'Setup Instructions' });

		const instructionsDiv = containerEl.createEl('div', { cls: 'gdocs-setup-instructions' });

		instructionsDiv.createEl('p', {
			text: 'To get your OAuth2 credentials:',
		});

		const ol = instructionsDiv.createEl('ol');
		ol.createEl('li').innerHTML =
			'Go to <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a>';
		ol.createEl('li', { text: 'Create a new project (or select existing)' });
		ol.createEl('li', { text: 'Enable "Google Docs API" in APIs & Services' });
		ol.createEl('li', {
			text: 'Create OAuth 2.0 Client ID (Application type: Desktop app)',
		});
		ol.createEl('li', { text: 'Copy the Client ID and Client Secret above' });
		ol.createEl('li', { text: 'Click "Authorize" - the plugin will handle the rest automatically' });

		instructionsDiv.createEl('p', {
			text: '⚠️ Note: Authorization must be done on desktop (Windows, Mac, or Linux). The loopback redirect method does not work on mobile devices. Once you authorize on desktop, the tokens will sync to your mobile devices and work there.',
			cls: 'gdocs-note',
		});

		instructionsDiv.createEl('p', {
			text: 'The plugin uses a local callback server (loopback redirect) to securely receive the authorization code. Your tokens are stored locally and automatically refreshed.',
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
