const fs = require('fs-extra');
const path = require('path');

class FileEditor {
    async getModifiableVariables(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        const vars = [];

        // 1. Detect ruta_base (Year/Path)
        const rutaMatch = content.match(/ruta_base\s*=\s*r?["'](.*?)["']/);
        if (rutaMatch) {
            vars.push({
                name: 'ruta_base',
                value: rutaMatch[1],
                label: 'Año (ej: 2026 o 26)',
                type: 'year'
            });
        }

        // 2. Detect base1 (Month)
        const base1Match = content.match(/base1\s*=\s*["'](.*?)["']/);
        if (base1Match) {
            vars.push({
                name: 'base1',
                value: base1Match[1],
                label: 'Mes (ej: 12)',
                type: 'string'
            });
        }

        // 3. Detect base2_list (Days)
        const base2Match = content.match(/base2_list\s*=\s*\[(.*?)\]/s); // 's' flag for multi-line
        if (base2Match) {
            vars.push({
                name: 'base2_list',
                value: base2Match[1],
                label: 'Días (ej: 1,2,3)',
                type: 'list'
            });
        }

        // 4. Detect INPUT_FOLDER (Target folder for older/other scripts)
        const inputMatch = content.match(/INPUT_FOLDER\s*=\s*["'](.*?)["']/);
        if (inputMatch) {
            // Check if it has a trailing number like _15
            const folderPart = path.basename(inputMatch[1]);
            const numMatch = folderPart.match(/_(\d+)$/);
            vars.push({
                name: 'INPUT_FOLDER',
                value: numMatch ? numMatch[1] : inputMatch[1],
                label: 'Número de carpeta',
                type: numMatch ? 'suffix_num' : 'string'
            });
        }

        // 5. Detect argparse default carpeta (app.py style)
        const argMatch = content.match(/parser\.add_argument\("--carpeta",\s*default="([^"]*)"/);
        if (argMatch) {
            vars.push({
                name: 'carpeta',
                value: argMatch[1],
                label: 'Carpeta',
                type: 'string'
            });
        }

        return vars;
    }

    async modifyVariable(filePath, variableName, newValue) {
        let content = await fs.readFile(filePath, 'utf8');

        if (variableName === 'ruta_base') {
            const year = newValue.length === 2 ? `20${newValue}` : newValue;
            // Matches both r"..." and "..."
            content = content.replace(/(ruta_base\s*=\s*)r?["'].*?["']/, `$1r"E:/ProcesoAudios/${year}"`);
        }
        else if (variableName === 'base1') {
            content = content.replace(/(base1\s*=\s*)["'].*?["']/, `$1"${newValue}"`);
        }
        else if (variableName === 'base2_list') {
            // Input: 1, 2, 3 -> ["01","02","03"]
            const days = newValue.split(',')
                .map(d => d.trim().padStart(2, '0'))
                .filter(d => d.length > 0);
            const formatted = `[${days.map(d => `"${d}"`).join(',')}]`;
            content = content.replace(/(base2_list\s*=\s*)\[.*?\]/s, `$1${formatted}`);
        }
        else if (variableName === 'INPUT_FOLDER') {
            // Smart replace for folder numbers in path
            const regExp = /(INPUT_FOLDER\s*=\s*["'])(.*?)_(\d+)(["'])/;
            if (regExp.test(content)) {
                content = content.replace(regExp, `$1$2_${newValue}$4`);
            } else {
                content = content.replace(/(INPUT_FOLDER\s*=\s*)["'].*?["']/, `$1"${newValue}"`);
            }
        }
        else if (variableName === 'carpeta') {
            content = content.replace(/(parser\.add_argument\("--carpeta",\s*default=)"[^"]*"/, `$1"${newValue}"`);
        }

        await fs.writeFile(filePath, content, 'utf8');
        return true;
    }
}

module.exports = new FileEditor();
