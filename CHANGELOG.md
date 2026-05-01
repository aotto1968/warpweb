# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-05-01

### Added

- **Auto-Width Mode** - Toggle button (⇔ icon, top-right) to auto-resize window width to fit all columns and height to full screen. Persisted via `config.autoWidth` in `warpweb-data.json`.
- **Full-Height Side-by-Side View** - Auto-width mode also sets window height to full screen for a consistent side-by-side view across category switches.
- **Symlink/Sandbox Support** - `warpweb.sh` refactored with 5-step JSON lookup and 3-step log directory resolution to fix EROFS errors in sandbox environments.
- **call-release.sh** - New automation tool for release workflow (commit, tag, push, GitHub release).
- **AI-Generated Changelog Drafts** - `call-release.sh --dry-run --tag <ref>` generates changelog drafts from git diff via Grok API.

### Changed

- **positionBrowserViews Promise** - Returns a proper Promise now, enabling safe chaining of post-positioning logic (`applyAutoWidth()`).
- **console-message Handler** - Updated from deprecated positional args to modern `MessageDetails` object API (Electron 41).
- **warpweb.sh Path Resolution** - Major refactoring with `find_json_file()` and `find_log_dir()` functions for multi-location priority search.
- **Keyboard Shortcut Safety** - Added radix `10` to `parseInt()` calls, NaN guards in URL change and ESC key handlers.
- **README Documentation** - Added Configuration Sources, Auto-Width Mode, and updated Header Buttons sections.

### Fixed

- **EROFS Sandbox Error** - Logs no longer try to write to read-only canonical symlink path. Resolved via `--log-dir=` argument.
- **Renderer Error Logging** - Deprecated `console-message` positional arg handler was silently dropping errors in Electron 41.
- **positionBrowserViews Retry** - Retry logic previously resolved outer promise prematurely before positioning completed.
- **screen Import** - Moved `screen` to top-level destructuring, removed dynamic `require('electron')` inside function.
- **Null Guard in applyAutoWidth** - Handles missing JSON data gracefully to prevent crashes.

## [1.0.4] - 2026-04-24

### Changed

- **Update Electron Builder** - Upgrade electron-builder from ^25.1.8 to ^26.8.1 for Electron 41 compatibility

### Added

- **Build Linux on Tag** - GitHub Actions workflow builds AppImage and .deb when tags are pushed

## [1.0.3] - 2026-04-19

### Changed

- **DOM-Based BrowserView Positioning** - BrowserViews are now positioned by querying DOM bounds from the renderer. This ensures perfect alignment with CSS flexbox layout.

### Fixed

- **Zoom in Multi-Column Mode** - `Ctrl++`/`Ctrl+-`/`Ctrl+0` now work correctly in multi-column mode. BrowserViews scale proportionally with zoom.
- **Horizontal Scroll Sync** - BrowserViews now scroll with the horizontal scrollbar in multi-column mode.
- **Large Mode Header Visibility** - In single-column (large) mode, the column header with URL bar is now visible above the BrowserView content.

### Added

- **Layout Architecture Documentation** - Added detailed comments in `main.js` explaining the zoom handling and coordinate systems.
- **Debug Logging** - `Ctrl+Shift+D` logs layout information including DOM bounds for debugging.
- **Log Rotation** - Log file is rotated on each app start (`warpweb.log` → `warpweb.log.old`).

## [1.0.2] - 2026-04-17

### Fixed

- **Removed Native Menu Bar** - Native View menu with Zoom shortcuts caused column header/content misalignment. Removed entire menu bar since all functionality is available via other controls.

## [1.0.1] - 2026-04-17

### Added

- **Zoom Content in Single-Column Mode** - `Ctrl++` and `Ctrl+-` keyboard shortcuts to zoom the content in/out when in single-column (large) mode
  - Zoom range: 50% – 300%
  - Only applies to the active single-column BrowserView

### Changed

- **Update README Documentation** - Added new zoom feature and keyboard shortcuts

[1.0.5]: https://github.com/aotto1968/warpweb/releases/tag/v1.0.5

[1.0.4]: https://github.com/aotto1968/warpweb/releases/tag/v1.0.4

[1.0.3]: https://github.com/aotto1968/warpweb/releases/tag/v1.0.3

[1.0.2]: https://github.com/aotto1968/warpweb/releases/tag/v1.0.2

[1.0.1]: https://github.com/aotto1968/warpweb/releases/tag/v1.0.1
