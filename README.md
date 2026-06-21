[한국어](README.ko.md) | English

# Memo for Chrome

A minimal Chrome extension notepad with automatic Google Drive sync.

## Features

- **Multi-file workspace** — create files organized in folders, switch between them instantly
- **Google Drive sync** — automatically backs up everything to a JSON file in your Drive
- **Light / Dark theme**
- **English / Korean UI**
- **18 font choices** — System, Korean webfonts (Pretendard, Nanum, SUIT…), Mono, and more
- **Download** — export any file as `.txt`
- **Word & character count** in the status bar

## Installation

> The extension is not published to the Chrome Web Store. Install it as an unpacked extension.

### 1. Set up a Google OAuth client

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** → Application type: **Chrome Extension**
3. Enter the extension ID from `chrome://extensions` in the **Item ID** field
4. Go to **Google Auth Platform / OAuth consent screen** → **Audience** and add your Google account under **Test users** while the app is in Testing
5. Enable the **Google Drive API** for the project

> If Google shows `403: access_denied` and says the app has not completed verification, the signed-in Google account is not allowed to use the testing OAuth app yet. Add that email as a test user, or publish/verify the OAuth app before sharing it with other accounts.

### 2. Add your client ID

Open `manifest.json` and replace the placeholder:

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  ...
}
```

### 3. Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder

## How it works

| Layer | File | Responsibility |
|---|---|---|
| UI | `extension/memo.html` + `extension/css/memo.css` | Notepad layout (title bar, menu, file tree, editor, status bar) |
| App | `extension/js/app.js` | Bootstraps the modular app |
| Logic | `extension/js/editor.js`, `extension/js/tree.js`, `extension/js/preferences.js`, `extension/js/store.js`, `extension/js/drive.js` | Editor, file tree, preferences, persistence, Drive messages |
| Background | `extension/js/background.js` | Service worker — handles Drive API calls via OAuth token |

**Sync flow:** on startup `js/drive.js` sends a `drive:load` message to the background worker. The worker scans `Drive/Memo`, rebuilds the local file tree from real Drive folders and `.txt` files, then the app polls Drive every 5 seconds for remote changes. Local edits are debounced and sent as `drive:save`.

**Storage format:** `localStorage` key `web-memo-files-v1` holds the local file tree cache. Google Drive stores each memo as an individual `.txt` file under the visible `Memo` folder, with real Drive folders for directories.

## File tree

```
Memo_for_Chrome/
├── extension/
│   ├── manifest.json       # Extension manifest (MV3)
│   ├── memo.html           # Extension page
│   ├── css/
│   │   └── memo.css
│   ├── js/
│   │   ├── app.js          # Bootstrap
│   │   ├── background.js   # Drive service worker
│   │   ├── drive.js        # Foreground sync orchestration
│   │   ├── editor.js       # Textarea, title, stats, download
│   │   ├── tree.js         # File/folder tree
│   │   ├── store.js        # localStorage cache and sync payloads
│   │   └── preferences.js  # Theme, font, language
│   └── icons/
├── store-assets/           # Chrome Web Store screenshots
├── release/                # Packaged extension ZIP files
└── privacy.html            # Privacy policy for store review
```

## Permissions

| Permission | Why |
|---|---|
| `identity` | OAuth flow for Google Drive |
| `storage` | Reserved (data currently uses localStorage) |
| `https://www.googleapis.com/*` | Drive API calls |
| `https://www.googleapis.com/auth/drive` | Read and sync files inside the Drive `Memo` folder |

## License

MIT
