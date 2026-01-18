const { spawn } = require('child_process');
const stateManager = require('./stateManager');

class ScriptRunner {
    constructor() {
        this.processes = {}; // { scriptName: { process, logs: [], lastLog: string } }
    }

    executeScript(scriptName, filePath, args = [], interactiveHandler = null) {
        console.log(`Executing ${scriptName} at ${filePath} with args ${args}`);

        const child = spawn('python', [filePath, ...args], {
            cwd: stateManager.getCurrentPath(),
            shell: true,
            env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
        });

        this.processes[scriptName] = {
            process: child,
            logs: [],
            lastLog: '',
            startTime: new Date(),
            status: 'EJECUTANDO',
            progress: '0%',
            eta: 'Calculando...'
        };

        stateManager.lastExecutedScript = scriptName;

        child.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[${scriptName} STDOUT]: ${output}`);
            this.processes[scriptName].logs.push(output);
            this.processes[scriptName].lastLog = output.trim().split('\n').pop();

            // Try to parse progress from logs (Tqdm format usually)
            // Example: 10%|█▏          | 2176/21778 [1:54:24<12:42:23, 2.33s/archivo]
            const progressMatch = output.match(/(\d+)%\|/);
            if (progressMatch) {
                this.processes[scriptName].progress = progressMatch[1] + '%';
            }

            const etaMatch = output.match(/<([^,>]+)/);
            if (etaMatch) {
                this.processes[scriptName].eta = etaMatch[1];
            }

            if (interactiveHandler) {
                interactiveHandler(output);
            }
        });

        child.stderr.on('data', (data) => {
            const output = data.toString();
            console.error(`[${scriptName} STDERR]: ${output}`);
            this.processes[scriptName].logs.push(`ERROR: ${output}`);
        });

        child.on('close', (code) => {
            console.log(`[${scriptName}] finished with code ${code}`);
            this.processes[scriptName].status = code === 0 ? 'COMPLETADO' : 'ERROR';
            this.processes[scriptName].progress = '100%';
        });

        return child;
    }

    sendInput(scriptName, input) {
        if (this.processes[scriptName] && this.processes[scriptName].process) {
            this.processes[scriptName].process.stdin.write(input + '\n');
        }
    }

    getStatus() {
        const statusReport = [];
        for (const [name, data] of Object.entries(this.processes)) {
            statusReport.push(`${name} --${data.status} --${data.progress} --fin:${data.eta} --inicio:${data.startTime.toLocaleTimeString()}`);
        }
        return statusReport;
    }

    getLogs(scriptName) {
        if (this.processes[scriptName]) {
            return this.processes[scriptName].logs.slice(-10).join('\n'); // Last 10 lines
        }
        return 'Sin logs disponibles.';
    }
}

module.exports = new ScriptRunner();
