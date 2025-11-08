import { GoogleDoc, GoogleDocParagraph } from '../types';

/**
 * Converts Google Docs content back to markdown
 */
export class GoogleDocsToMarkdownConverter {
	/**
	 * Convert a Google Doc to markdown text
	 */
	convertToMarkdown(doc: GoogleDoc): string {
		if (!doc.body || !doc.body.content) {
			return '';
		}

		const lines: string[] = [];

		for (const element of doc.body.content) {
			if (element.paragraph) {
				const line = this.convertParagraph(element.paragraph);
				if (line !== null) {
					lines.push(line);
				}
			}
		}

		return lines.join('\n');
	}

	/**
	 * Convert a paragraph to markdown
	 */
	private convertParagraph(paragraph: GoogleDocParagraph): string | null {
		if (!paragraph.elements || paragraph.elements.length === 0) {
			return '';
		}

		let text = '';

		for (const element of paragraph.elements) {
			if (element.textRun && element.textRun.content) {
				const content = element.textRun.content;
				const style = element.textRun.textStyle;

				// Apply markdown formatting based on text style
				let formattedText = content;

				if (style) {
					if (style.bold && style.italic) {
						formattedText = `***${content}***`;
					} else if (style.bold) {
						formattedText = `**${content}**`;
					} else if (style.italic) {
						formattedText = `*${content}*`;
					}
				}

				text += formattedText;
			}
		}

		// Remove trailing newlines from the text (we'll add them back consistently)
		text = text.replace(/\n+$/, '');

		// Check paragraph style for headings or special formatting
		if (paragraph.paragraphStyle) {
			const styleType = paragraph.paragraphStyle.namedStyleType;

			if (styleType && styleType.startsWith('HEADING_')) {
				const level = parseInt(styleType.replace('HEADING_', ''));
				const hashes = '#'.repeat(level);
				return `${hashes} ${text}`;
			}

			// Check for blockquote (indented italic text)
			if (paragraph.paragraphStyle.indentStart) {
				// If it's indented, treat as blockquote
				return `> ${text}`;
			}
		}

		return text;
	}

	/**
	 * Extract structured content (headings hierarchy) from Google Doc
	 * This is useful for parsing the document back into folders/files
	 */
	extractStructure(doc: GoogleDoc): Array<{ level: number; title: string; content: string }> {
		if (!doc.body || !doc.body.content) {
			return [];
		}

		const sections: Array<{ level: number; title: string; content: string }> = [];
		let currentSection: { level: number; title: string; content: string } | null = null;

		for (const element of doc.body.content) {
			if (element.paragraph) {
				const paragraph = element.paragraph;
				const text = this.getParagraphText(paragraph);

				if (paragraph.paragraphStyle && paragraph.paragraphStyle.namedStyleType) {
					const styleType = paragraph.paragraphStyle.namedStyleType;

					if (styleType.startsWith('HEADING_')) {
						// Save previous section if exists
						if (currentSection) {
							sections.push(currentSection);
						}

						// Start new section
						const level = parseInt(styleType.replace('HEADING_', ''));
						currentSection = {
							level,
							title: text.trim(),
							content: '',
						};
					}
				} else if (currentSection) {
					// Add content to current section
					const line = this.convertParagraph(paragraph);
					if (line !== null && line.trim() !== '') {
						currentSection.content += (currentSection.content ? '\n' : '') + line;
					}
				}
			}
		}

		// Add the last section
		if (currentSection) {
			sections.push(currentSection);
		}

		return sections;
	}

	/**
	 * Get plain text from a paragraph (no formatting)
	 */
	private getParagraphText(paragraph: GoogleDocParagraph): string {
		let text = '';

		if (paragraph.elements) {
			for (const element of paragraph.elements) {
				if (element.textRun && element.textRun.content) {
					text += element.textRun.content;
				}
			}
		}

		return text.replace(/\n+$/, '');
	}
}
