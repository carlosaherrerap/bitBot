const path = require('path');
const fs = require('fs-extra');

class StateManager {
    constructor() {
        this.currentPath = process.cwd();
        this.cachePath = null;
        this.copyBuffer = null; // { type: 'copy' | 'cut', path: string }
        this.lastExecutedScript = null;
        this.scriptsStatus = {}; // { scriptName: { status: string, progress: string, startTime: Date, eta: string } }
    }

    setCurrentPath(newPath) {
        this.currentPath = path.resolve(newPath);
    }

    getCurrentPath() {
        return this.currentPath;
    }

    setCachePath(newPath) {
        this.cachePath = path.resolve(newPath);
    }

    getCachePath() {
        return this.cachePath;
    }

    moveUp() {
        this.currentPath = path.dirname(this.currentPath);
    }

    setCopyBuffer(path, type) {
        this.copyBuffer = { path, type };
    }

    getCopyBuffer() {
        return this.copyBuffer;
    }

    clearCopyBuffer() {
        this.copyBuffer = null;
    }
}

module.exports = new StateManager();
