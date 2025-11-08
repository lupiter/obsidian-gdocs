import { App, Modal } from 'obsidian';
import { ConflictInfo } from '../types';
import { ConflictResolver } from '../sync/conflict-resolver';

/**
 * Modal to display and resolve conflicts
 */
export class DiffViewerModal extends Modal {
	private conflictResolver: ConflictResolver;
	private onResolve: (choice: 'local' | 'remote' | 'cancel') => void;

	constructor(
		app: App,
		private conflicts: ConflictInfo[],
		onResolve: (choice: 'local' | 'remote' | 'cancel') => void
	) {
		super(app);
		this.conflictResolver = new ConflictResolver();
		this.onResolve = onResolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('gdocs-diff-modal');

		contentEl.createEl('h2', { text: 'Sync Conflicts Detected' });

		contentEl.createEl('p', {
			text: 'Changes have been made both locally and remotely. Please choose which version to keep:',
			cls: 'gdocs-diff-description',
		});

		// Display each conflict
		for (const conflict of this.conflicts) {
			this.renderConflict(contentEl, conflict);
		}

		// Action buttons
		const buttonDiv = contentEl.createEl('div', { cls: 'gdocs-diff-buttons' });

		const localButton = buttonDiv.createEl('button', {
			text: 'Keep Local Version',
			cls: 'mod-cta',
		});
		localButton.addEventListener('click', () => {
			this.onResolve('local');
			this.close();
		});

		const remoteButton = buttonDiv.createEl('button', {
			text: 'Keep Remote Version',
		});
		remoteButton.addEventListener('click', () => {
			this.onResolve('remote');
			this.close();
		});

		const cancelButton = buttonDiv.createEl('button', {
			text: 'Cancel Sync',
		});
		cancelButton.addEventListener('click', () => {
			this.onResolve('cancel');
			this.close();
		});
	}

	/**
	 * Render a single conflict
	 */
	private renderConflict(container: HTMLElement, conflict: ConflictInfo): void {
		const conflictDiv = container.createEl('div', { cls: 'gdocs-conflict' });

		conflictDiv.createEl('h3', { text: conflict.description });

		// Generate and display diff
		const diffs = this.conflictResolver.generateDiff(conflict.localVersion, conflict.remoteVersion);

		if (diffs.length === 0) {
			conflictDiv.createEl('p', { text: 'No specific differences detected.' });
			return;
		}

		const diffList = conflictDiv.createEl('ul', { cls: 'gdocs-diff-list' });

		for (const diff of diffs.slice(0, 10)) {
			// Show max 10 diffs
			const diffItem = diffList.createEl('li', { cls: `gdocs-diff-${diff.type}` });

			if (diff.type === 'added') {
				diffItem.createEl('span', { text: '+ ', cls: 'gdocs-diff-marker' });
				diffItem.createEl('span', { text: `${diff.location}: ${diff.newValue}` });
			} else if (diff.type === 'removed') {
				diffItem.createEl('span', { text: '- ', cls: 'gdocs-diff-marker' });
				diffItem.createEl('span', { text: `${diff.location}: ${diff.oldValue}` });
			} else if (diff.type === 'modified') {
				diffItem.createEl('span', { text: '~ ', cls: 'gdocs-diff-marker' });
				diffItem.createEl('span', { text: `${diff.location}` });
				const changeDiv = diffItem.createEl('div', { cls: 'gdocs-diff-change' });
				changeDiv.createEl('div', { text: `Old: ${diff.oldValue}`, cls: 'gdocs-diff-old' });
				changeDiv.createEl('div', { text: `New: ${diff.newValue}`, cls: 'gdocs-diff-new' });
			}
		}

		if (diffs.length > 10) {
			diffList.createEl('li', {
				text: `... and ${diffs.length - 10} more changes`,
				cls: 'gdocs-diff-more',
			});
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
