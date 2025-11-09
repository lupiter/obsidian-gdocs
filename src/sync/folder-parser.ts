import { TFolder, TFile, Vault } from 'obsidian';
import { FolderNode } from '../types';
import matter from 'gray-matter';
import { createHash } from 'crypto';

const METADATA_FILENAME = '.sync-metadata.json';

/**
 * Parses Obsidian folder structures into a tree representation
 */
export class FolderParser {
	constructor(private vault: Vault) {}

	/**
	 * Parse a folder and all its contents recursively
	 */
	async parseFolder(folder: TFolder, baseLevel = 1): Promise<FolderNode> {
		const node: FolderNode = {
			name: folder.name,
			path: folder.path,
			type: 'folder',
			level: baseLevel,
			children: [],
		};

		// Get all children, sorted alphabetically
		const children = folder.children.slice().sort((a, b) => {
			// Folders first, then files
			if (a instanceof TFolder && !(b instanceof TFolder)) return -1;
			if (!(a instanceof TFolder) && b instanceof TFolder) return 1;
			return a.name.localeCompare(b.name);
		});

		for (const child of children) {
			// Skip metadata files
			if (child.name === METADATA_FILENAME) {
				continue;
			}

			if (child instanceof TFolder) {
				// Recursively parse subfolder
				const childNode = await this.parseFolder(child, baseLevel + 1);
				if (!node.children) {
					node.children = [];
				}
				node.children.push(childNode);
			} else if (child instanceof TFile && child.extension === 'md') {
				// Parse markdown file
				const fileNode = await this.parseFile(child, baseLevel + 1);
				if (!node.children) {
					node.children = [];
				}
				node.children.push(fileNode);
			}
		}

		return node;
	}

	/**
	 * Parse a markdown file
	 */
	async parseFile(file: TFile, level: number): Promise<FolderNode> {
		const content = await this.vault.read(file);
		const strippedContent = this.stripFrontMatter(content);

		return {
			name: file.basename, // Without .md extension
			path: file.path,
			type: 'file',
			level,
			content: strippedContent,
		};
	}

	/**
	 * Strip YAML/TOML/JSON front matter from markdown content using gray-matter
	 */
	stripFrontMatter(content: string): string {
		try {
			// gray-matter parses and strips front matter
			const parsed = matter(content);
			return parsed.content.trim();
		} catch (error) {
			// If parsing fails, return original content
			console.warn('Failed to parse front matter:', error);
			return content;
		}
	}

	/**
	 * Calculate a hash of the folder structure and content
	 * Used for change detection
	 */
	async calculateFolderHash(folder: TFolder): Promise<string> {
		const node = await this.parseFolder(folder);
		const contentString = this.serializeFolderNode(node);
		return await this.hashString(contentString);
	}

	/**
	 * Serialize a folder node to a string for hashing
	 */
	private serializeFolderNode(node: FolderNode): string {
		let result = `${node.type}:${node.name}:${node.level}`;

		if (node.content) {
			result += `:${node.content}`;
		}

		if (node.children && node.children.length > 0) {
			result += ':children:[';
			for (const child of node.children) {
				result += this.serializeFolderNode(child) + ',';
			}
			result += ']';
		}

		return result;
	}

	/**
	 * Simple hash function using Web Crypto API
	 * (available in both desktop and mobile Obsidian)
	 */
	private async hashString(str: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(str);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
		return hashHex;
	}

	/**
	 * Calculate hash of content (public for use in sync engine)
	 * Synchronous version using Node's crypto for simplicity
	 */
	calculateContentHash(content: string): string {
		return createHash('sha256').update(content).digest('hex');
	}

	/**
	 * Flatten folder tree into a list of sections
	 * (for easier conversion to Google Docs)
	 */
	flattenFolderTree(node: FolderNode): FolderNode[] {
		const result: FolderNode[] = [];

		// Add the current node
		result.push(node);

		// Recursively add children
		if (node.children) {
			for (const child of node.children) {
				result.push(...this.flattenFolderTree(child));
			}
		}

		return result;
	}
}
