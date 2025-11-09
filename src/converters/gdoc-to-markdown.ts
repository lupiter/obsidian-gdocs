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
		let previousWasHeading = false;

		for (const element of doc.body.content) {
			if (element.paragraph) {
				const line = this.convertParagraph(element.paragraph);
				if (line !== null && line.trim() !== '') {
					const isHeading = line.startsWith('#');
					
					// Add appropriate spacing
					if (lines.length > 0) {
						// Always add double newline before headings (except first line)
						// Add double newline between paragraphs for proper Markdown spacing
						if (isHeading || !previousWasHeading) {
							lines.push('');
						}
					}
					
					lines.push(line);
					previousWasHeading = isHeading;
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

		// Check if this looks like a horizontal rule (line of dashes)
		if (/^[-]{3,}$/.test(text.trim())) {
			return '---';
		}

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

		console.log('Extracting structure from doc with', doc.body.content.length, 'elements');

		const sections: Array<{ level: number; title: string; content: string }> = [];
		let currentSection: { level: number; title: string; content: string } | null = null;

		for (const element of doc.body.content) {
			if (element.paragraph) {
				const paragraph = element.paragraph;
				const text = this.getParagraphText(paragraph);
				const styleType = paragraph.paragraphStyle?.namedStyleType;

				console.log('Processing paragraph:', {
					text: text.substring(0, 50),
					styleType,
					hasElements: !!paragraph.elements,
					elementsCount: paragraph.elements?.length,
				});

				if (styleType && styleType.startsWith('HEADING_')) {
					// Save previous section if exists
					if (currentSection) {
						console.log('Saving section:', currentSection.title, 'with content length:', currentSection.content.length);
						sections.push(currentSection);
					}

					// Start new section
					const level = parseInt(styleType.replace('HEADING_', ''));
					currentSection = {
						level,
						title: text.trim(),
						content: '',
					};
					console.log('Started new section:', currentSection.title, 'at level', level);
				} else if (currentSection && text.trim() !== '') {
					// Add content to current section (skip empty paragraphs)
					const line = this.convertParagraph(paragraph);
					if (line !== null && line.trim() !== '') {
						// Use double newline for Markdown paragraph separation
						currentSection.content += (currentSection.content ? '\n\n' : '') + line;
						console.log('Added content to section:', currentSection.title, '- line:', line.substring(0, 50));
					}
				}
			}
		}

		// Add the last section
		if (currentSection) {
			console.log('Saving final section:', currentSection.title, 'with content length:', currentSection.content.length);
			sections.push(currentSection);
		}

		console.log('Extracted', sections.length, 'sections');
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
