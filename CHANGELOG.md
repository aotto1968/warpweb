# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- Updated `README.md` documentation with new zoom feature and keyboard shortcuts

[1.0.1]: https://github.com/aotto1968/warpweb/releases/tag/v1.0.1
