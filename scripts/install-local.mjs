#!/usr/bin/env node

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get vault path from command line argument
const vaultPath = process.argv[2];

if (!vaultPath) {
	console.error('❌ Error: Please provide a vault path');
	console.log('\nUsage:');
	console.log('  npm run install:local <vault-path>');
	console.log('\nExample:');
	console.log('  npm run install:local ~/Documents/MyVault');
	console.log('  npm run install:local "/Users/username/Documents/My Vault"');
	process.exit(1);
}

// Resolve the vault path
const resolvedVaultPath = resolve(vaultPath);

// Check if vault path exists
if (!existsSync(resolvedVaultPath)) {
	console.error(`❌ Error: Vault path does not exist: ${resolvedVaultPath}`);
	process.exit(1);
}

// Define plugin directory
const pluginId = 'obsidian-gdocs-sync';
const pluginDir = join(resolvedVaultPath, '.obsidian', 'plugins', pluginId);

try {
	// Create plugin directory if it doesn't exist
	if (!existsSync(pluginDir)) {
		console.log(`📁 Creating plugin directory: ${pluginDir}`);
		mkdirSync(pluginDir, { recursive: true });
	}

	// Copy files
	const projectRoot = resolve(__dirname, '..');
	const filesToCopy = ['main.js', 'manifest.json', 'styles.css'];

	console.log(`\n📦 Installing plugin to: ${pluginDir}\n`);

	for (const file of filesToCopy) {
		const sourcePath = join(projectRoot, file);
		const destPath = join(pluginDir, file);

		if (!existsSync(sourcePath)) {
			console.warn(`⚠️  Warning: ${file} not found (skipping)`);
			continue;
		}

		copyFileSync(sourcePath, destPath);
		console.log(`✓ Copied ${file}`);
	}

	console.log(`\n✅ Plugin installed successfully!`);
	console.log(`\n📝 Next steps:`);
	console.log(`   1. Reload Obsidian (Ctrl/Cmd + R)`);
	console.log(`   2. Enable "Google Docs Sync" in Settings → Community Plugins`);
} catch (error) {
	console.error(`\n❌ Error installing plugin: ${error.message}`);
	process.exit(1);
}

