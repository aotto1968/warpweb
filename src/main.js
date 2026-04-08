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
    logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`\n=== WarpWeb started at ${new Date().toISOString()} ===\n`);
    logStream.write(`[Info] Log file: ${logFile}\n`);
}

function getJsonPath() {
    for (const arg of process.argv) {
        if (arg.startsWith('--json=')) {
            return arg.split('=')[1];
        }
    }
    const externalJson = path.join(__dirname, '..', '..', 'warpweb-data.json');
    if (fs.existsSync(externalJson)) {
        return externalJson;
    }
    return path.join(__dirname, '..', 'warpweb-data.json');
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
            }
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
        if (jsonEditorView) {
            mainWindow.removeBrowserView(jsonEditorView);
            jsonEditorView.webContents.destroy();
            jsonEditorView = null;
        }
    });
}

function showJsonEditor() {
    if (jsonEditorView) {
        mainWindow.removeBrowserView(jsonEditorView);
        jsonEditorView.webContents?.destroy();
        jsonEditorView = null;
        return;
    }

    if (helpView) {
        mainWindow.removeBrowserView(helpView);
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

function positionBrowserViews() {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    let windowWidth, windowHeight;
    try {
        ([windowWidth, windowHeight] = mainWindow.getContentSize());
    } catch (e) {
        logStream.write(`[Error] Failed to get window size: ${e.message}\n`);
        return;
    }

    const tabsHeight = largeColumnKey !== null ? 0 : layoutHeights.tabs;
    const yOffset = tabsHeight + layoutHeights.containerPadding + layoutHeights.header;
    const scrollbarHeight = scrollbarVisible ? layoutHeights.scrollbar : 0;
    const height = windowHeight - yOffset - layoutHeights.statusBar - scrollbarHeight;

    for (const [key, view] of browserViews) {
        try {
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

            if (largeColumnKey === key) {
                view.setBounds({
                    x: 0,
                    y: yOffset,
                    width: windowWidth,
                    height: height
                });
            } else {
                // NOTE: O(n²) calculation per resize, but:
                // - Only runs for current category (others just hidden with x:-9999)
                // - Typical use case: <10 columns per category
                // - Categories exist precisely to limit column count
                // - Optimization (prefix sum cache) only needed for 20+ columns
                const cw = getColumnWidthForKey(key);
                let x = layoutHeights.containerPadding - scrollX;
                for (let i = 0; i < columnIndex; i++) {
                    const prevKey = `${viewCategory}-${i}`;
                    const prevCw = getColumnWidthForKey(prevKey);
                    x += prevCw + 8;
                }
                view.setBounds({
                    x: x,
                    y: yOffset,
                    width: cw,
                    height: height
                });
            }

        } catch (e) {
            logStream.write(`[Error] Failed to position view ${key}: ${e.message}\n`);
        }
    }
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
        mainWindow.removeBrowserView(view);
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
        mainWindow.removeBrowserView(helpView);
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
        mainWindow.removeBrowserView(helpView);
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
        mainWindow.removeBrowserView(helpView);
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
