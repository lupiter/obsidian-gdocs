import { ConflictInfo, ContentDiff } from '../types';

/**
 * Handles conflict detection and resolution for bidirectional sync
 */
export class ConflictResolver {
	/**
	 * Detect if there's a conflict between local and remote content
	 */
	detectConflict(localHash: string, remoteHash: string, lastSyncHash: string): boolean {
		// If both versions differ from the last sync, we have a conflict
		return localHash !== lastSyncHash && remoteHash !== lastSyncHash && localHash !== remoteHash;
	}

	/**
	 * Try to automatically resolve a conflict
	 * Returns merged content if successful, null if manual resolution needed
	 */
	autoResolve(localContent: string, remoteContent: string, baseContent: string): string | null {
		// Simple three-way merge logic

		// If local is unchanged, use remote
		if (localContent === baseContent) {
			return remoteContent;
		}

		// If remote is unchanged, use local
		if (remoteContent === baseContent) {
			return localContent;
		}

		// If both have changed to the same thing, no conflict
		if (localContent === remoteContent) {
			return localContent;
		}

		// Try line-by-line merge
		const mergedContent = this.tryLineMerge(localContent, remoteContent, baseContent);
		return mergedContent;
	}

	/**
	 * Attempt a line-by-line three-way merge
	 */
	private tryLineMerge(
		localContent: string,
		remoteContent: string,
		baseContent: string
	): string | null {
		const localLines = localContent.split('\n');
		const remoteLines = remoteContent.split('\n');
		const baseLines = baseContent.split('\n');

		const merged: string[] = [];
		let hasConflict = false;

		const maxLen = Math.max(localLines.length, remoteLines.length, baseLines.length);

		for (let i = 0; i < maxLen; i++) {
			const localLine = localLines[i] || '';
			const remoteLine = remoteLines[i] || '';
			const baseLine = baseLines[i] || '';

			if (localLine === remoteLine) {
				// Both same, use either
				merged.push(localLine);
			} else if (localLine === baseLine) {
				// Local unchanged, remote changed, use remote
				merged.push(remoteLine);
			} else if (remoteLine === baseLine) {
				// Remote unchanged, local changed, use local
				merged.push(localLine);
			} else {
				// Both changed differently - conflict
				hasConflict = true;
				break;
			}
		}

		return hasConflict ? null : merged.join('\n');
	}

	/**
	 * Generate a diff between two versions
	 */
	generateDiff(oldContent: string, newContent: string): ContentDiff[] {
		const diffs: ContentDiff[] = [];
		const oldLines = oldContent.split('\n');
		const newLines = newContent.split('\n');

		// Simple diff algorithm
		let i = 0;
		let j = 0;

		while (i < oldLines.length || j < newLines.length) {
			if (i >= oldLines.length) {
				// Added lines at end
				diffs.push({
					type: 'added',
					location: `line ${j + 1}`,
					newValue: newLines[j],
				});
				j++;
			} else if (j >= newLines.length) {
				// Removed lines at end
				diffs.push({
					type: 'removed',
					location: `line ${i + 1}`,
					oldValue: oldLines[i],
				});
				i++;
			} else if (oldLines[i] === newLines[j]) {
				// Same line
				i++;
				j++;
			} else {
				// Look ahead to see if it's an insertion, deletion, or modification
				const oldIndex = newLines.indexOf(oldLines[i], j);
				const newIndex = oldLines.indexOf(newLines[j], i);

				if (oldIndex !== -1 && (newIndex === -1 || oldIndex - j < newIndex - i)) {
					// Insertion
					diffs.push({
						type: 'added',
						location: `line ${j + 1}`,
						newValue: newLines[j],
					});
					j++;
				} else if (newIndex !== -1) {
					// Deletion
					diffs.push({
						type: 'removed',
						location: `line ${i + 1}`,
						oldValue: oldLines[i],
					});
					i++;
				} else {
					// Modification
					diffs.push({
						type: 'modified',
						location: `line ${i + 1}`,
						oldValue: oldLines[i],
						newValue: newLines[j],
					});
					i++;
					j++;
				}
			}
		}

		return diffs;
	}

	/**
	 * Create a conflict info object
	 */
	createConflictInfo(
		localContent: string,
		remoteContent: string,
		description: string
	): ConflictInfo {
		return {
			type: 'content',
			localVersion: localContent,
			remoteVersion: remoteContent,
			description,
		};
	}

	/**
	 * Format conflicts for display to user
	 */
	formatConflictForDisplay(conflict: ConflictInfo): string {
		const diffs = this.generateDiff(conflict.localVersion, conflict.remoteVersion);

		let display = `**Conflict: ${conflict.description}**\n\n`;
		display += `Changes detected:\n`;

		for (const diff of diffs) {
			if (diff.type === 'added') {
				display += `+ ${diff.location}: ${diff.newValue}\n`;
			} else if (diff.type === 'removed') {
				display += `- ${diff.location}: ${diff.oldValue}\n`;
			} else if (diff.type === 'modified') {
				display += `~ ${diff.location}:\n`;
				display += `  Old: ${diff.oldValue}\n`;
				display += `  New: ${diff.newValue}\n`;
			}
		}

		return display;
	}
}
