const fs = require('fs-extra');
const path = require('path');

class FileEditor {
    async modifyVariable(filePath, variableName, newValue) {
        let content = await fs.readFile(filePath, 'utf8');

        if (variableName === 'ruta_base') {
            // Match ruta_base = r"..." or ruta_base = "..."
            const regex = /ruta_base\s*=\s*r?["'].*?["']/;
            content = content.replace(regex, `ruta_base = r"E:/ProcesoAudios/${newValue}"`);
        } else if (variableName === 'base1') {
            // Match base1 = "..."
            const regex = /base1\s*=\s*["'].*?["']/;
            content = content.replace(regex, `base1 = "${newValue}"`);
        } else if (variableName === 'base2_list') {
            // Match base2_list = [...]
            // Format input: 1,2,3 -> ["01","02","03"]
            const days = newValue.split(',').map(d => d.trim().padStart(2, '0'));
            const formattedList = days.map(d => `"${d}"`).join(',');
            const regex = /base2_list\s*=\s*\[.*?\]/;
            content = content.replace(regex, `base2_list = [${formattedList}]`);
        } else if (variableName === 'INPUT_FOLDER') {
            // Legacy/Specific support
            if (filePath.endsWith('speeching_v2.py')) {
                const regex = /INPUT_FOLDER\s*=\s*"([^"]*)\/doyouanalitics_([^"]*)"/;
                content = content.replace(regex, (match, p1, p2) => `INPUT_FOLDER = "${p1}/doyouanalitics_${newValue}"`);
            } else if (filePath.endsWith('evidence.py')) {
                const regex = /INPUT_FOLDER\s*=\s*"([^"]*)\/speechToText_doyouanalitics_([^"]*)"/;
                content = content.replace(regex, (match, p1, p2) => `INPUT_FOLDER = "${p1}/speechToText_doyouanalitics_${newValue}"`);
            }
        } else if (variableName === 'carpeta' && filePath.endsWith('app.py')) {
            const regex = /parser\.add_argument\("--carpeta",\s*default="[^"]*"/;
            content = content.replace(regex, `parser.add_argument("--carpeta", default="${newValue}"`);
        }

        await fs.writeFile(filePath, content, 'utf8');
        return true;
    }

    async getModifiableVariables(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        let vars = [];

        // Check for the new targets
        if (content.includes('ruta_base')) {
            const match = content.match(/ruta_base\s*=\s*r?["'](.*?)["']/);
            if (match) vars.push({ name: 'ruta_base', value: match[1], label: 'Año (ej: 2026 o 26)' });
        }
        if (content.includes('base1')) {
            const match = content.match(/base1\s*=\s*["'](.*?)["']/);
            if (match) vars.push({ name: 'base1', value: match[1], label: 'Mes (ej: 12)' });
        }
        if (content.includes('base2_list')) {
            const match = content.match(/base2_list\s*=\s*\[(.*?)\]/);
            if (match) vars.push({ name: 'base2_list', value: match[1], label: 'Días (ej: 1,2,3)' });
        }

        // Legacy targets
        if (vars.length === 0) {
            if (filePath.endsWith('app.py')) {
                const match = content.match(/parser\.add_argument\("--carpeta",\s*default="([^"]*)"/);
                if (match) vars.push({ name: 'carpeta', value: match[1], label: 'Carpeta' });
            } else if (filePath.endsWith('speeching_v2.py') || filePath.endsWith('evidence.py')) {
                const match = content.match(/INPUT_FOLDER\s*=\s*"([^"]*)\/(?:doyouanalitics|speechToText_doyouanalitics)_([^"]*)"/);
                if (match) vars.push({ name: 'INPUT_FOLDER', value: match[2], label: 'Número de carpeta' });
            }
        }

        return vars;
    }
}

module.exports = new FileEditor();
