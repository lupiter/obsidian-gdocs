import { ConflictResolver } from '../../src/sync/conflict-resolver';

describe('ConflictResolver', () => {
	let resolver: ConflictResolver;

	beforeEach(() => {
		resolver = new ConflictResolver();
	});

	describe('detectConflict', () => {
		it('should detect conflict when both local and remote changed', () => {
			const result = resolver.detectConflict('hash1', 'hash2', 'hash3');
			expect(result).toBe(true);
		});

		it('should not detect conflict when only local changed', () => {
			const result = resolver.detectConflict('hash1', 'hash2', 'hash2');
			expect(result).toBe(false);
		});

		it('should not detect conflict when only remote changed', () => {
			const result = resolver.detectConflict('hash1', 'hash2', 'hash1');
			expect(result).toBe(false);
		});

		it('should not detect conflict when both unchanged', () => {
			const result = resolver.detectConflict('hash1', 'hash1', 'hash1');
			expect(result).toBe(false);
		});
	});

	describe('autoResolve', () => {
		it('should use remote when local is unchanged', () => {
			const base = 'Base content';
			const local = 'Base content'; // unchanged
			const remote = 'Remote changed';

			const result = resolver.autoResolve(local, remote, base);
			expect(result).toBe(remote);
		});

		it('should use local when remote is unchanged', () => {
			const base = 'Base content';
			const local = 'Local changed';
			const remote = 'Base content'; // unchanged

			const result = resolver.autoResolve(local, remote, base);
			expect(result).toBe(local);
		});

		it('should accept when both changed to same value', () => {
			const base = 'Base content';
			const changed = 'Same change';

			const result = resolver.autoResolve(changed, changed, base);
			expect(result).toBe(changed);
		});

		it('should attempt line merge when both changed', () => {
			const base = 'Line 1\nLine 2\nLine 3';
			const local = 'Line 1\nLocal Line 2\nLine 3';
			const remote = 'Line 1\nLine 2\nRemote Line 3';

			const result = resolver.autoResolve(local, remote, base);
			// Should attempt merge
			expect(result).not.toBeNull();
		});
	});

	describe('generateDiff', () => {
		it('should detect added lines', () => {
			const oldContent = 'Line 1\nLine 2';
			const newContent = 'Line 1\nLine 2\nLine 3';

			const diffs = resolver.generateDiff(oldContent, newContent);

			expect(diffs).toHaveLength(1);
			expect(diffs[0].type).toBe('added');
			expect(diffs[0].newValue).toBe('Line 3');
		});

		it('should detect removed lines', () => {
			const oldContent = 'Line 1\nLine 2\nLine 3';
			const newContent = 'Line 1\nLine 3';

			const diffs = resolver.generateDiff(oldContent, newContent);

			expect(diffs.some((d) => d.type === 'removed')).toBe(true);
		});

		it('should detect modified lines', () => {
			const oldContent = 'Line 1\nLine 2\nLine 3';
			const newContent = 'Line 1\nModified Line 2\nLine 3';

			const diffs = resolver.generateDiff(oldContent, newContent);

			expect(diffs.some((d) => d.type === 'modified')).toBe(true);
		});
	});

	describe('createConflictInfo', () => {
		it('should create proper conflict info object', () => {
			const conflict = resolver.createConflictInfo(
				'local content',
				'remote content',
				'Test conflict'
			);

			expect(conflict.type).toBe('content');
			expect(conflict.localVersion).toBe('local content');
			expect(conflict.remoteVersion).toBe('remote content');
			expect(conflict.description).toBe('Test conflict');
		});
	});
});
