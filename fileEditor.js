const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');

class FileEditor {
    async modifyVariable(filePath, variableName, newValue) {
        let content = await fs.readFile(filePath, 'utf8');

        // Patterns for different scripts as described in request
        // app.py: parser.add_argument("--carpeta", default="15", ...)
        // speeching_v2.py: INPUT_FOLDER = "E:/ProcesoAudios/2026/doyouanalitics_15"
        // evidence.py: INPUT_FOLDER = "E:/ProcesoAudios/2026/speechToText_doyouanalitics_09"

        if (filePath.endsWith('app.py') && variableName === 'carpeta') {
            const regex = /parser\.add_argument\("--carpeta",\s*default="[^"]*"/;
            content = content.replace(regex, `parser.add_argument("--carpeta", default="${newValue}"`);
        } else if (filePath.endsWith('speeching_v2.py') && variableName === 'INPUT_FOLDER') {
            const regex = /INPUT_FOLDER\s*=\s*"([^"]*)\/doyouanalitics_([^"]*)"/;
            content = content.replace(regex, (match, p1, p2) => {
                return `INPUT_FOLDER = "${p1}/doyouanalitics_${newValue}"`;
            });
        } else if (filePath.endsWith('evidence.py') && variableName === 'INPUT_FOLDER') {
            const regex = /INPUT_FOLDER\s*=\s*"([^"]*)\/speechToText_doyouanalitics_([^"]*)"/;
            content = content.replace(regex, (match, p1, p2) => {
                return `INPUT_FOLDER = "${p1}/speechToText_doyouanalitics_${newValue}"`;
            });
        } else {
            // Generic replacement if possible, but the user was specific about the scripts above
            // We can add more generic logic if needed.
        }

        await fs.writeFile(filePath, content, 'utf8');
        return true;
    }

    async getModifiableVariables(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        let vars = [];

        if (filePath.endsWith('app.py')) {
            const match = content.match(/parser\.add_argument\("--carpeta",\s*default="([^"]*)"/);
            if (match) vars.push({ name: 'carpeta', value: match[1] });
        } else if (filePath.endsWith('speeching_v2.py')) {
            const match = content.match(/INPUT_FOLDER\s*=\s*"([^"]*)\/doyouanalitics_([^"]*)"/);
            if (match) vars.push({ name: 'INPUT_FOLDER', value: match[2] });
        } else if (filePath.endsWith('evidence.py')) {
            const match = content.match(/INPUT_FOLDER\s*=\s*"([^"]*)\/speechToText_doyouanalitics_([^"]*)"/);
            if (match) vars.push({ name: 'INPUT_FOLDER', value: match[2] });
        }

        return vars;
    }
}

module.exports = new FileEditor();
