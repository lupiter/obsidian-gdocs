import { SyncMetadata } from '../../src/types';
import { MetadataManager } from '../../src/sync/metadata-manager';
import { TFolder, TFile, Vault } from 'obsidian';

const mockVault = {
	getAbstractFileByPath: jest.fn(),
	read: jest.fn(),
	modify: jest.fn(),
	create: jest.fn(),
	delete: jest.fn(),
} as unknown as Vault;

describe('MetadataManager', () => {
	let manager: MetadataManager;

	beforeEach(() => {
		manager = new MetadataManager(mockVault);
		jest.clearAllMocks();
	});

	describe('getMetadataPath', () => {
		it('should return correct metadata file path', () => {
			const folder = { path: '/test/folder' } as TFolder;
			const path = manager.getMetadataPath(folder);

			expect(path).toBe('/test/folder/.sync-metadata.json');
		});
	});

	describe('hasMetadata', () => {
		it('should return true when metadata file exists', async () => {
			const folder = { path: '/test' } as TFolder;
			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue({});

			const result = await manager.hasMetadata(folder);

			expect(result).toBe(true);
		});

		it('should return false when metadata file does not exist', async () => {
			const folder = { path: '/test' } as TFolder;
			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

			const result = await manager.hasMetadata(folder);

			expect(result).toBe(false);
		});
	});

	describe('readMetadata', () => {
		it('should read and parse metadata file', async () => {
			const folder = { path: '/test' } as TFolder;
			const mockMetadata: SyncMetadata = {
				googleDocId: 'doc123',
				lastSyncTime: '2025-01-01T00:00:00Z',
				folderPath: '/test',
				contentHash: 'hash123',
			};

			// Mock TFile instance
			const mockFile = Object.create(TFile.prototype);
			Object.assign(mockFile, {
				path: '/test/.sync-metadata.json',
				basename: '.sync-metadata',
				extension: 'json',
			});

			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);
			(mockVault.read as jest.Mock).mockResolvedValue(JSON.stringify(mockMetadata));

			const result = await manager.readMetadata(folder);

			expect(result).toEqual(mockMetadata);
		});

		it('should return null if file does not exist', async () => {
			const folder = { path: '/test' } as TFolder;
			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

			const result = await manager.readMetadata(folder);

			expect(result).toBeNull();
		});
	});

	describe('createMetadata', () => {
		it('should create metadata object with correct structure', () => {
			const metadata = manager.createMetadata('doc123', '/test', 'hash123', 'rev1');

			expect(metadata.googleDocId).toBe('doc123');
			expect(metadata.folderPath).toBe('/test');
			expect(metadata.contentHash).toBe('hash123');
			expect(metadata.revisionId).toBe('rev1');
			expect(metadata.lastSyncTime).toBeDefined();
		});
	});

	describe('writeMetadata', () => {
		it('should create new file if it does not exist', async () => {
			const folder = { path: '/test' } as TFolder;
			const metadata: SyncMetadata = {
				googleDocId: 'doc123',
				lastSyncTime: '2025-01-01T00:00:00Z',
				folderPath: '/test',
				contentHash: 'hash123',
			};

			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(null);

			await manager.writeMetadata(folder, metadata);

			expect(mockVault.create).toHaveBeenCalledWith(
				'/test/.sync-metadata.json',
				expect.any(String)
			);
		});

		it('should modify existing file if it exists', async () => {
			const folder = { path: '/test' } as TFolder;
			const metadata: SyncMetadata = {
				googleDocId: 'doc123',
				lastSyncTime: '2025-01-01T00:00:00Z',
				folderPath: '/test',
				contentHash: 'hash123',
			};

			// Mock TFile instance
			const mockFile = Object.create(TFile.prototype);
			Object.assign(mockFile, {
				path: '/test/.sync-metadata.json',
				basename: '.sync-metadata',
				extension: 'json',
			});
			(mockVault.getAbstractFileByPath as jest.Mock).mockReturnValue(mockFile);

			await manager.writeMetadata(folder, metadata);

			expect(mockVault.modify).toHaveBeenCalledWith(mockFile, expect.any(String));
		});
	});
});
