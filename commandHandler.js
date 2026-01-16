const fs = require('fs-extra');
const path = require('path');
const stateManager = require('./stateManager');
const fileEditor = require('./fileEditor');
const scriptRunner = require('./scriptRunner');

class CommandHandler {
    constructor() {
        this.commands = [
            'list {ruta}', 'q', 'atras', 'opc', 'c {nombre}', 'r {nombre}',
            'x {script}', 'mod {script}', 'estado', 'logs {script}',
            'cut {nombre}', 'copy {nombre}', 'paste {nombre}', 'take control',
            'predict', 'now', 'dame el reporte'
        ];
        this.opcIndex = 0;
        this.awaitingMod = null; // { script: string, variable: string }
        this.awaitingInteractive = null; // scriptName
    }

    async handle(message, client) {
        const text = message.body.trim();
        const chat = await message.getChat();

        // Handle interactive input for scripts (like MigrarAudios.py)
        if (this.awaitingInteractive) {
            scriptRunner.sendInput(this.awaitingInteractive, text);
            this.awaitingInteractive = null;
            return;
        }

        // Handle modification values
        if (this.awaitingMod) {
            const { script, variable } = this.awaitingMod;
            const filePath = path.join(stateManager.getCurrentPath(), script);
            try {
                await fileEditor.modifyVariable(filePath, variable, text);
                await message.reply(`✅ Variable ${variable} actualizada a "${text}" en ${script}`);
            } catch (err) {
                await message.reply(`❌ Error al modificar: ${err.message}`);
            }
            this.awaitingMod = null;
            return;
        }

        // Parse commands
        if (text.startsWith('list ')) {
            const ruta = text.replace('list ', '').trim();
            try {
                const absoluteRuta = path.isAbsolute(ruta) ? ruta : path.join(stateManager.getCurrentPath(), ruta);
                const files = await fs.readdir(absoluteRuta);
                stateManager.setCurrentPath(absoluteRuta);
                const list = files.map(f => (fs.statSync(path.join(absoluteRuta, f)).isDirectory() ? `📁 ${f}` : `📄 ${f}`)).join('\n');
                await message.reply(`Contenido de ${absoluteRuta}:\n\n${list || 'Carpeta vacía'}`);
            } catch (err) {
                await message.reply(`❌ Error: ${err.message}`);
            }
        }
        else if (text === 'q') {
            stateManager.setCachePath(stateManager.getCurrentPath());
            await message.reply(`📍 Ruta guardada en caché: ${stateManager.getCachePath()}`);
        }
        else if (text === 'atras') {
            stateManager.moveUp();
            await message.reply(`🔙 Nueva ruta: ${stateManager.getCurrentPath()}`);
        }
        else if (text === 'opc') {
            this.opcIndex = 0;
            await this.showOpc(message);
        }
        else if (text === '1' && this.opcIndex !== -1) {
            this.opcIndex += 5;
            await this.showOpc(message);
        }
        else if (text === '2' && this.opcIndex > 0) {
            this.opcIndex -= 5;
            await this.showOpc(message);
        }
        else if (text.startsWith('c ')) {
            const name = text.replace('c ', '').trim();
            const fullPath = path.join(stateManager.getCachePath() || stateManager.getCurrentPath(), name);
            try {
                await fs.ensureDir(fullPath);
                await message.reply(`📁 Carpeta creada: ${fullPath}`);
            } catch (err) {
                await message.reply(`❌ Error: ${err.message}`);
            }
        }
        else if (text.startsWith('r ')) {
            const name = text.replace('r ', '').trim();
            const fullPath = path.join(stateManager.getCachePath() || stateManager.getCurrentPath(), name);
            try {
                await fs.remove(fullPath);
                await message.reply(`🗑️ Carpeta eliminada: ${fullPath}`);
            } catch (err) {
                await message.reply(`❌ Error: ${err.message}`);
            }
        }
        else if (text.startsWith('x ')) {
            const script = text.replace('x ', '').trim();
            const filePath = path.join(stateManager.getCurrentPath(), script);
            if (await fs.pathExists(filePath)) {
                scriptRunner.executeScript(script, filePath, [], (output) => {
                    if (output.includes('Selecciona el numero de carpeta') || output.includes('Ingrese el número')) {
                        client.sendMessage(message.from, `⚠️ Interactivo [${script}]: ${output}`);
                        this.awaitingInteractive = script;
                    }
                });
                await message.reply(`🚀 Ejecutando script: ${script}`);
            } else {
                await message.reply(`❌ Script no encontrado: ${filePath}`);
            }
        }
        else if (text.startsWith('mod ')) {
            const script = text.replace('mod ', '').trim();
            const filePath = path.join(stateManager.getCurrentPath(), script);
            try {
                const vars = await fileEditor.getModifiableVariables(filePath);
                if (vars.length > 0) {
                    this.awaitingMod = { script, variable: vars[0].name };
                    await message.reply(`BOT: ${vars[0].name}="${vars[0].value}"\nEnvía el nuevo valor:`);
                } else {
                    await message.reply(`❌ No se encontraron variables editables conocidas en ${script}`);
                }
            } catch (err) {
                await message.reply(`❌ Error: ${err.message}`);
            }
        }
        else if (text === 'estado') {
            const status = scriptRunner.getStatus();
            await message.reply(`🤖 ESTADO DE SCRIPTS:\n\n${status.join('\n') || 'Ningún script ejecutado.'}`);
        }
        else if (text.startsWith('logs ')) {
            const script = text.replace('logs ', '').trim();
            const logs = scriptRunner.getLogs(script);
            await message.reply(`📄 LOGS [${script}]:\n\n${logs}`);
        }
        else if (text.startsWith('cut ')) {
            const name = text.replace('cut ', '').trim();
            stateManager.setCopyBuffer(path.join(stateManager.getCurrentPath(), name), 'cut');
            await message.reply(`✂️ Cortado: ${name}`);
        }
        else if (text.startsWith('copy ')) {
            const name = text.replace('copy ', '').trim();
            stateManager.setCopyBuffer(path.join(stateManager.getCurrentPath(), name), 'copy');
            await message.reply(`📋 Copiado: ${name}`);
        }
        else if (text.startsWith('paste ')) {
            const buffer = stateManager.getCopyBuffer();
            if (buffer) {
                const dest = path.join(stateManager.getCurrentPath(), path.basename(buffer.path));
                if (buffer.type === 'copy') {
                    fs.copy(buffer.path, dest)
                        .then(() => message.reply(`✅ Pegado (copia): ${dest}`))
                        .catch(e => message.reply(`❌ Error: ${e.message}`));
                } else {
                    fs.move(buffer.path, dest)
                        .then(() => message.reply(`✅ Pegado (mover): ${dest}`))
                        .catch(e => message.reply(`❌ Error: ${e.message}`));
                }
                stateManager.clearCopyBuffer();
            } else {
                await message.reply('❌ Nada en el búfer para pegar.');
            }
        }
        else if (text === 'take control') {
            const buffer = stateManager.getCopyBuffer();
            if (buffer) {
                await message.reply(`Procesando ${buffer.type}... Espera por favor.`);
            } else {
                await message.reply('No hay procesos de pegado activos.');
            }
        }
        else if (text === 'predict') {
            await message.reply('¿Número de carpeta?');
            this.awaitingPredict = true;
        }
        else if (this.awaitingPredict) {
            const num = text;
            this.awaitingPredict = false;
            await this.handlePredict(num, message);
        }
        else if (text === 'now') {
            const last = stateManager.lastExecutedScript;
            if (last) {
                const logs = scriptRunner.getLogs(last);
                await message.reply(`🕒 ÚLTIMO PROCESO [${last}]:\n\n${logs}`);
            } else {
                await message.reply('No hay procesos recientes.');
            }
        }
        else if (text === 'dame el reporte') {
            const reportPath = 'E:/ProcesoAudios/2026/reporte_evidencias.xlsx';
            if (await fs.pathExists(reportPath)) {
                const { MessageMedia } = require('whatsapp-web.js');
                const media = MessageMedia.fromFilePath(reportPath);
                await client.sendMessage(message.from, media);
            } else {
                await message.reply('❌ Reporte no encontrado.');
            }
        }
    }

    async showOpc(message) {
        const chunk = this.commands.slice(this.opcIndex, this.opcIndex + 5);
        let reply = `📋 COMANDOS (${this.opcIndex + 1}-${Math.min(this.opcIndex + 5, this.commands.length)}):\n\n`;
        chunk.forEach((cmd, i) => reply += `${this.opcIndex + i + 1}. ${cmd}\n`);

        reply += '\n';
        if (this.opcIndex + 5 < this.commands.length) reply += '1. Siguiente ➡️\n';
        if (this.opcIndex > 0) reply += '2. Anterior ⬅️\n';

        await message.reply(reply);
    }

    async handlePredict(num, message) {
        // Logic for "predict" command
        // move evidencias and filtrado from E:\ProcesoAudios\2026 to E:\ProcesoAudios\2026\speechToText_doyouanalitics_{num}
        // Then copy E:\ProcesoAudios\2026\speechToText_doyouanalitics_{num}\evidencias to E:\ProcesoAudios\2026\evidencias_general
        const base = 'E:/ProcesoAudios/2026';
        const targetParent = path.join(base, `speechToText_doyouanalitics_${num}`);
        const generalEvidencias = path.join(base, 'evidencias_general');

        try {
            await fs.ensureDir(targetParent);
            await fs.ensureDir(generalEvidencias);

            const evidenciasSrc = path.join(base, 'evidencias');
            const filtradoSrc = path.join(base, 'filtrado');

            if (await fs.pathExists(evidenciasSrc)) {
                await fs.move(evidenciasSrc, path.join(targetParent, 'evidencias'), { overwrite: true });
            }
            if (await fs.pathExists(filtradoSrc)) {
                await fs.move(filtradoSrc, path.join(targetParent, 'filtrado'), { overwrite: true });
            }

            const targetEvidencias = path.join(targetParent, 'evidencias');
            if (await fs.pathExists(targetEvidencias)) {
                await fs.copy(targetEvidencias, generalEvidencias);
            }

            await message.reply(`✅ Proceso predict completado para carpeta ${num}`);
        } catch (err) {
            await message.reply(`❌ Error en predict: ${err.message}`);
        }
    }
}

module.exports = new CommandHandler();
