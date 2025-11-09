/**
 * OAuth callback server using loopback IP address
 * According to Google OAuth 2.0 documentation for native apps
 */
export class OAuthCallbackServer {
	private server: any = null;
	private port: number | null = null;

	/**
	 * Start a local HTTP server to receive the OAuth callback
	 * Returns the redirect URI and a promise that resolves with the authorization code
	 */
	async startServer(): Promise<{
		redirectUri: string;
		codePromise: Promise<string>;
	}> {
		// Use port 0 to let the system assign a random available port
		const port = await this.findAvailablePort();
		this.port = port;

		const redirectUri = `http://127.0.0.1:${port}`;

		const codePromise = new Promise<string>((resolve, reject) => {
			// In Obsidian/Electron, we can use Node.js http module
			const http = require('http');

			this.server = http.createServer((req: any, res: any) => {
				const url = new URL(req.url, redirectUri);
				const code = url.searchParams.get('code');
				const error = url.searchParams.get('error');

				if (error) {
					res.writeHead(400, { 'Content-Type': 'text/html' });
					res.end(`
						<html>
							<head><title>Authorization Error</title></head>
							<body>
								<h1>Authorization Error</h1>
								<p>Error: ${error}</p>
								<p>You can close this window.</p>
							</body>
						</html>
					`);
					this.stopServer();
					reject(new Error(`OAuth error: ${error}`));
				} else if (code) {
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end(`
						<html>
							<head><title>Authorization Successful</title></head>
							<body>
								<h1>Authorization Successful!</h1>
								<p>You can close this window and return to Obsidian.</p>
								<script>window.close()</script>
							</body>
						</html>
					`);
					this.stopServer();
					resolve(code);
				} else {
					res.writeHead(400, { 'Content-Type': 'text/html' });
					res.end(`
						<html>
							<head><title>Invalid Request</title></head>
							<body>
								<h1>Invalid Request</h1>
								<p>No authorization code received.</p>
								<p>You can close this window.</p>
							</body>
						</html>
					`);
					this.stopServer();
					reject(new Error('No authorization code received'));
				}
			});

			this.server.listen(port, '127.0.0.1', () => {
				console.log(`OAuth callback server listening on ${redirectUri}`);
			});

			this.server.on('error', (err: Error) => {
				reject(err);
			});
		});

		return { redirectUri, codePromise };
	}

	/**
	 * Find an available port
	 */
	private async findAvailablePort(): Promise<number> {
		const http = require('http');

		return new Promise((resolve, reject) => {
			const server = http.createServer();
			server.listen(0, '127.0.0.1', () => {
				const port = server.address().port;
				server.close(() => resolve(port));
			});
			server.on('error', reject);
		});
	}

	/**
	 * Stop the callback server
	 */
	stopServer(): void {
		if (this.server) {
			this.server.close();
			this.server = null;
			this.port = null;
		}
	}
}

