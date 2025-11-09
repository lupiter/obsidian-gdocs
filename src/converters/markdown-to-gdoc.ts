import { FolderNode, GoogleDocRequest } from '../types';
import { GoogleDocsAPI } from '../google/api';
import { marked, Token, Tokens } from 'marked';

/**
 * Converts markdown content to Google Docs format using the marked library
 */
export class MarkdownToGoogleDocsConverter {
	constructor(private api: GoogleDocsAPI) {}

	/**
	 * Convert a folder tree to Google Docs batch update requests
	 */
	async convertToGoogleDocs(rootNode: FolderNode, documentId: string): Promise<void> {
		// First, clear the document
		await this.api.clearDocument(documentId);

		// Build all the insert and style requests
		const requests: GoogleDocRequest[] = [];
		let currentIndex = 1; // Google Docs starts at index 1

		// Process the folder tree
		const nodes = this.flattenNodes(rootNode);

		for (const node of nodes) {
			if (node.type === 'folder') {
				// Folder becomes a heading
				const { insertRequests, styleRequests, endIndex } = this.createHeadingSection(
					node.name,
					node.level || 1,
					currentIndex
				);

				requests.push(...insertRequests, ...styleRequests);
				currentIndex = endIndex;
			} else if (node.type === 'file' && node.content) {
				// File becomes a subheading with content
				const { insertRequests, styleRequests, endIndex } = await this.createFileSection(
					node.name,
					node.content,
					node.level || 1,
					currentIndex
				);

				requests.push(...insertRequests, ...styleRequests);
				currentIndex = endIndex;
			}
		}

		// Apply all requests in one batch
		if (requests.length > 0) {
			await this.api.batchUpdate(documentId, requests);
		}
	}

	/**
	 * Flatten the folder tree, excluding the root
	 */
	private flattenNodes(node: FolderNode, includeRoot = false): FolderNode[] {
		const result: FolderNode[] = [];

		if (includeRoot) {
			result.push(node);
		}

		if (node.children) {
			for (const child of node.children) {
				result.push(child);
				if (child.children) {
					result.push(...this.flattenNodes(child, false));
				}
			}
		}

		return result;
	}

	/**
	 * Create a heading section for a folder
	 */
	private createHeadingSection(
		title: string,
		level: number,
		startIndex: number
	): { insertRequests: GoogleDocRequest[]; styleRequests: GoogleDocRequest[]; endIndex: number } {
		const insertRequests: GoogleDocRequest[] = [];
		const styleRequests: GoogleDocRequest[] = [];

		// Insert the heading text with a newline
		const text = `${title}\n`;
		insertRequests.push(this.api.createInsertTextRequest(text, startIndex));

		// Calculate end index (text length)
		const endIndex = startIndex + text.length;

		// Apply heading style
		const headingLevel = Math.min(level, 6); // Google Docs supports HEADING_1 through HEADING_6
		styleRequests.push(
			this.api.createParagraphStyleRequest(startIndex, endIndex - 1, {
				namedStyleType: `HEADING_${headingLevel}`,
			})
		);

		return { insertRequests, styleRequests, endIndex };
	}

	/**
	 * Create a file section with heading and content
	 */
	private async createFileSection(
		title: string,
		content: string,
		level: number,
		startIndex: number
	): Promise<{
		insertRequests: GoogleDocRequest[];
		styleRequests: GoogleDocRequest[];
		endIndex: number;
	}> {
		const insertRequests: GoogleDocRequest[] = [];
		const styleRequests: GoogleDocRequest[] = [];

		let currentIndex = startIndex;

		// Insert the file name as a heading
		const titleText = `${title}\n`;
		insertRequests.push(this.api.createInsertTextRequest(titleText, currentIndex));

		// Apply heading style to title
		const headingLevel = Math.min(level, 6);
		styleRequests.push(
			this.api.createParagraphStyleRequest(currentIndex, currentIndex + titleText.length - 1, {
				namedStyleType: `HEADING_${headingLevel}`,
			})
		);

		currentIndex += titleText.length;

		// Parse and insert the content using marked
		const { insertReqs, styleReqs, endIndex } = await this.parseMarkdownContent(
			content,
			currentIndex
		);

		insertRequests.push(...insertReqs);
		styleRequests.push(...styleReqs);

		return { insertRequests, styleRequests, endIndex };
	}

	/**
	 * Parse markdown content using marked and create insert/style requests
	 */
	private async parseMarkdownContent(
		content: string,
		startIndex: number
	): Promise<{ insertReqs: GoogleDocRequest[]; styleReqs: GoogleDocRequest[]; endIndex: number }> {
		const insertReqs: GoogleDocRequest[] = [];
		const styleReqs: GoogleDocRequest[] = [];
		let currentIndex = startIndex;

		// Parse markdown to tokens using marked
		const tokens = marked.lexer(content);

		// Process each token
		for (const token of tokens) {
			const result = this.processToken(token, currentIndex);
			insertReqs.push(...result.insertRequests);
			styleReqs.push(...result.styleRequests);
			currentIndex = result.endIndex;
		}

		return { insertReqs, styleReqs, endIndex: currentIndex };
	}

	/**
	 * Process a marked token and convert to Google Docs requests
	 */
	private processToken(
		token: Token,
		startIndex: number
	): { insertRequests: GoogleDocRequest[]; styleRequests: GoogleDocRequest[]; endIndex: number } {
		const insertRequests: GoogleDocRequest[] = [];
		const styleRequests: GoogleDocRequest[] = [];
		const currentIndex = startIndex;

		switch (token.type) {
			case 'paragraph':
				const paragraphResult = this.processParagraph(token as Tokens.Paragraph, currentIndex);
				return paragraphResult;

			case 'blockquote':
				const blockquoteResult = this.processBlockquote(token as Tokens.Blockquote, currentIndex);
				return blockquoteResult;

			case 'list':
				const listResult = this.processList(token as Tokens.List, currentIndex);
				return listResult;

			case 'heading':
				const headingResult = this.processHeading(token as Tokens.Heading, currentIndex);
				return headingResult;

			case 'code':
				// Skip code blocks for now (or could add as plain text)
				return { insertRequests, styleRequests, endIndex: currentIndex };

			case 'space':
				// Add a newline for spacing
				const spaceText = '\n';
				insertRequests.push(this.api.createInsertTextRequest(spaceText, currentIndex));
				return { insertRequests, styleRequests, endIndex: currentIndex + spaceText.length };

			default:
				// For other types, just add newline
				return { insertRequests, styleRequests, endIndex: currentIndex };
		}
	}

	/**
	 * Process a paragraph token
	 */
	private processParagraph(
		token: Tokens.Paragraph,
		startIndex: number
	): { insertRequests: GoogleDocRequest[]; styleRequests: GoogleDocRequest[]; endIndex: number } {
		const insertRequests: GoogleDocRequest[] = [];
		const styleRequests: GoogleDocRequest[] = [];

		// Process inline tokens
		const { text, styles } = this.processInlineTokens(token.tokens);
		const paragraphText = text + '\n';

		insertRequests.push(this.api.createInsertTextRequest(paragraphText, startIndex));

		// Apply inline styles
		for (const style of styles) {
			const textStyle: { bold?: boolean; italic?: boolean } = {};
			if (style.bold) textStyle.bold = true;
			if (style.italic) textStyle.italic = true;

			styleRequests.push(
				this.api.createTextStyleRequest(startIndex + style.start, startIndex + style.end, textStyle)
			);
		}

		return { insertRequests, styleRequests, endIndex: startIndex + paragraphText.length };
	}

	/**
	 * Process a blockquote token
	 */
	private processBlockquote(
		token: Tokens.Blockquote,
		startIndex: number
	): { insertRequests: GoogleDocRequest[]; styleRequests: GoogleDocRequest[]; endIndex: number } {
		const insertRequests: GoogleDocRequest[] = [];
		const styleRequests: GoogleDocRequest[] = [];
		let currentIndex = startIndex;

		// Process each token in the blockquote
		for (const subToken of token.tokens) {
			const result = this.processToken(subToken, currentIndex);
			insertRequests.push(...result.insertRequests);

			// Add quote styling to all text in the blockquote
			if (result.endIndex > currentIndex) {
				styleRequests.push(
					this.api.createParagraphStyleRequest(currentIndex, result.endIndex - 1, {
						namedStyleType: 'NORMAL_TEXT',
						indentStart: { magnitude: 36, unit: 'PT' },
					})
				);
				styleRequests.push(
					this.api.createTextStyleRequest(currentIndex, result.endIndex - 1, {
						italic: true,
					})
				);
			}

			styleRequests.push(...result.styleRequests);
			currentIndex = result.endIndex;
		}

		return { insertRequests, styleRequests, endIndex: currentIndex };
	}

	/**
	 * Process a list token
	 */
	private processList(
		token: Tokens.List,
		startIndex: number
	): { insertRequests: GoogleDocRequest[]; styleRequests: GoogleDocRequest[]; endIndex: number } {
		const insertRequests: GoogleDocRequest[] = [];
		const styleRequests: GoogleDocRequest[] = [];
		let currentIndex = startIndex;

		// Process each list item
		for (let i = 0; i < token.items.length; i++) {
			const item = token.items[i];
			const prefix = token.ordered ? `${i + 1}. ` : '• ';

			// Add prefix
			insertRequests.push(this.api.createInsertTextRequest(prefix, currentIndex));
			currentIndex += prefix.length;

			// Process item content
			for (const subToken of item.tokens) {
				const result = this.processToken(subToken, currentIndex);
				insertRequests.push(...result.insertRequests);
				styleRequests.push(...result.styleRequests);
				currentIndex = result.endIndex;
			}
		}

		return { insertRequests, styleRequests, endIndex: currentIndex };
	}

	/**
	 * Process a heading token
	 */
	private processHeading(
		token: Tokens.Heading,
		startIndex: number
	): { insertRequests: GoogleDocRequest[]; styleRequests: GoogleDocRequest[]; endIndex: number } {
		const insertRequests: GoogleDocRequest[] = [];
		const styleRequests: GoogleDocRequest[] = [];

		// Process inline tokens for heading text
		const { text } = this.processInlineTokens(token.tokens);
		const headingText = text + '\n';

		insertRequests.push(this.api.createInsertTextRequest(headingText, startIndex));

		// Apply heading style
		const headingLevel = Math.min(token.depth, 6);
		styleRequests.push(
			this.api.createParagraphStyleRequest(startIndex, startIndex + headingText.length - 1, {
				namedStyleType: `HEADING_${headingLevel}`,
			})
		);

		return { insertRequests, styleRequests, endIndex: startIndex + headingText.length };
	}

	/**
	 * Process inline tokens (strong, em, text, etc.) and extract text with styles
	 */
	private processInlineTokens(tokens: Token[]): {
		text: string;
		styles: Array<{ start: number; end: number; bold?: boolean; italic?: boolean }>;
	} {
		const styles: Array<{ start: number; end: number; bold?: boolean; italic?: boolean }> = [];
		let text = '';

		for (const token of tokens) {
			const startPos = text.length;

			switch (token.type) {
				case 'text':
					text += this.decodeHtmlEntities((token as Tokens.Text).text);
					break;

				case 'strong':
					const strongToken = token as Tokens.Strong;
					const strongResult = this.processInlineTokens(strongToken.tokens);
					text += strongResult.text;
					// Add bold to this segment
					styles.push({
						start: startPos,
						end: text.length,
						bold: true,
					});
					// Merge any nested styles with bold
					for (const nestedStyle of strongResult.styles) {
						styles.push({
							...nestedStyle,
							start: startPos + nestedStyle.start,
							end: startPos + nestedStyle.end,
							bold: true,
						});
					}
					break;

				case 'em':
					const emToken = token as Tokens.Em;
					const emResult = this.processInlineTokens(emToken.tokens);
					text += emResult.text;
					// Add italic to this segment
					styles.push({
						start: startPos,
						end: text.length,
						italic: true,
					});
					// Merge any nested styles with italic
					for (const nestedStyle of emResult.styles) {
						styles.push({
							...nestedStyle,
							start: startPos + nestedStyle.start,
							end: startPos + nestedStyle.end,
							italic: true,
						});
					}
					break;

				case 'codespan':
					const codeToken = token as Tokens.Codespan;
					text += this.decodeHtmlEntities(codeToken.text);
					// Could add monospace style here if desired
					break;

				case 'link':
					const linkToken = token as Tokens.Link;
					const linkResult = this.processInlineTokens(linkToken.tokens);
					text += linkResult.text;
					// Could add link styling here - for now just show text
					// TODO: Add proper link support with hyperlinks
					break;

				case 'br':
					text += '\n';
					break;

				default:
					// For other inline types, try to get text if available
					if ('text' in token && typeof (token as { text?: unknown }).text === 'string') {
						text += this.decodeHtmlEntities((token as { text: string }).text);
					}
					break;
			}
		}

		return { text, styles };
	}

	/**
	 * Decode HTML entities (like &#39; to ')
	 */
	private decodeHtmlEntities(text: string): string {
		const entities: Record<string, string> = {
			'&amp;': '&',
			'&lt;': '<',
			'&gt;': '>',
			'&quot;': '"',
			'&#39;': "'",
			'&apos;': "'",
		};

		// Replace named entities
		let decoded = text;
		for (const [entity, char] of Object.entries(entities)) {
			decoded = decoded.replace(new RegExp(entity, 'g'), char);
		}

		// Replace numeric entities (&#39;, &#x27;)
		decoded = decoded.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
		decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
			String.fromCharCode(parseInt(code, 16))
		);

		return decoded;
	}
}
