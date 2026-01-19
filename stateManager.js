const path = require('path');
const fs = require('fs-extra');

class StateManager {
    constructor() {
        this.sessions = {}; // jid -> { currentPath, cachePath, copyBuffer, lastExecutedScript, operationStatus }
    }

    _getSession(jid) {
        if (!this.sessions[jid]) {
            this.sessions[jid] = {
                currentPath: process.cwd(),
                cachePath: null,
                copyBuffer: null,
                lastExecutedScript: null,
                operationStatus: null
            };
        }
        return this.sessions[jid];
    }

    setCurrentPath(jid, newPath) {
        this._getSession(jid).currentPath = path.resolve(newPath);
    }

    getCurrentPath(jid) {
        return this._getSession(jid).currentPath;
    }

    setCachePath(jid, newPath) {
        this._getSession(jid).cachePath = path.resolve(newPath);
    }

    getCachePath(jid) {
        return this._getSession(jid).cachePath;
    }

    moveUp(jid) {
        const session = this._getSession(jid);
        session.currentPath = path.dirname(session.currentPath);
    }

    setCopyBuffer(jid, filePath, type) {
        this._getSession(jid).copyBuffer = { path: filePath, type };
    }

    getCopyBuffer(jid) {
        return this._getSession(jid).copyBuffer;
    }

    clearCopyBuffer(jid) {
        this._getSession(jid).copyBuffer = null;
    }

    setOperationStatus(jid, status) {
        this._getSession(jid).operationStatus = status; // { type, source, dest, progress, startTime }
    }

    getOperationStatus(jid) {
        return this._getSession(jid).operationStatus;
    }

    clearOperationStatus(jid) {
        this._getSession(jid).operationStatus = null;
    }
}

module.exports = new StateManager();
