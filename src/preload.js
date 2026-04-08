const { contextBridge, ipcRenderer } = require('electron');

/**
 * @namespace warpweb
 * @description WarpWeb Electron IPC API
 */
contextBridge.exposeInMainWorld('warpweb', {
    /** @param {string} category @param {number} columnIndex @param {string} url */
    openUrl: (category, columnIndex, url) => ipcRenderer.invoke('open-url', { category, columnIndex, url }),
    /** @param {string} category */
    showCategory: (category) => ipcRenderer.send('show-category', category),
    /** @param {number} scrollX */
    setScrollX: (scrollX) => ipcRenderer.send('set-scroll-x', scrollX),
    /** @param {number} height @param {boolean} scrollbarVisible */
    setContainerHeight: (height, scrollbarVisible) => ipcRenderer.send('set-container-height', { height, scrollbarVisible }),
    /** @param {number} columnIndex @returns {Promise<string|null>} */
    goBack: (columnIndex) => ipcRenderer.invoke('go-back', columnIndex),
    /** @param {number} columnIndex */
    reloadUrl: (columnIndex) => ipcRenderer.send('reload-url', columnIndex),
    /** @param {number} columnIndex */
    toggleLarge: (columnIndex) => ipcRenderer.send('toggle-large', columnIndex),
    /** @param {function(string|null)} callback - receives key or null */
    onLargeChanged: (callback) => ipcRenderer.on('large-changed', (event, data) => callback(data.key)),
    /** @param {function()} callback */
    onDataReloaded: (callback) => ipcRenderer.on('data-reloaded', () => callback()),
    /** Clear all browser views and reload data */
    clearAllViews: () => ipcRenderer.send('clear-all-views'),
    /** @returns {Promise<{entries: array, categories: object, columnWidth: number}>} */
    getData: () => ipcRenderer.invoke('get-data'),
    /** @param {string} msg */
    logError: (msg) => ipcRenderer.send('log-error', msg),
    /** @returns {Promise<string>} */
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    /** @param {Object} heights */
    setLayoutHeights: (heights) => ipcRenderer.send('set-layout-heights', heights),
    /** Show help documentation */
    showHelp: () => ipcRenderer.send('show-help'),
    /** @param {function(boolean)} callback */
    onHelpVisibilityChanged: (callback) => ipcRenderer.on('help-visibility-changed', (event, visible) => callback(visible)),
    /** Open JSON editor for full configuration */
    showJsonEditor: () => ipcRenderer.send('show-json-editor'),
    /** @returns {Promise<string>} */
    getJson: () => ipcRenderer.invoke('get-json'),
    /** @param {Object} obj @returns {Promise<{success: boolean, error?: string}>} */
    saveJson: (obj) => ipcRenderer.invoke('save-json', obj),
    /** Close JSON editor view */
    closeJsonEditor: () => ipcRenderer.send('close-json-editor'),
    /** Open top-level DevTools detached */
    openToplevelDevTools: () => ipcRenderer.send('open-toplevel-devtools'),
    /** @param {number} columnIndex @param {string} url */
    navigateUrl: (columnIndex, url) => ipcRenderer.send('navigate-url', { columnIndex, url }),
    /** @param {number} columnIndex @returns {Promise<Array>} */
    getUrlHistory: (columnIndex) => ipcRenderer.invoke('get-url-history', columnIndex),
    /** @param {number} columnIndex @param {Array} history */
    saveUrlHistory: (columnIndex, history) => ipcRenderer.invoke('save-url-history', { columnIndex, history }),
    /** @param {function({key: string, url: string})} callback */
    onUrlChanged: (callback) => ipcRenderer.on('url-changed', (event, data) => callback(data)),
    /** @param {number} columnIndex @returns {Promise<string|null>} */
    getUrl: (columnIndex) => ipcRenderer.invoke('get-url', columnIndex)
});
