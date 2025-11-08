# Google Docs Sync for Obsidian

Bidirectional sync between Obsidian folders and Google Docs. Each folder becomes a Google Doc with notes as sections.

## Features

- 🔄 **Bidirectional sync** - Changes sync both ways
- 📁 **Folder structure preserved** - Folders → headings, files → subheadings
- 🎨 **Rich formatting** - Bold, italic, blockquotes, lists, headings
- ⚡ **Smart conflict resolution** - Auto-merge when possible, manual when needed
- 📱 **Mobile compatible** - Works on desktop and mobile
- 🏗️ **Battle-tested libraries** - Uses `marked` and `gray-matter`

## Installation

> **Note**: This plugin is not yet published to the Community Plugins directory.

### Manual Install

1. Download `main.js`, `manifest.json`, `styles.css` from [releases](https://github.com/cathy/obsidian-gdocs-sync/releases) (or build from source)
2. Create folder: `.obsidian/plugins/obsidian-gdocs-sync/` in your vault
3. Copy the three files into that folder
4. Reload Obsidian
5. Enable the plugin in **Settings → Community Plugins**

## Setup

### Get a Google API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project
3. Enable **Google Docs API** (APIs & Services → Library)
4. Create credentials: **API Key** (APIs & Services → Credentials)
5. Restrict key to Google Docs API only (recommended)

### Configure Plugin

1. Open **Settings → Google Docs Sync**
2. Paste your API key
3. Click **Validate**

Done! 🎉

## Usage

**Sync a folder:**

- Right-click folder → "Sync with Google Docs", OR
- Command palette (`Cmd/Ctrl + P`) → "Sync current folder", OR
- Click ribbon sync icon

**First sync:** Creates a new Google Doc with the folder's name

**Later syncs:** Pushes/pulls changes, or shows conflict resolution UI if both changed

### Example

```
MyFolder/
├── Introduction.md
├── Chapter1/
│   ├── Section1.md
│   └── Section2.md
└── Conclusion.md
```

Becomes a Google Doc with:

- Introduction (Heading 2)
- Chapter1 (Heading 2)
  - Section1 (Heading 3)
  - Section2 (Heading 3)
- Conclusion (Heading 2)

Files are ordered alphabetically.

## Supported Markdown

| Feature                               | Support     |
| ------------------------------------- | ----------- |
| Bold, italic, headings, lists, quotes | ✅ Full     |
| Front matter (YAML/TOML/JSON)         | ✅ Stripped |
| Links, images, code blocks, tables    | 🔜 Future   |

## Troubleshooting

**"API key is invalid"**

- Check Google Docs API is enabled
- Verify API key has no restrictions blocking it

**"403 Forbidden"**

- Free tier: 60 requests/min, 10,000/day
- Check [quotas](https://console.cloud.google.com/apis/api/docs.googleapis.com/quotas)

**Conflicts**

- Edit both versions → plugin shows diff viewer
- Choose local, remote, or cancel

## Development

```bash
npm install        # Install dependencies
npm run dev        # Watch mode
npm run build      # Production build
npm test           # Run tests
npm run validate   # Lint + format + test + build
```

**Quick test:**

```bash
npm run build
cp main.js manifest.json styles.css ~/path/to/vault/.obsidian/plugins/obsidian-gdocs-sync/
```

Then enable in Obsidian → Settings → Community Plugins.

## Privacy

- API key stored locally (not synced)
- Direct connection to Google (no third-party servers)
- No telemetry or data collection
- Recommend: Restrict API key to Google Docs API only

## Limitations

- API key auth only (OAuth planned)
- Not real-time (on-demand or periodic sync)
- Large folders may be slow
- API quota limits apply

## Contributing

PRs welcome! Please run `npm run validate` before submitting.

## License

MIT

---

Built with [Obsidian API](https://docs.obsidian.md) • [Google Docs API](https://developers.google.com/docs/api) • [marked](https://marked.js.org/) • [gray-matter](https://github.com/jonschlinkert/gray-matter)
