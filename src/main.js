const { app, BrowserWindow, BrowserView, ipcMain, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.error('WarpWeb is already running. Exiting.');
    app.quit();
}

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

let mainWindow;
let logStream;
let browserViews = new Map();
let currentCategory = null;
let columnWidth = 400;
let partition = 'persist:warpweb-shared';
let scrollX = 0;
let scrollbarVisible = true;
let cachedData = null;
let largeColumnKey = null;
let columnConfigCache = new Map();
let dataHash = null;
let helpView = null;
let jsonEditorView = null;
let zoomFactor = 1.0;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

function shouldRebuildCache(data) {
    const hash = JSON.stringify(data.entries || data);
    if (hash === dataHash) return false;
    dataHash = hash;
    return true;
}

function buildColumnConfigCache(entries) {
    columnConfigCache.clear();
    for (const cat of entries) {
        for (let i = 0; i < (cat.items || []).length; i++) {
            const key = `${cat.category}-${i}`;
            const item = cat.items[i];
            columnConfigCache.set(key, {
                columnWidth: item.columnWidth || cat.columnWidth || columnWidth,
                partition: item.partition || cat.partition || partition
            });
        }
    }
}

function initLogging() {
    const logsDir = path.join(__dirname, '..', '..', 'logs');
    if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFile = path.join(logsDir, 'warpweb.log');
    const logOldFile = path.join(logsDir, 'warpweb.log.old');
    if (fs.existsSync(logFile)) {
        if (fs.existsSync(logOldFile)) {
            fs.unlinkSync(logOldFile);
        }
        fs.renameSync(logFile, logOldFile);
    }
    logStream = fs.createWriteStream(logFile, { flags: 'w' });
    logStream.write(`\n=== WarpWeb started at ${new Date().toISOString()} ===\n`);
    logStream.write(`[Info] Log file: ${logFile}\n`);
}

function getJsonPath() {
    for (const arg of process.argv) {
        if (arg.startsWith('--json=')) {
            return path.normalize(arg.split('=')[1]);
        }
    }
    if (app.isPackaged) {
        const packedJson = path.join(process.resourcesPath, 'warpweb-data.json');
        if (fs.existsSync(packedJson)) {
            return path.normalize(packedJson);
        }
    } else {
        const externalJson = path.join(__dirname, '..', '..', 'warpweb-data.json');
        if (fs.existsSync(externalJson)) {
            return path.normalize(externalJson);
        }
    }
    return path.normalize(path.join(__dirname, '..', 'warpweb-data.json'));
}

function loadWarpWebJson(jsonPath) {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content);
}

function getCachedData() {
    if (!cachedData) {
        const jsonPath = getJsonPath();
        if (fs.existsSync(jsonPath)) {
            cachedData = loadWarpWebJson(jsonPath);
        }
    }
    return cachedData;
}

function groupByCategory(entries) {
    const categories = {};
    for (const cat of entries) {
        categories[cat.category] = cat.items || [];
    }
    return categories;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const { Menu } = require('electron');
    Menu.setApplicationMenu(null);

    let resizeTimeout;
    mainWindow.on('resized', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            positionBrowserViews();
            const [width, height] = mainWindow.getContentSize();
            if (helpView) {
                helpView.setBounds({ x: 0, y: HELP_HEADER_HEIGHT, width, height: height - HELP_HEADER_HEIGHT });
            }
            if (jsonEditorView) {
                jsonEditorView.setBounds({ x: 0, y: 0, width, height });
            }
        }, 100);
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.control && input.shift) {
            if (input.key.toLowerCase() === 'i') {
                event.preventDefault();
                if (mainWindow.webContents.isDevToolsOpened()) {
                    mainWindow.webContents.closeDevTools();
                } else {
                    mainWindow.webContents.openDevTools({ mode: 'detach' });
                }
            } else if (input.key.toLowerCase() === 'e') {
                event.preventDefault();
                showJsonEditor();
            } else if (input.key.toLowerCase() === 'd') {
                event.preventDefault();
                logLayoutDebug();
            }
        } else if (input.type === 'keyDown' && input.control && !input.shift) {
            if (input.key === '=' || input.key === '+' || input.key === 'Add') {
                event.preventDefault();
                zoomIn();
            } else if (input.key === '-' || input.key === 'Subtract') {
                event.preventDefault();
                zoomOut();
            } else if (input.key === '0') {
                event.preventDefault();
                zoomReset();
            }
        }
    });

    mainWindow.webContents.on('zoom-changed', (event, zoomDirection) => {
        setTimeout(() => {
            positionBrowserViews();
            logStream.write(`[Info] Zoom changed (menu): ${mainWindow.webContents.getZoomFactor()}\n`);
        }, 10);
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        logStream.write(`[Error] Renderer process gone: ${details.reason}\n`);
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (level >= 2) {
            logStream.write(`[Renderer ${level}] ${message} (line ${line})\n`);
        }
    });

    ipcMain.on('open-toplevel-devtools', () => {
        if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
        } else {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    ipcMain.on('show-json-editor', () => {
        showJsonEditor();
    });

    ipcMain.on('close-json-editor', () => {
        if (jsonEditorView && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeBrowserView(jsonEditorView);
            jsonEditorView.webContents.destroy();
            jsonEditorView = null;
        }
    });
}

function showJsonEditor() {
    if (jsonEditorView) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeBrowserView(jsonEditorView);
        }
        jsonEditorView.webContents?.destroy();
        jsonEditorView = null;
        return;
    }

    if (helpView) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeBrowserView(helpView);
        }
        helpView.webContents?.destroy();
        helpView = null;
    }

    const [width, height] = mainWindow.getContentSize();
    jsonEditorView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.addBrowserView(jsonEditorView);
    jsonEditorView.setBounds({ x: 0, y: 0, width, height });
    jsonEditorView.webContents.loadFile(path.join(__dirname, '..', 'json-editor.html'));
    logStream.write('[Info] JSON Editor opened as tab\n');
}

function openBrowserView(category, columnIndex, url) {
    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            logStream.write(`[Warning] ${url} load timeout, resolving anyway\n`);
            resolve();
        }, 10000);
        logStream.write(`[${new Date().toISOString()}] Opening BrowserView: ${url}\n`);

        if (!currentCategory) {
            currentCategory = category;
        }

        const key = `${category}-${columnIndex}`;

        if (browserViews.has(key)) {
            resolve();
            return;
        }

        if (!mainWindow) {
            resolve();
            return;
        }

        const view = new BrowserView({
            webPreferences: {
                contextIsolation: true,
                partition: getPartitionForKey(key)
            }
        });

        mainWindow.addBrowserView(view);
        browserViews.set(key, view);

        view.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            clearTimeout(timeout);
            logStream.write(`[Error] Failed to load ${url}: ${errorDescription}\n`);
            resolve();
        });

        view.webContents.on('did-finish-load', () => {
            clearTimeout(timeout);
            logStream.write(`[Info] Loaded ${url} successfully\n`);
            resolve();
        });

        // did-change-url fires when BrowserView navigates to a new URL
        // This syncs the URL to the URL input field in the renderer
        // NOTE: This event may fire BEFORE the URL bar exists (race condition)
        // The renderer handles this with a getUrl() fallback after navigation
        view.webContents.on('did-change-url', (event, newUrl) => {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('url-changed', { key, url: newUrl });
            }
        });

        view.webContents.setWindowOpenHandler(({ url }) => {
            logStream.write(`[Info] Opening external: ${url}\n`);
            shell.openExternal(url).catch(e => {
                logStream.write(`[Error] Failed to open external: ${e.message}\n`);
            });
            return { action: 'deny' };
        });

        view.webContents.loadURL(url);

        try {
            positionBrowserViews();
        } catch (e) {
            logStream.write(`[Error] positionBrowserViews failed: ${e.message}\n`);
        }
    });
}

function getColumnWidthForKey(key) {
    const config = columnConfigCache.get(key);
    return config?.columnWidth ?? columnWidth;
}

function getPartitionForKey(key) {
    const config = columnConfigCache.get(key);
    return config?.partition ?? partition;
}

const LAYOUT_CONFIG = {
    tabs: 38,
    header: 24,
    statusBar: 27,
    containerPadding: 4,
    scrollbar: 12
};

let layoutHeights = { ...LAYOUT_CONFIG };

/**
 * LAYOUT & ZOOM ARCHITECTURE
 *
 * WarpWeb uses a DOM-based positioning system for BrowserViews:
 *
 * 1. DOM-BASED POSITIONING (positionBrowserViews)
 *    - BrowserViews are positioned by querying the DOM (index.html) for exact element bounds
 *    - We read getBoundingClientRect() from the renderer via executeJavaScript()
 *    - This ensures BrowserViews align perfectly with the CSS flexbox layout
 *
 * 2. ZOOM HANDLING
 *    - Electron's zoomFactor affects CSS pixel values returned by getBoundingClientRect()
 *    - At zoom=1.0: CSS pixels = physical pixels
 *    - At zoom=1.1: containerBounds.width = 1090 (1200/1.1) - DOM reports CSS pixels
 *    - BrowserView.setBounds() requires PHYSICAL pixels
 *    - Solution: multiply bounds by zoomFactor when setting BrowserView bounds
 *
 * 3. INFORMATION FLOW
 *    Renderer (index.html)
 *      → CSS flexbox layout defines column positions
 *      → DOM elements have bounds (CSS pixels, affected by zoom)
 *      → Main process queries via executeJavaScript()
 *      → Main process multiplies by zoomFactor
 *      → Main process calls BrowserView.setBounds() with physical pixels
 *
 * 4. ZOOM MODES
 *    Single-column (largeColumnKey set):
 *      - BrowserView covers only the content area (below column header)
 *      - Column header (with URL bar) is a DOM overlay - always visible
 *      - Zoom applies to BrowserView content via webContents.setZoomFactor()
 *
 *    Multi-column (largeColumnKey null):
 *      - Each BrowserView positioned on its column's placeholder element
 *      - Bounds scaled by zoomFactor for physical pixel correct positioning
 *      - Zoom applies to main window, columns scale proportionally
 *
 * 5. KEY COORDINATE SYSTEMS
 *    - CSS pixels: returned by getBoundingClientRect(), affected by zoom
 *    - Physical pixels: actual screen pixels, used by BrowserView.setBounds()
 *    - Conversion: physical = css * zoomFactor
 */

function logLayoutDebug() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        logStream.write('[Debug] mainWindow is null or destroyed\n');
        return;
    }
    const [windowWidth, windowHeight] = mainWindow.getContentSize();
    const zoomFactor = largeColumnKey === null ? mainWindow.webContents.getZoomFactor() : 1.0;
    logStream.write(`\n=== LAYOUT DEBUG ===\n`);
    logStream.write(`windowSize: ${windowWidth}x${windowHeight}\n`);
    logStream.write(`zoomFactor: ${zoomFactor}\n`);
    logStream.write(`largeColumnKey: ${largeColumnKey}\n`);
    logStream.write(`currentCategory: ${currentCategory}\n`);
    logStream.write(`layoutHeights: tabs=${layoutHeights.tabs}, header=${layoutHeights.header}, statusBar=${layoutHeights.statusBar}, containerPadding=${layoutHeights.containerPadding}, scrollbar=${layoutHeights.scrollbar}\n`);

    mainWindow.webContents.executeJavaScript(`
        (function() {
            const result = {};
            const tabs = document.getElementById('tabs');
            const columnsContainer = document.getElementById('columns-container');
            const statusBar = document.querySelector('.status-bar');
            const columns = document.querySelectorAll('.column');

            result.tabsBounds = tabs ? JSON.stringify(tabs.getBoundingClientRect()) : null;
            result.containerBounds = columnsContainer ? JSON.stringify(columnsContainer.getBoundingClientRect()) : null;
            result.statusBarBounds = statusBar ? JSON.stringify(statusBar.getBoundingClientRect()) : null;
            result.columns = [];
            columns.forEach((col, i) => {
                const header = col.querySelector('.col-header');
                const placeholder = col.querySelector('.col-placeholder');
                result.columns.push({
                    index: i,
                    bounds: JSON.stringify(col.getBoundingClientRect()),
                    headerBounds: header ? JSON.stringify(header.getBoundingClientRect()) : null,
                    placeholderBounds: placeholder ? JSON.stringify(placeholder.getBoundingClientRect()) : null
                });
            });
            return JSON.stringify(result, null, 2);
        })()
    `).then(json => {
        logStream.write('DOM bounds (from renderer):\\n' + json + '\\n');
        logStream.write('==================\\n\\n');
    }).catch(e => {
        logStream.write('DOM query failed: ' + e.message + '\\n');
        logStream.write('==================\\n\\n');
    });
}

function positionBrowserViews(retryCount = 0) {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
        return;
    }

    if (browserViews.size === 0) {
        return;
    }

    mainWindow.webContents.executeJavaScript(`
        (function() {
            const container = document.getElementById('columns-container');
            if (!container) return null;
            const columns = document.querySelectorAll('.column');
            const tabs = document.getElementById('tabs');
            const statusBar = document.querySelector('.status-bar');
            const containerRect = container.getBoundingClientRect();
            const result = {
                containerBounds: { left: containerRect.left, top: containerRect.top, width: containerRect.width, height: containerRect.height },
                tabsBounds: null,
                statusBarBounds: null,
                columnCount: columns.length,
                columns: []
            };
            if (tabs) {
                const r = tabs.getBoundingClientRect();
                result.tabsBounds = { left: r.left, top: r.top, width: r.width, height: r.height };
            }
            if (statusBar) {
                const r = statusBar.getBoundingClientRect();
                result.statusBarBounds = { left: r.left, top: r.top, width: r.width, height: r.height };
            }
            columns.forEach((col, i) => {
                const placeholder = col.querySelector('.col-placeholder');
                const colRect = col.getBoundingClientRect();
                const placeholderRect = placeholder ? placeholder.getBoundingClientRect() : null;
                result.columns.push({
                    index: i,
                    bounds: { left: colRect.left, top: colRect.top, width: colRect.width, height: colRect.height },
                    placeholderBounds: placeholderRect ? { left: placeholderRect.left, top: placeholderRect.top, width: placeholderRect.width, height: placeholderRect.height } : null
                });
            });
            return result;
        })()
    `).then(data => {
        if (!data) {
            if (retryCount < 3) {
                setTimeout(() => positionBrowserViews(retryCount + 1), 100);
            }
            return;
        }

        const zoom = mainWindow.webContents.getZoomFactor();
        const gap = 8;

        for (const [key, view] of browserViews) {
            const [viewCategory, idxStr] = key.split('-');
            const columnIndex = parseInt(idxStr);

            if (viewCategory !== currentCategory) {
                view.setBounds({ x: -9999, y: 0, width: 0, height: 0 });
                continue;
            }

            if (largeColumnKey !== null && largeColumnKey !== key) {
                view.setBounds({ x: -9999, y: 0, width: 0, height: 0 });
                continue;
            }

            const colData = data.columns[columnIndex];
            if (!colData || !colData.placeholderBounds) {
                continue;
            }

            const colWidth = colData.placeholderBounds.width * zoom;
            let xPos = data.containerBounds.left + layoutHeights.containerPadding - scrollX;
            for (let i = 0; i < columnIndex; i++) {
                const prevCol = data.columns[i];
                if (prevCol && prevCol.placeholderBounds) {
                    xPos += prevCol.placeholderBounds.width * zoom + gap;
                }
            }

            let b;
            if (largeColumnKey === key) {
                const contentTop = colData.placeholderBounds.top * zoom;
                const contentHeight = colData.placeholderBounds.height * zoom;
                b = { x: 0, y: contentTop, width: data.containerBounds.width * zoom, height: contentHeight };
            } else {
                b = { x: xPos, y: colData.placeholderBounds.top * zoom, width: colWidth, height: colData.placeholderBounds.height * zoom };
            }
            view.setBounds(b);
        }
    }).catch(e => {
        logStream.write(`[Error] positionBrowserViews: ${e.message}\n`);
    });
}

function showCategory(category) {
    currentCategory = category;
    positionBrowserViews();
}

ipcMain.on('show-category', (event, category) => {
    showCategory(category);
});

ipcMain.on('set-scroll-x', (event, x) => {
    scrollX = x;
    positionBrowserViews();
});

ipcMain.on('set-container-height', (event, { scrollbarVisible: visible }) => {
    scrollbarVisible = visible;
    positionBrowserViews();
});

// go-back handler using navigationHistory API
// NOTE: webContents.goBack/canGoBack are deprecated since Electron 30+
// Use webContents.navigationHistory.goBack/canGoBack instead
ipcMain.handle('go-back', async (event, columnIndex) => {
    const key = `${currentCategory}-${columnIndex}`;
    if (browserViews.has(key)) {
        const view = browserViews.get(key);
        const hist = view.webContents.navigationHistory;
        if (hist.canGoBack()) {
            hist.goBack();
            return true;
        }
    }
    return false;
});

ipcMain.on('reload-url', (event, columnIndex) => {
    const key = `${currentCategory}-${columnIndex}`;
    if (browserViews.has(key)) {
        const view = browserViews.get(key);
        view.webContents.reload();
    }
});

function zoomIn() {
    if (largeColumnKey !== null) {
        const view = browserViews.get(largeColumnKey);
        if (!view || !view.webContents) return;
        zoomFactor = Math.min(zoomFactor + ZOOM_STEP, MAX_ZOOM);
        view.webContents.setZoomFactor(zoomFactor);
        logStream.write(`[Info] Zoom in (single): ${zoomFactor}\n`);
    } else {
        const currentZoom = mainWindow.webContents.getZoomFactor();
        mainWindow.webContents.setZoomFactor(currentZoom + ZOOM_STEP);
        logStream.write(`[Info] Zoom in (multi): ${currentZoom + ZOOM_STEP}\n`);
        positionBrowserViews();
    }
}

function zoomOut() {
    if (largeColumnKey !== null) {
        const view = browserViews.get(largeColumnKey);
        if (!view || !view.webContents) return;
        zoomFactor = Math.max(zoomFactor - ZOOM_STEP, MIN_ZOOM);
        view.webContents.setZoomFactor(zoomFactor);
        logStream.write(`[Info] Zoom out (single): ${zoomFactor}\n`);
    } else {
        const currentZoom = mainWindow.webContents.getZoomFactor();
        const newZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
        mainWindow.webContents.setZoomFactor(newZoom);
        logStream.write(`[Info] Zoom out (multi): ${newZoom}\n`);
        positionBrowserViews();
    }
}

function zoomReset() {
    if (largeColumnKey !== null) {
        const view = browserViews.get(largeColumnKey);
        if (!view || !view.webContents) return;
        zoomFactor = 1.0;
        view.webContents.setZoomFactor(zoomFactor);
        logStream.write(`[Info] Zoom reset (single): ${zoomFactor}\n`);
    } else {
        mainWindow.webContents.setZoomFactor(1.0);
        logStream.write(`[Info] Zoom reset (multi): 1.0\n`);
        positionBrowserViews();
    }
}

ipcMain.on('toggle-large', (event, columnIndex) => {
    const key = `${currentCategory}-${columnIndex}`;
    if (largeColumnKey === key) {
        largeColumnKey = null;
    } else {
        largeColumnKey = key;
    }
    positionBrowserViews();
    event.sender.send('large-changed', { key: largeColumnKey });
});

ipcMain.on('clear-all-views', () => {
    for (const [key, view] of browserViews) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeBrowserView(view);
        }
        view.webContents.destroy();
    }
    browserViews.clear();
    currentCategory = null;
    largeColumnKey = null;
});

ipcMain.handle('open-url', async (event, { category, columnIndex, url }) => {
    if (!currentCategory) {
        currentCategory = category;
    }
    await openBrowserView(category, columnIndex, url);
});

// get-url: Returns current URL of BrowserView
// Used as fallback when did-change-url fires but URL bar doesn't exist yet
ipcMain.handle('get-url', (event, columnIndex) => {
    const key = `${currentCategory}-${columnIndex}`;
    if (browserViews.has(key)) {
        const view = browserViews.get(key);
        return view.webContents.getURL();
    }
    return null;
});

ipcMain.on('log-error', (event, msg) => {
    logStream.write(`[Renderer Error] ${msg}\n`);
});

ipcMain.on('set-layout-heights', (event, heights) => {
    Object.assign(layoutHeights, heights);
    positionBrowserViews();
});

// navigate-url: Loads a URL in the BrowserView when user presses Enter
// The did-change-url event will fire after navigation completes
ipcMain.on('navigate-url', (event, { columnIndex, url }) => {
    const key = `${currentCategory}-${columnIndex}`;
    if (browserViews.has(key)) {
        const view = browserViews.get(key);
        view.webContents.loadURL(url);
    }
});

ipcMain.handle('get-url-history', (event, columnIndex) => {
    return [];
});

ipcMain.handle('save-url-history', (event, { columnIndex, history }) => {
    return { success: true };
});

const HELP_URL = 'https://github.com/aotto1968/warpweb/blob/master/README.md';
const HELP_HEADER_HEIGHT = 38;

ipcMain.on('show-help', (event) => {
    if (helpView) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeBrowserView(helpView);
        }
        helpView.webContents?.destroy();
        helpView = null;
        event.sender.send('help-visibility-changed', false);
        return;
    }

    helpView = new BrowserView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    mainWindow.addBrowserView(helpView);
    const [width, height] = mainWindow.getContentSize();
    helpView.setBounds({ x: 0, y: HELP_HEADER_HEIGHT, width, height: height - HELP_HEADER_HEIGHT });

    helpView.webContents.loadURL(HELP_URL);

    helpView.webContents.on('did-finish-load', () => {
        logStream.write('[Info] Help page loaded\n');
        event.sender.send('help-url-changed', HELP_URL);
    });

    helpView.webContents.on('did-change-url', (event, url) => {
        event.sender.send('help-url-changed', url);
    });

    helpView.webContents.on('go-back-changed', (event, canGoBack) => {
        event.sender.send('help-can-go-back', canGoBack);
    });

    helpView.webContents.on('close', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeBrowserView(helpView);
        }
        helpView.webContents?.destroy();
        helpView = null;
        event.sender.send('help-visibility-changed', false);
    });

    event.sender.send('help-visibility-changed', true);
    logStream.write('[Info] Showing help view\n');
});

ipcMain.on('help-back', () => {
    if (helpView && helpView.webContents.canGoBack()) {
        helpView.webContents.goBack();
    }
});

ipcMain.on('help-reload', () => {
    if (helpView) {
        helpView.webContents.reload();
    }
});

ipcMain.on('help-close', () => {
    if (helpView) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeBrowserView(helpView);
        }
        helpView.webContents?.destroy();
        helpView = null;
    }
});

ipcMain.handle('get-data', () => {
    const data = getCachedData();
    if (data) {
        const entries = data.entries || data;
        const categories = groupByCategory(entries);
        if (data.config) {
            if (data.config.columnWidth) {
                columnWidth = data.config.columnWidth;
            }
            if (data.config.partition) {
                partition = data.config.partition;
            }
        }
        if (shouldRebuildCache(data)) {
            buildColumnConfigCache(entries);
        }
        return { entries, categories, columnWidth };
    }
    return { entries: [], categories: {}, columnWidth };
});

ipcMain.handle('get-system-info', () => {
    return require('os').userInfo().username + '@' + require('os').hostname();
});

ipcMain.handle('get-json', () => {
    const jsonPath = getJsonPath();
    if (fs.existsSync(jsonPath)) {
        return fs.readFileSync(jsonPath, 'utf-8');
    }
    return '{}';
});

ipcMain.handle('get-json-path', () => {
    return getJsonPath();
});

ipcMain.handle('save-json', (event, { content }) => {
    const jsonPath = getJsonPath();
    try {
        // Backup
        if (fs.existsSync(jsonPath)) {
            fs.copyFileSync(jsonPath, jsonPath + '.bak');
        }
        fs.writeFileSync(jsonPath, content, 'utf-8');
        // Reload cache
        cachedData = null;
        const data = getCachedData();
        buildColumnConfigCache(data.entries || data);
        // Reload main window UI
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('data-reloaded');
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

app.whenReady().then(() => {
    initLogging();
    const jsonPath = getJsonPath();
    logStream.write(`[Info] Using JSON: ${jsonPath}\n`);
    const data = getCachedData();
    if (data) {
        const entries = data.entries || data;
        if (data.config) {
            if (data.config.columnWidth) {
                columnWidth = data.config.columnWidth;
            }
            if (data.config.partition) {
                partition = data.config.partition;
            }
        }
        buildColumnConfigCache(entries);
        logStream.write(`[Info] Loaded ${entries.length} entries from warpweb-data.json\n`);
    } else {
        logStream.write(`[Warning] warpweb-data.json not found at ${jsonPath}\n`);
    }
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (logStream) {
        logStream.write(`=== WarpWeb ended at ${new Date().toISOString()} ===\n`);
        logStream.end();
    }
});
