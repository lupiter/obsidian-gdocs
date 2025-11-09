import { GoogleDocsSettings } from './types';

/**
 * Default settings for the plugin
 */
export const DEFAULT_SETTINGS: GoogleDocsSettings = {
	clientId: '',
	clientSecret: '',
	refreshToken: '',
	accessToken: undefined,
	showMetadataFiles: false,
	autoSyncInterval: 0, // Disabled by default
	lastSyncStatus: undefined,
};
