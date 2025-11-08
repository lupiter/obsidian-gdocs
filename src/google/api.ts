import {
	GoogleDoc,
	GoogleDocRequest,
	BatchUpdateResponse,
	GoogleDocParagraphStyle,
	GoogleDocTextStyle,
} from '../types';

/**
 * Google Docs API client using direct REST API calls
 */
export class GoogleDocsAPI {
	private apiKey: string;
	private baseUrl = 'https://docs.googleapis.com/v1';

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	/**
	 * Validate API key by making a test request
	 */
	async validateApiKey(): Promise<boolean> {
		try {
			// Try to list accessible documents (will fail if key is invalid)
			const response = await fetch(`${this.baseUrl}/documents?key=${this.apiKey}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Create a new Google Doc
	 */
	async createDocument(title: string): Promise<GoogleDoc> {
		const response = await fetch(`${this.baseUrl}/documents?key=${this.apiKey}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title }),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to create document: ${error}`);
		}

		const doc = await response.json();
		return doc as GoogleDoc;
	}

	/**
	 * Get a Google Doc by ID
	 */
	async getDocument(documentId: string): Promise<GoogleDoc> {
		const response = await fetch(`${this.baseUrl}/documents/${documentId}?key=${this.apiKey}`, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get document: ${error}`);
		}

		const doc = await response.json();
		return doc as GoogleDoc;
	}

	/**
	 * Update a Google Doc with batch update requests
	 */
	async batchUpdate(
		documentId: string,
		requests: GoogleDocRequest[]
	): Promise<BatchUpdateResponse> {
		const response = await fetch(
			`${this.baseUrl}/documents/${documentId}:batchUpdate?key=${this.apiKey}`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ requests }),
			}
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to update document: ${error}`);
		}

		return (await response.json()) as BatchUpdateResponse;
	}

	/**
	 * Delete all content in a document (prepare for fresh write)
	 */
	async clearDocument(documentId: string): Promise<void> {
		// First, get the document to find the content range
		const doc = await this.getDocument(documentId);

		// Find the end index (last position in the document)
		let endIndex = 1;
		if (doc.body && doc.body.content && doc.body.content.length > 0) {
			const lastElement = doc.body.content[doc.body.content.length - 1];
			endIndex = lastElement.endIndex || 1;
		}

		// Delete all content except the required trailing newline
		if (endIndex > 1) {
			await this.batchUpdate(documentId, [
				{
					deleteContentRange: {
						range: {
							startIndex: 1,
							endIndex: endIndex - 1,
						},
					},
				},
			]);
		}
	}

	/**
	 * Get the URL for viewing a Google Doc
	 */
	getDocumentUrl(documentId: string): string {
		return `https://docs.google.com/document/d/${documentId}/edit`;
	}

	/**
	 * Insert text at a specific index
	 */
	createInsertTextRequest(text: string, index: number): GoogleDocRequest {
		return {
			insertText: {
				text,
				location: { index },
			},
		};
	}

	/**
	 * Update paragraph style (for headings, etc.)
	 */
	createParagraphStyleRequest(
		startIndex: number,
		endIndex: number,
		style: Partial<GoogleDocParagraphStyle>
	): GoogleDocRequest {
		return {
			updateParagraphStyle: {
				range: { startIndex, endIndex },
				paragraphStyle: style,
				fields: Object.keys(style).join(','),
			},
		};
	}

	/**
	 * Update text style (bold, italic, etc.)
	 */
	createTextStyleRequest(
		startIndex: number,
		endIndex: number,
		style: Partial<GoogleDocTextStyle>
	): GoogleDocRequest {
		return {
			updateTextStyle: {
				range: { startIndex, endIndex },
				textStyle: style,
				fields: Object.keys(style).join(','),
			},
		};
	}
}
