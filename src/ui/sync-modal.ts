import { App, Modal, Setting } from 'obsidian';

/**
 * Modal to show sync progress
 */
export class SyncProgressModal extends Modal {
	private statusEl: HTMLElement;
	private progressEl: HTMLElement;

	constructor(app: App) {
		super(app);
		this.setTitle('Syncing with Google Docs');
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('gdocs-sync-modal');

		this.statusEl = contentEl.createEl('p', {
			text: 'Initializing sync...',
			cls: 'gdocs-sync-status',
		});

		this.progressEl = contentEl.createEl('div', { cls: 'gdocs-sync-progress' });
		const progressBar = this.progressEl.createEl('div', { cls: 'gdocs-sync-progress-bar' });
		progressBar.style.width = '0%';
	}

	/**
	 * Update the status message
	 */
	setStatus(message: string): void {
		if (this.statusEl) {
			this.statusEl.setText(message);
		}
	}

	/**
	 * Update the progress bar (0-100)
	 */
	setProgress(percent: number): void {
		if (this.progressEl) {
			const progressBar = this.progressEl.querySelector('.gdocs-sync-progress-bar') as HTMLElement;
			if (progressBar) {
				progressBar.style.width = `${percent}%`;
			}
		}
	}

	/**
	 * Show completion status
	 */
	showComplete(success: boolean, message: string, documentUrl?: string): void {
		if (this.statusEl) {
			this.statusEl.setText(message);
		}

		if (this.progressEl) {
			this.progressEl.remove();
		}

		const { contentEl } = this;

		if (success) {
			contentEl.createEl('p', {
				text: '✓ Sync completed successfully',
				cls: 'gdocs-sync-success',
			});

			// Use Setting for the link
			if (documentUrl) {
				new Setting(contentEl)
					.setName('View document')
					.setDesc('Open the synced document in Google Docs')
					.addButton((button) =>
						button
							.setButtonText('Open in Google Docs')
							.setCta()
							.onClick(() => {
								window.open(documentUrl, '_blank');
							})
					);
			}
		} else {
			contentEl.createEl('p', {
				text: '✗ Sync failed',
				cls: 'gdocs-sync-error',
			});
		}

		// Use Setting for the close button
		new Setting(contentEl).addButton((button) =>
			button.setButtonText('Close').onClick(() => {
				this.close();
			})
		);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
