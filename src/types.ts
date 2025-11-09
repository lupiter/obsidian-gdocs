/**
 * Core types for Google Docs sync plugin
 */

/**
 * Metadata stored in .sync-metadata.json file within synced folders
 */
export interface SyncMetadata {
	/** Google Doc ID */
	googleDocId: string;
	/** Last sync timestamp (ISO 8601) */
	lastSyncTime: string;
	/** Folder path relative to vault root */
	folderPath: string;
	/** Content hash for change detection (local) */
	contentHash: string;
	/** Content hash of remote document for change detection */
	remoteContentHash?: string;
	/** Google Doc revision ID for conflict detection */
	revisionId?: string;
}

/**
 * Represents a file or folder in the Obsidian vault
 */
export interface FolderNode {
	/** Node name (file or folder name) */
	name: string;
	/** Full path in vault */
	path: string;
	/** Node type */
	type: 'file' | 'folder';
	/** Children (for folders) */
	children?: FolderNode[];
	/** Markdown content (for files) */
	content?: string;
	/** Heading level (1-6, calculated from depth) */
	level?: number;
}

/**
 * Google Docs API document structure
 */
export interface GoogleDoc {
	documentId: string;
	title: string;
	body: GoogleDocBody;
	revisionId: string;
}

export interface GoogleDocBody {
	content: GoogleDocElement[];
}

export interface GoogleDocElement {
	paragraph?: GoogleDocParagraph;
	horizontalRule?: GoogleDocHorizontalRule;
	startIndex?: number;
	endIndex?: number;
}

export interface GoogleDocHorizontalRule {
	// HorizontalRule has no properties in the API, it's just a marker
}

export interface GoogleDocParagraph {
	elements: GoogleDocTextElement[];
	paragraphStyle?: GoogleDocParagraphStyle;
}

export interface GoogleDocTextElement {
	textRun?: {
		content: string;
		textStyle?: GoogleDocTextStyle;
	};
}

export interface GoogleDocTextStyle {
	bold?: boolean;
	italic?: boolean;
}

export interface GoogleDocParagraphStyle {
	namedStyleType?: string;
	indentStart?: GoogleDocDimension;
}

/**
 * Google Docs dimension (for spacing, indents, etc.)
 */
export interface GoogleDocDimension {
	magnitude: number;
	unit: 'PT' | 'PX';
}

/**
 * Sync operation result
 */
export interface SyncResult {
	success: boolean;
	message: string;
	documentId?: string;
	documentUrl?: string;
	conflicts?: ConflictInfo[];
	error?: string;
}

/**
 * Information about a sync conflict
 */
export interface ConflictInfo {
	type: 'content' | 'structure';
	localVersion: string;
	remoteVersion: string;
	description: string;
}

/**
 * Content diff for conflict resolution
 */
export interface ContentDiff {
	type: 'added' | 'removed' | 'modified';
	location: string;
	oldValue?: string;
	newValue?: string;
}

/**
 * Google Docs API location (index in document)
 */
export interface GoogleDocLocation {
	index: number;
}

/**
 * Google Docs API range (start and end indices)
 */
export interface GoogleDocRange {
	startIndex: number;
	endIndex: number;
}

/**
 * Google Docs API request (simplified - we only define what we use)
 */
export interface GoogleDocRequest {
	insertText?: {
		text: string;
		location: GoogleDocLocation;
	};
	updateParagraphStyle?: {
		range: GoogleDocRange;
		paragraphStyle: Partial<GoogleDocParagraphStyle>;
		fields: string;
	};
	updateTextStyle?: {
		range: GoogleDocRange;
		textStyle: Partial<GoogleDocTextStyle>;
		fields: string;
	};
	deleteContentRange?: {
		range: GoogleDocRange;
	};
}

/**
 * Batch update request for Google Docs API
 */
export interface BatchUpdateRequest {
	requests: GoogleDocRequest[];
}

/**
 * Batch update response from Google Docs API
 */
export interface BatchUpdateResponse {
	documentId: string;
	replies?: unknown[]; // API returns various reply types we don't use
}

/**
 * OAuth2 token information
 */
export interface OAuth2Token {
	/** Access token for API requests */
	accessToken: string;
	/** Token expiry time (Unix timestamp in milliseconds) */
	expiresAt: number;
}

/**
 * Settings for the plugin
 */
export interface GoogleDocsSettings {
	/** OAuth2 Client ID from Google Cloud Console */
	clientId: string;
	/** OAuth2 Client Secret from Google Cloud Console */
	clientSecret: string;
	/** OAuth2 Refresh Token (generated once, used to get access tokens) */
	refreshToken: string;
	/** Current OAuth2 access token (auto-refreshed) */
	accessToken?: OAuth2Token;
	/** Whether to show hidden files (like .sync-metadata.json) */
	showMetadataFiles: boolean;
	/** Auto-sync interval in minutes (0 = disabled) */
	autoSyncInterval: number;
	/** Last sync status message */
	lastSyncStatus?: string;
}
