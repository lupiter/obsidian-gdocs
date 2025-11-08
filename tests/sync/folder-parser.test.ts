import { FolderParser } from '../../src/sync/folder-parser';
import { TFolder, Vault } from 'obsidian';

// Mock Obsidian types
const mockVault = {
	read: jest.fn(),
} as unknown as Vault;

describe('FolderParser', () => {
	let parser: FolderParser;

	beforeEach(() => {
		parser = new FolderParser(mockVault);
		jest.clearAllMocks();
	});

	describe('stripFrontMatter', () => {
		it('should strip YAML front matter from content', () => {
			const content = `---
title: Test Note
tags: [test, example]
---

This is the content.`;

			const result = parser.stripFrontMatter(content);
			expect(result).toBe('This is the content.');
		});

		it('should return content unchanged if no front matter', () => {
			const content = 'Just regular content.';
			const result = parser.stripFrontMatter(content);
			expect(result).toBe(content);
		});

		it('should handle front matter with standard delimiter', () => {
			const content = `---
title: Test
---

Content here.`;

			const result = parser.stripFrontMatter(content);
			expect(result).toBe('Content here.');
		});
	});

	describe('calculateFolderHash', () => {
		it('should generate consistent hash for same content', async () => {
			const mockFolder = {
				name: 'TestFolder',
				path: '/test',
				children: [],
			} as unknown as TFolder;

			const hash1 = await parser.calculateFolderHash(mockFolder);
			const hash2 = await parser.calculateFolderHash(mockFolder);

			expect(hash1).toBe(hash2);
			expect(hash1).toHaveLength(64); // SHA-256 hex string length
		});
	});

	describe('flattenFolderTree', () => {
		it('should flatten nested folder structure', () => {
			const node = {
				name: 'Root',
				path: '/root',
				type: 'folder' as const,
				level: 1,
				children: [
					{
						name: 'Child1',
						path: '/root/child1',
						type: 'file' as const,
						level: 2,
						content: 'Content 1',
					},
					{
						name: 'Child2',
						path: '/root/child2',
						type: 'folder' as const,
						level: 2,
						children: [
							{
								name: 'GrandChild',
								path: '/root/child2/grandchild',
								type: 'file' as const,
								level: 3,
								content: 'Content 2',
							},
						],
					},
				],
			};

			const flattened = parser.flattenFolderTree(node);

			expect(flattened).toHaveLength(4); // Root + 2 children + 1 grandchild
			expect(flattened[0].name).toBe('Root');
			expect(flattened[3].name).toBe('GrandChild');
		});
	});
});
