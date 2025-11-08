import { GoogleDocsAPI } from '../../src/google/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('GoogleDocsAPI', () => {
	let api: GoogleDocsAPI;
	const mockApiKey = 'test-api-key';

	beforeEach(() => {
		api = new GoogleDocsAPI(mockApiKey);
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should initialize with API key', () => {
			expect(api).toBeInstanceOf(GoogleDocsAPI);
		});
	});

	describe('getDocumentUrl', () => {
		it('should generate correct document URL', () => {
			const docId = 'abc123';
			const url = api.getDocumentUrl(docId);

			expect(url).toBe('https://docs.google.com/document/d/abc123/edit');
		});
	});

	describe('createDocument', () => {
		it('should make POST request to create document', async () => {
			const mockResponse = {
				documentId: 'new-doc-id',
				title: 'Test Doc',
				body: { content: [] },
				revisionId: 'rev1',
			};

			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse,
			});

			const result = await api.createDocument('Test Doc');

			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('/documents'),
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
				})
			);

			expect(result.documentId).toBe('new-doc-id');
			expect(result.title).toBe('Test Doc');
		});

		it('should throw error on failed request', async () => {
			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: false,
				text: async () => 'API Error',
			});

			await expect(api.createDocument('Test')).rejects.toThrow();
		});
	});

	describe('getDocument', () => {
		it('should make GET request to fetch document', async () => {
			const mockDoc = {
				documentId: 'doc-id',
				title: 'Test Doc',
				body: { content: [] },
			};

			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				json: async () => mockDoc,
			});

			const result = await api.getDocument('doc-id');

			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining('/documents/doc-id'),
				expect.objectContaining({
					method: 'GET',
				})
			);

			expect(result.documentId).toBe('doc-id');
		});
	});

	describe('batchUpdate', () => {
		it('should send batch update requests', async () => {
			const requests = [{ insertText: { text: 'Hello', location: { index: 1 } } }];

			(global.fetch as jest.Mock).mockResolvedValueOnce({
				ok: true,
				json: async () => ({ replies: [] }),
			});

			await api.batchUpdate('doc-id', requests);

			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining(':batchUpdate'),
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ requests }),
				})
			);
		});
	});

	describe('helper methods', () => {
		it('should create insert text request', () => {
			const request = api.createInsertTextRequest('Hello', 1);

			expect(request).toEqual({
				insertText: {
					text: 'Hello',
					location: { index: 1 },
				},
			});
		});

		it('should create paragraph style request', () => {
			const style = { namedStyleType: 'HEADING_1' };
			const request = api.createParagraphStyleRequest(1, 10, style);

			expect(request.updateParagraphStyle).toBeDefined();
			expect(request.updateParagraphStyle?.range).toEqual({
				startIndex: 1,
				endIndex: 10,
			});
			expect(request.updateParagraphStyle?.paragraphStyle).toEqual(style);
		});

		it('should create text style request', () => {
			const style = { bold: true };
			const request = api.createTextStyleRequest(1, 10, style);

			expect(request.updateTextStyle).toBeDefined();
			expect(request.updateTextStyle?.range).toEqual({
				startIndex: 1,
				endIndex: 10,
			});
			expect(request.updateTextStyle?.textStyle).toEqual(style);
		});
	});
});
