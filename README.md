# WarpWeb

A desktop application that aggregates multiple social media feeds into a single multi-column view, built with Electron.

## Quick Start

### Installation

```bash
./warpweb.sh setup   # First time only - installs dependencies
./warpweb.sh         # Start the app
```

### Requirements

- **Node.js** 18+ (for building)
- **npm** (comes with Node.js)
- **Electron** (installed via `npm install`)

## warpweb-data.json Configuration

The `warpweb-data.json` file defines all columns and categories displayed in the app.

### Structure

```json
{
  "config": {
    "columnWidth": 464,
    "partition": "persist:warpweb-shared"
  },
  "entries": [
    {
      "category": "news",
      "items": [
        {
          "link": "https://x.com/i/lists/743696354271072257",
          "name": "news-list-1",
          "description": "Description of this column"
        }
      ]
    }
  ]
}
```

### Fields

#### config

| Field                | Description                                       |
| -------------------- | ------------------------------------------------- |
| `config.columnWidth` | Default column width in pixels (default: 400)     |
| `config.partition`   | Default browser session partition for all columns |

#### entries (category groups)

| Field                 | Description                            |
| --------------------- | -------------------------------------- |
| `entries[].category` | Category name (shown as tab)           |
| `entries[].items`     | Array of column items in this category |

#### entries[].items (column items)

| Field                  | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `items[].link`         | URL to load (Twitter/X lists, Facebook, Instagram, any) |
| `items[].name`         | Display name shown in column header                     |
| `items[].description` | Description (informational)                             |

### Override System

Values can be overridden at multiple levels. Priority: **item → category → config**

#### columnWidth Override

```json
{
  "config": { "columnWidth": 464 },
  "entries": [
    {
      "category": "news",
      "columnWidth": 600,
      "items": [
        { "link": "...", "name": "normal" },
        { "link": "...", "name": "wide", "columnWidth": 800 }
      ]
    }
  ]
}
```

#### partition Override (Browser Identity)

The `partition` setting creates separate browser sessions. This allows multiple accounts on the same website.

```json
{
  "config": { "partition": "persist:warpweb-shared" },
  "entries": [
    {
      "category": "twitter-main",
      "partition": "persist:main-account",
      "items": [ { "link": "https://x.com", "name": "main" } ]
    },
    {
      "category": "twitter-alt",
      "partition": "persist:alt-account",
      "items": [ { "link": "https://x.com", "name": "alt" } ]
    }
  ]
}
```

### Example Configuration

```json
{
  "config": {
    "columnWidth": 464,
    "partition": "persist:warpweb-shared"
  },
  "entries": [
    {
      "category": "social",
      "items": [
        { "link": "https://x.com",             "name": "twitter",   "description": "X" },
        { "link": "https://www.facebook.com",  "name": "facebook",  "description": "Facebook" },
        { "link": "https://www.instagram.com", "name": "instagram", "description": "Instagram" }
      ]
    },
    {
      "category": "work",
      "partition": "persist:work-account",
      "items": [
        { "link": "https://x.com", "name": "work1" },
        { "link": "https://x.com", "name": "work2", "columnWidth": 664 }
      ]
    }
  ]
}
```

## Features

- **Multi-column layout** - View multiple feeds side by side
- **Category tabs** - Organize columns by topic
- **BrowserView technology** - Embedded web content with full interactivity
- **Column controls** - Back, reload, and fullscreen toggle per column
- **Responsive resize** - Columns adapt to window size
- **Horizontal scroll** - Navigate many columns with scrollbar
- **JSON Editor** - Edit configuration directly in the app (BrowserView tab)
- **Help viewer** - Full documentation in BrowserView tab
- **Keyboard shortcuts** - Ctrl+Shift+I for DevTools, Ctrl+Shift+E for JSON Editor
- **Single-column mode (large-btn)** - Full-width view with URL bar
- **URL bar** - Shows current URL, allows navigation, maintains history

## Header Buttons

Three SVG icon buttons on the right side of the header:

| Button      | Icon          | Function                               |
| ----------- | ------------- | -------------------------------------- |
| JSON Editor | file/doc icon | Opens config editor as BrowserView tab |
| DevTools    | wrench icon   | Opens detached DevTools window         |
| Help        | circle-? icon | Opens documentation as BrowserView tab |

Click JSON Editor or Help again to close the tab.

## Keyboard Shortcuts

| Shortcut       | Action                   |
| -------------- | ------------------------ |
| `Ctrl+Shift+I` | Toggle detached DevTools |
| `Ctrl+Shift+E` | Open JSON Editor tab     |

## Single-Column Mode (Large View)

Click the **large-btn (⤢)** in a column header to enter single-column mode. The column expands to full window width.

### URL Bar

In single-column mode, a URL input field appears in the column header between the column name and the back button:

```
[col-name] | [URL input....................] | [←] | [⟳] | [⤢]
```

### URL Bar Features

- **Current URL display** - Shows the URL of the page currently loaded in the BrowserView
- **Manual navigation** - Type a URL and press Enter to load it
- **URL history** - Navigate through previously entered URLs

### URL History Navigation

| Key        | Action                                      |
| ---------- | ------------------------------------------- |
| `PageUp`   | Go to older URL in history                  |
| `PageDown` | Go to newer URL in history (or clear input) |
| `Enter`    | Load the typed URL and add it to history    |

URL history is stored per column in localStorage and persists across app restarts.

### Single-Column Identity

Each column in WarpWeb has its own browser session (partition). This means:

- **Separate logins** - Each column can be logged into a different account on the same website
- **Independent cookies** - Sessions do not share cookies
- **Dedicated passwords** - Password managers work per-column

Single-column mode exposes this column identity with its own URL bar and history.

## Installation & Maintenance

### Development Mode

```bash
cd warpweb
npm start         # Standard launch
npm run dev       # Launch with DevTools open
```

### Updating Dependencies

```bash
./warpweb.sh setup
```

Or manually:

```bash
cd warpweb
npm install       # Update node_modules
```

### Building Installers

Requires running on the target platform:

```bash
cd warpweb

# Linux
npm run build:linux

# Windows (on Windows)
npm run build:win

# macOS (on Mac)
npm run build:mac
```

Outputs are placed in `warpweb/dist/`:

| Platform | Format         | File                      |
| -------- | -------------- | ------------------------- |
| Linux    | AppImage       | `WarpWeb-1.0.0.AppImage`  |
| Linux    | Debian         | `warpweb_1.0.0_amd64.deb` |
| Windows  | NSIS Installer | `WarpWeb-1.0.0.exe`       |
| macOS    | DMG            | `WarpWeb-1.0.0.dmg`       |

### Installing the AppImage (All Linux Distros)

The AppImage works on any Linux distribution without installation:

```bash
chmod +x warpweb/dist/WarpWeb-1.0.0.AppImage
./warpweb/dist/WarpWeb-1.0.0.AppImage
```

Optionally install it system-wide:

```bash
sudo cp warpweb/dist/WarpWeb-1.0.0.AppImage /usr/local/bin/WarpWeb
sudo chmod +x /usr/local/bin/WarpWeb
WarpWeb  # then run from anywhere
```

### Installing the .deb Package

On Debian/Ubuntu:

```bash
sudo dpkg -i warpweb/dist/warpweb_1.0.0_amd64.deb
sudo apt-get install -f  # fix any missing dependencies
```

On openSUSE (convert with alien):

```bash
sudo alien -r warpweb/dist/warpweb_1.0.0_amd64.deb
sudo rpm -i warpweb-1.0.0-2.x86_64.rpm
```

## Security

### Data Storage

**No sensitive data is stored by WarpWeb itself.** However, be aware of the following:

#### Browser Session Data

WarpWeb uses Electron's BrowserView with **persistent partitions**. By default, all columns share one session (`persist:warpweb-shared`), but you can configure separate partitions per category or item to use multiple accounts:

- Login sessions for websites (Twitter/X, Facebook, etc.) may be stored in the browser profile
- Cookies and local storage persist between app launches
- Separate partitions = separate sessions (e.g., multiple Twitter accounts)
- Location: `~/.config/warpweb/` (Linux), `%APPDATA%\warpweb\` (Windows), `~/Library/Application Support/warpweb/` (macOS)

#### Configuration File (warpweb-data.json)

- Contains only public URLs and column definitions
- **No credentials or tokens stored**
- User controls this file completely

#### Log Files

- Location: `logs/warpweb.log`
- Contains: Timestamps, loaded URLs, errors
- **No sensitive data is logged** (only URLs which are already public)

### Software Sources

| Component | Source                    | License |
| --------- | ------------------------- | ------- |
| WarpWeb   | This project (you)        | MIT     |
| Electron  | electron-builder packages | MIT     |
| Node.js   | nodejs.org                | MIT     |

### Best Practices

1. **Close sessions when done** - If using WarpWeb on a shared computer, close the app completely to clear session data

2. **No built-in authentication** - WarpWeb relies on the websites' own login systems. Always log out of websites when finished if on a shared device

3. **URLs are visible** - Anyone with access to `warpweb-data.json` can see which sources you follow

4. **App data location** - To completely clear all stored session data:
   ```bash
   # Linux
   rm -rf ~/.config/warpweb/

   # macOS
   rm -rf ~/Library/Application\ Support/warpweb/

   # Windows
   rmdir /s %APPDATA%\warpweb\
   ```

## Troubleshooting

### "Electron not found"

Run the setup command first:

```bash
./warpweb.sh setup
```

### Columns don't load

- Check your internet connection
- Verify URLs in `warpweb-data.json` are correct
- Check `logs/warpweb.log` for error details

### App crashes or hangs

1. Close the app completely
2. Check logs: `logs/warpweb.log`
3. Try clearing BrowserView data by deleting the app config directory (see above)

## App Icon

The app icon is defined in `package.json` under `build.icon`. 

To change the icon:
1. Replace or add icon file in project root
2. Update path in `package.json` `build.icon` field
3. Rebuild: `npm run build:linux`

Supported formats: PNG (recommended 512x512), ICO (Windows).

## Layout Configuration

Layout values are defined as CSS Custom Properties in `index.html`:

```css
:root {
    --tabs-height: 38px;
    --header-height: 24px;
    --status-bar-height: 27px;
    --container-padding: 4px;
    --scrollbar-height: 12px;
}
```

### How It Works

1. **CSS** defines the visual layout as Custom Properties
2. **Renderer** measures actual rendered heights and sends to Main
3. **Main Process** uses these heights for exact BrowserView positioning

### Customizing Layout

Edit the CSS variables in `index.html`, then restart the app.

## Architecture

```
warpweb/
├── src/
│   ├── main.js      # Electron main process, BrowserView management
│   └── preload.js   # IPC bridge (context isolation)
├── index.html       # UI with Flexbox layout
├── json-editor.html # JSON configuration editor (Ace Editor)
├── README.html         # Pre-converted help documentation
├── package.json     # Dependencies and build config
└── dist/            # Built installers (after build)
```

## License

MIT License - See project repository for details.
