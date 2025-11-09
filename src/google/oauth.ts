import { OAuth2Token } from '../types';

/**
 * OAuth2 Manager for Google API authentication
 * Handles the authorization flow using loopback redirect
 */
export class OAuth2Manager {
	private static readonly AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
	private static readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
	private static readonly SCOPES = [
		'https://www.googleapis.com/auth/documents',
		'https://www.googleapis.com/auth/drive.file',
	];

	constructor(
		private clientId: string,
		private clientSecret: string
	) {}

	/**
	 * Generate the authorization URL with a loopback redirect URI
	 * @param redirectUri - The loopback redirect URI (e.g., http://127.0.0.1:PORT)
	 */
	getAuthorizationUrl(redirectUri: string): string {
		const params = new URLSearchParams({
			client_id: this.clientId,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: OAuth2Manager.SCOPES.join(' '),
			access_type: 'offline', // Request refresh token
			prompt: 'consent', // Force consent screen to ensure we get refresh token
		});

		return `${OAuth2Manager.AUTH_URL}?${params.toString()}`;
	}

	/**
	 * Exchange authorization code for access and refresh tokens
	 * @param authorizationCode - The authorization code received from the redirect
	 * @param redirectUri - The same redirect URI used in the authorization request
	 */
	async exchangeCodeForTokens(
		authorizationCode: string,
		redirectUri: string
	): Promise<{
		accessToken: OAuth2Token;
		refreshToken: string;
	}> {
		const response = await fetch(OAuth2Manager.TOKEN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: this.clientId,
				client_secret: this.clientSecret,
				code: authorizationCode,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code',
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to exchange code for tokens: ${error}`);
		}

		const data = (await response.json()) as {
			access_token: string;
			refresh_token: string;
			expires_in: number;
		};

		return {
			accessToken: {
				accessToken: data.access_token,
				expiresAt: Date.now() + data.expires_in * 1000,
			},
			refreshToken: data.refresh_token,
		};
	}

	/**
	 * Refresh an expired access token using the refresh token
	 */
	async refreshAccessToken(refreshToken: string): Promise<OAuth2Token> {
		const response = await fetch(OAuth2Manager.TOKEN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: this.clientId,
				client_secret: this.clientSecret,
				refresh_token: refreshToken,
				grant_type: 'refresh_token',
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to refresh token: ${error}`);
		}

		const data = (await response.json()) as {
			access_token: string;
			expires_in: number;
		};

		return {
			accessToken: data.access_token,
			expiresAt: Date.now() + data.expires_in * 1000,
		};
	}

	/**
	 * Check if a token is expired or about to expire (within 5 minutes)
	 */
	isTokenExpired(token: OAuth2Token | undefined): boolean {
		if (!token) return true;
		const bufferTime = 5 * 60 * 1000; // 5 minutes
		return Date.now() >= token.expiresAt - bufferTime;
	}

	/**
	 * Get a valid access token, refreshing if necessary
	 */
	async getValidAccessToken(
		currentToken: OAuth2Token | undefined,
		refreshToken: string
	): Promise<OAuth2Token> {
		if (this.isTokenExpired(currentToken)) {
			return await this.refreshAccessToken(refreshToken);
		}
		return currentToken!;
	}
}
