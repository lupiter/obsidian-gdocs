import { App, Modal } from 'obsidian';

/**
 * Modal to show sync progress
 */
export class SyncProgressModal extends Modal {
	private statusEl: HTMLElement;
	private progressEl: HTMLElement;

	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('gdocs-sync-modal');

		contentEl.createEl('h2', { text: 'Syncing with Google Docs' });

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

			if (documentUrl) {
				const linkEl = contentEl.createEl('a', {
					text: 'Open in Google Docs',
					href: documentUrl,
				});
				linkEl.setAttribute('target', '_blank');
			}
		} else {
			contentEl.createEl('p', {
				text: '✗ Sync failed',
				cls: 'gdocs-sync-error',
			});
		}

		// Add close button
		const buttonDiv = contentEl.createEl('div', { cls: 'gdocs-sync-buttons' });
		const closeButton = buttonDiv.createEl('button', { text: 'Close' });
		closeButton.addEventListener('click', () => {
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
