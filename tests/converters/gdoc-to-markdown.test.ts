import { GoogleDocsToMarkdownConverter } from '../../src/converters/gdoc-to-markdown';
import { GoogleDoc } from '../../src/types';

describe('GoogleDocsToMarkdownConverter', () => {
	let converter: GoogleDocsToMarkdownConverter;

	beforeEach(() => {
		converter = new GoogleDocsToMarkdownConverter();
	});

	describe('convertToMarkdown', () => {
		it('should convert simple text paragraph', () => {
			const doc: GoogleDoc = {
				documentId: 'test',
				title: 'Test',
				revisionId: 'rev1',
				body: {
					content: [
						{
							paragraph: {
								elements: [
									{
										textRun: {
											content: 'Hello World\n',
										},
									},
								],
							},
						},
					],
				},
			};

			const result = converter.convertToMarkdown(doc);
			expect(result).toContain('Hello World');
		});

		it('should convert bold text', () => {
			const doc: GoogleDoc = {
				documentId: 'test',
				title: 'Test',
				revisionId: 'rev1',
				body: {
					content: [
						{
							paragraph: {
								elements: [
									{
										textRun: {
											content: 'Bold text',
											textStyle: { bold: true },
										},
									},
								],
							},
						},
					],
				},
			};

			const result = converter.convertToMarkdown(doc);
			expect(result).toMatch(/\*\*Bold text\*\*/);
		});

		it('should convert italic text', () => {
			const doc: GoogleDoc = {
				documentId: 'test',
				title: 'Test',
				revisionId: 'rev1',
				body: {
					content: [
						{
							paragraph: {
								elements: [
									{
										textRun: {
											content: 'Italic text',
											textStyle: { italic: true },
										},
									},
								],
							},
						},
					],
				},
			};

			const result = converter.convertToMarkdown(doc);
			expect(result).toMatch(/\*Italic text\*/);
		});

		it('should convert headings', () => {
			const doc: GoogleDoc = {
				documentId: 'test',
				title: 'Test',
				revisionId: 'rev1',
				body: {
					content: [
						{
							paragraph: {
								elements: [
									{
										textRun: {
											content: 'Heading\n',
										},
									},
								],
								paragraphStyle: {
									namedStyleType: 'HEADING_1',
								},
							},
						},
					],
				},
			};

			const result = converter.convertToMarkdown(doc);
			expect(result).toContain('# Heading');
		});
	});

	describe('extractStructure', () => {
		it('should extract heading hierarchy', () => {
			const doc: GoogleDoc = {
				documentId: 'test',
				title: 'Test',
				revisionId: 'rev1',
				body: {
					content: [
						{
							paragraph: {
								elements: [{ textRun: { content: 'Section 1\n' } }],
								paragraphStyle: { namedStyleType: 'HEADING_1' },
							},
						},
						{
							paragraph: {
								elements: [{ textRun: { content: 'Content here\n' } }],
							},
						},
						{
							paragraph: {
								elements: [{ textRun: { content: 'Section 2\n' } }],
								paragraphStyle: { namedStyleType: 'HEADING_2' },
							},
						},
					],
				},
			};

			const structure = converter.extractStructure(doc);

			expect(structure).toHaveLength(2);
			expect(structure[0].level).toBe(1);
			expect(structure[0].title).toBe('Section 1');
			expect(structure[0].content).toContain('Content here');
			expect(structure[1].level).toBe(2);
			expect(structure[1].title).toBe('Section 2');
		});
	});
});
