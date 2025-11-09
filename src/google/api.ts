import {
	GoogleDoc,
	GoogleDocRequest,
	BatchUpdateResponse,
	GoogleDocParagraphStyle,
	GoogleDocTextStyle,
	OAuth2Token,
} from '../types';
import { OAuth2Manager } from './oauth';

/**
 * Google Docs API client using OAuth2 authentication
 */
export class GoogleDocsAPI {
	private accessToken: string;
	private baseUrl = 'https://docs.googleapis.com/v1';

	constructor(
		accessToken: string,
		private oauth?: OAuth2Manager
	) {
		this.accessToken = accessToken;
	}

	/**
	 * Update the access token (after refresh)
	 */
	setAccessToken(token: string): void {
		this.accessToken = token;
	}

	/**
	 * Validate OAuth token by making a test request
	 */
	async validateToken(): Promise<boolean> {
		try {
			// Create a temporary test document to validate the token
			const testDoc = await this.createDocument('OAuth Token Validation Test');

			// If we successfully created a document, the token is valid
			// Note: The test document will remain in the user's Google Drive
			// but they can delete it manually if desired
			return !!testDoc.documentId;
		} catch (error) {
			console.error('Token validation error:', error);
			return false;
		}
	}

	/**
	 * Create a new Google Doc
	 */
	async createDocument(title: string): Promise<GoogleDoc> {
		const response = await fetch(`${this.baseUrl}/documents`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.accessToken}`,
			},
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
		const response = await fetch(`${this.baseUrl}/documents/${documentId}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.accessToken}`,
			},
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
		const response = await fetch(`${this.baseUrl}/documents/${documentId}:batchUpdate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.accessToken}`,
			},
			body: JSON.stringify({ requests }),
		});

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

		// Only delete if there's content to delete (endIndex > 2 means there's more than just the trailing newline)
		// Google Docs always has at least index 1 (the required trailing newline)
		if (endIndex > 2) {
			await this.batchUpdate(documentId, [
				{
					deleteContentRange: {
						range: {
							startIndex: 1,
							endIndex: endIndex - 1, // Keep the trailing newline
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
