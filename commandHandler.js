const fs = require('fs-extra');
const path = require('path');
const stateManager = require('./stateManager');
const fileEditor = require('./fileEditor');
const scriptRunner = require('./scriptRunner');

class CommandHandler {
    constructor() {
        this.commands = [
            'list {ruta}', 'q', 'atras', 'opc', 'c {nombre}', 'r {nombre}',
            'x {script}', 'mod {script}', 'estado', 'logs {script}', 'cancel {script}',
            'cut {nombre}', 'copy {nombre}', 'paste {nombre}', 'take control',
            'predict', 'now', 'dame el reporte', 'disco', 'info {comando}',
            'reset session'
        ];
        //INFORMACION DE CADA UNO DE LOS COMANDOS
        this.descriptions = {
            'list': 'Muestra el contenido de una carpeta. Puedes usar rutas relativas o absolutas (ej: "list ." o "list E:/").',
            'q': 'Guarda la ruta actual en el caché para usarla luego con otros comandos.',
            'atras': 'Sube un nivel en la jerarquía de carpetas (va a la carpeta padre).',
            'opc': 'Muestra el menú interactivo con todos los comandos disponibles.',
            'c': 'Crea una nueva carpeta con el nombre especificado en la ruta actual o la del caché.',
            'r': 'Elimina la carpeta o archivo especificado en la ruta actual o la del caché.',
            'x': 'Ejecuta un script de Python (.py) con soporte para emojis y entrada interactiva.',
            'mod': 'Permite modificar valores de variables dentro de un script de Python de forma remota.',
            'estado': 'Muestra el estado actual de ejecución de todos los scripts iniciados.',
            'logs': 'Muestra las últimas líneas de salida (STDOUT/STDERR) del script especificado.',
            'cancel': 'Cancela la ejecución de un script que esté corriendo actualmente.',
            'cut': 'Marca un archivo o carpeta para ser movido (cortar).',
            'copy': 'Marca un archivo o carpeta para ser copiado.',
            'paste': 'Pega el archivo o carpeta previamente copiado o cortado en la ruta actual.',
            'take control': 'Muestra información sobre procesos de pegado activos.',
            'predict': 'Proceso automatizado para organizar carpetas de evidencias y filtrado.',
            'now': 'Muestra los logs del último proceso ejecutado.',
            'dame el reporte': 'Envía el archivo Excel de reporte de evidencias si existe en la ruta configurada.',
            'disco': 'Muestra un menú para cambiar rápidamente entre los discos locales (C, D, E, F) y los guarda en caché.',
            'info': 'Muestra una breve explicación de para qué sirve el comando especificado.',
            'reset session': 'Elimina los archivos de sesión de WhatsApp para solucionar errores de conexión (Bad MAC). Requiere re-escanear el QR.'
        };
        this.opcIndex = 0;
        this.awaitingMod = {}; // jid -> { script, variable }
        this.awaitingInteractive = {}; // jid -> scriptName
        this.awaitingDrive = {}; // jid -> boolean
        this.awaitingPredict = {}; // jid -> boolean
    }

    async handle(msg, sock) {
        const jid = msg.key.remoteJid;
        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();

        if (!text) return;

        console.log(`[COMMAND] Received: "${text}" from ${jid}`);

        const reply = async (content) => {
            await sock.sendMessage(jid, { text: content }, { quoted: msg });
        };

        // Handle interactive input for scripts
        if (this.awaitingInteractive[jid]) {
            const script = this.awaitingInteractive[jid];
            console.log(`[INPUT] Forwarding to script: ${script}`);
            scriptRunner.sendInput(script, text);
            this.awaitingInteractive[jid] = null;
            return;
        }

        // Handle drive selection
        if (this.awaitingDrive[jid]) {
            const drives = { '1': 'C', '2': 'D', '3': 'E', '4': 'F' };
            const selected = drives[text];
            if (selected) {
                const targetPath = `${selected}:\\`;
                stateManager.setCurrentPath(jid, targetPath);
                stateManager.setCachePath(jid, targetPath);
                await reply(`✅ Disco ${selected} seleccionado.\n📍 Ruta actual y caché: ${targetPath}`);
            } else {
                await reply('❌ Selección no válida. Operación cancelada.');
            }
            this.awaitingDrive[jid] = false;
            return;
        }

        // Handle modification values
        if (this.awaitingMod[jid]) {
            const { script, variables, currentIndex } = this.awaitingMod[jid];
            const currentVar = variables[currentIndex];

            try {
                await fileEditor.modifyVariable(script, currentVar.name, text);

                const nextIndex = currentIndex + 1;
                if (nextIndex < variables.length) {
                    this.awaitingMod[jid].currentIndex = nextIndex;
                    const nextVar = variables[nextIndex];
                    await reply(`✅ ${currentVar.name} actualizado.\n\n📌 ${nextVar.label}:\nValor actual: "${nextVar.value}"\n\nEnvía el nuevo valor:`);
                } else {
                    await reply(`✅ Proceso finalizado. El script ${path.basename(script)} ha sido actualizado completamente.`);
                    this.awaitingMod[jid] = null;
                }
            } catch (err) {
                await reply(`❌ Error al modificar ${currentVar.name}: ${err.message}`);
                this.awaitingMod[jid] = null;
            }
            return;
        }

        // Handle predict input
        if (this.awaitingPredict[jid]) {
            const num = text;
            this.awaitingPredict[jid] = false;
            console.log(`[PREDICT] Processing folder: ${num}`);
            await this.handlePredict(num, msg, sock);
            return;
        }

        // Parse commands
        try {
            if (text.startsWith('list ')) {
                let ruta = text.replace('list ', '').trim();
                if (/^[a-zA-Z]:?$/.test(ruta)) {
                    if (!ruta.endsWith(':')) ruta += ':';
                    ruta += path.sep;
                }
                const absoluteRuta = (path.isAbsolute(ruta) || /^[a-zA-Z]:[\\\/]/.test(ruta))
                    ? path.resolve(ruta)
                    : path.join(stateManager.getCurrentPath(jid), ruta);

                const files = await fs.readdir(absoluteRuta);
                stateManager.setCurrentPath(jid, absoluteRuta);

                const listItems = [];
                for (const f of files) {
                    try {
                        const isDir = fs.statSync(path.join(absoluteRuta, f)).isDirectory();
                        listItems.push(isDir ? `📁 ${f}` : `📄 ${f}`);
                    } catch (e) { }
                }
                await reply(`Contenido de ${absoluteRuta}:\n\n${listItems.join('\n') || 'Carpeta vacía'}`);
            }
            else if (text === 'q') {
                stateManager.setCachePath(jid, stateManager.getCurrentPath(jid));
                await reply(`📍 Ruta guardada en caché: ${stateManager.getCachePath(jid)}`);
            }
            else if (text === 'atras') {
                stateManager.moveUp(jid);
                await reply(`🔙 Nueva ruta: ${stateManager.getCurrentPath(jid)}`);
            }
            else if (text === 'opc') {
                this.opcIndex = 0;
                await this.showOpc(msg, sock);
            }
            else if (text === '1' || text === '2') {
                // Paginated menu logic (opcIndex should also be per JID if we want perfection, but let's stick to basics)
                if (text === '1') this.opcIndex += 5; else this.opcIndex -= 5;
                await this.showOpc(msg, sock);
            }
            else if (text.startsWith('c ')) {
                const name = text.replace('c ', '').trim();
                const cache = stateManager.getCachePath(jid);
                const current = stateManager.getCurrentPath(jid);
                const targetDir = cache || current;
                const fullPath = path.resolve(targetDir, name);

                console.log(`[CREATE] Target: ${fullPath} (Cache: ${cache}, Current: ${current})`);
                try {
                    await fs.ensureDir(fullPath);
                    await reply(`📁 Carpeta creada con éxito en:\n${fullPath}${cache ? '\n(Usando ruta en caché)' : ''}`);
                } catch (err) {
                    await reply(`❌ Error al crear carpeta: ${err.message}`);
                }
            }
            else if (text.startsWith('r ')) {
                const name = text.replace('r ', '').trim();
                const cache = stateManager.getCachePath(jid);
                const current = stateManager.getCurrentPath(jid);
                const targetDir = cache || current;
                const fullPath = path.resolve(targetDir, name);

                console.log(`[REMOVE] Target: ${fullPath}`);
                try {
                    if (await fs.pathExists(fullPath)) {
                        await fs.remove(fullPath);
                        await reply(`🗑️ Eliminado con éxito:\n${fullPath}${cache ? '\n(Usando ruta en caché)' : ''}`);
                    } else {
                        await reply(`❌ No existe: ${fullPath}`);
                    }
                } catch (err) {
                    await reply(`❌ Error al eliminar: ${err.message}`);
                }
            }
            else if (text.startsWith('x ')) {
                const script = text.replace('x ', '').trim();
                const filePath = path.join(stateManager.getCurrentPath(jid), script);
                if (await fs.pathExists(filePath)) {
                    scriptRunner.executeScript(script, filePath, [], (output) => {
                        const promptMsg = output.includes('Ingrese el número') ? '🤖 ¿Qué carpeta deseas procesar?' : `⚠️ Interactivo [${script}]: ${output}`;
                        if (output.includes('Selecciona el numero de carpeta') || output.includes('Ingrese el número')) {
                            sock.sendMessage(jid, { text: promptMsg });
                            this.awaitingInteractive[jid] = script;
                        }
                    }, jid);
                    await reply(`🚀 Ejecutando script: ${script}`);
                } else {
                    await reply(`❌ Script no encontrado: ${filePath}`);
                }
            }
            else if (text.startsWith('mod ')) {
                const script = text.replace('mod ', '').trim();
                const absolutePath = path.isAbsolute(script) ? script : path.join(stateManager.getCurrentPath(jid), script);

                try {
                    const vars = await fileEditor.getModifiableVariables(absolutePath);
                    if (vars.length > 0) {
                        this.awaitingMod[jid] = {
                            script: absolutePath,
                            variables: vars,
                            currentIndex: 0
                        };
                        const firstVar = vars[0];
                        await reply(`🛠️ MODIFICANDO: ${path.basename(absolutePath)}\n\n📌 ${firstVar.label}:\nValor actual: "${firstVar.value}"\n\nEnvía el nuevo valor:`);
                    } else {
                        await reply(`❌ No se encontraron variables editables en este script.`);
                    }
                } catch (err) {
                    await reply(`❌ Error al leer el script: ${err.message}`);
                }
            }
            else if (text === 'estado') {
                const status = scriptRunner.getStatus();
                await reply(`🤖 ESTADO DE SCRIPTS:\n\n${status.join('\n') || 'Nada ejecutando.'}`);
            }
            else if (text.startsWith('logs ')) {
                const script = text.replace('logs ', '').trim();
                await reply(`📄 LOGS [${script}]:\n\n${scriptRunner.getLogs(script)}`);
            }
            else if (text === 'cancel' || text.startsWith('cancel ')) {
                let script = text.replace('cancel ', '').trim();
                if (text === 'cancel') {
                    script = scriptRunner.getLastScript();
                    if (!script) {
                        await reply('❌ No hay ningún script reciente para cancelar.');
                        return;
                    }
                }
                const success = scriptRunner.stopScript(script);
                if (success) {
                    await reply(`🛑 Script [${script}] cancelado correctamente.`);
                } else {
                    await reply(`❌ No se pudo cancelar [${script}]. ¿Está corriendo?`);
                }
            }
            else if (text.startsWith('cut ')) {
                const name = text.replace('cut ', '').trim();
                const fullPath = path.resolve(stateManager.getCurrentPath(jid), name);
                if (await fs.pathExists(fullPath)) {
                    stateManager.setCopyBuffer(jid, fullPath, 'cut');
                    await reply(`✂️ Cortado (listo para pegar): ${name}`);
                    console.log(`[CUT] Memory set: ${fullPath}`);
                } else {
                    await reply(`❌ No se encuentra el origen: ${fullPath}`);
                }
            }
            else if (text.startsWith('copy ')) {
                const name = text.replace('copy ', '').trim();
                const fullPath = path.resolve(stateManager.getCurrentPath(jid), name);
                if (await fs.pathExists(fullPath)) {
                    stateManager.setCopyBuffer(jid, fullPath, 'copy');
                    await reply(`📋 Copiado (listo para pegar): ${name}`);
                    console.log(`[COPY] Memory set: ${fullPath}`);
                } else {
                    await reply(`❌ No se encuentra el origen: ${fullPath}`);
                }
            }
            else if (text.startsWith('paste ')) {
                const buffer = stateManager.getCopyBuffer(jid);
                if (!buffer) {
                    await reply('❌ Nada para pegar. Usa "copy" o "cut" primero.');
                    return;
                }

                const dest = path.resolve(stateManager.getCurrentPath(jid), path.basename(buffer.path));
                console.log(`[PASTE] ${buffer.type} from ${buffer.path} to ${dest}`);

                if (buffer.path === dest) {
                    await reply('❌ No puedes pegar en la misma ubicación.');
                    return;
                }

                stateManager.setOperationStatus(jid, {
                    type: buffer.type,
                    source: buffer.path,
                    dest,
                    progress: 'Iniciado...',
                    startTime: new Date()
                });

                await reply(`⏳ Iniciando ${buffer.type === 'copy' ? 'copia' : 'movimiento'}... Usa "take control" para ver.`);

                const operation = buffer.type === 'copy' ? fs.copy(buffer.path, dest) : fs.move(buffer.path, dest, { overwrite: true });

                operation
                    .then(() => {
                        reply(`✅ Pegado finalizado con éxito:\n${dest}`);
                        stateManager.setOperationStatus(jid, { ...stateManager.getOperationStatus(jid), progress: '100% (Completado)' });
                        stateManager.clearCopyBuffer(jid);
                    })
                    .catch(e => {
                        reply(`❌ Error al pegar: ${e.message}`);
                        stateManager.setOperationStatus(jid, { ...stateManager.getOperationStatus(jid), progress: `Error: ${e.message}` });
                        console.error(`[PASTE] Error:`, e);
                    });
            }
            else if (text === 'take control') {
                const status = stateManager.getOperationStatus(jid);
                if (status) {
                    const elapsed = Math.round((new Date() - status.startTime) / 1000);
                    await reply(`📊 PROCESO:\n- Tipo: ${status.type}\n- Desde: ${status.source}\n- Hacia: ${status.dest}\n- Estado: ${status.progress}\n- Tiempo: ${elapsed}s`);
                } else {
                    await reply('No hay procesos activos.');
                }
            }
            else if (text === 'predict') {
                await reply('¿Número de carpeta?');
                this.awaitingPredict[jid] = true;
            }
            else if (text === 'now') {
                const last = stateManager._getSession(jid).lastExecutedScript;
                if (last) await reply(`🕒 ÚLTIMO [${last}]:\n\n${scriptRunner.getLogs(last)}`);
                else await reply('Nada reciente.');
            }
            else if (text === 'dame el reporte') {
                const reportPath = 'E:/ProcesoAudios/2026/reporte_evidencias.xlsx';
                if (await fs.pathExists(reportPath)) {
                    await sock.sendMessage(jid, { document: { url: reportPath }, fileName: 'reporte_evidencias.xlsx', mimetype: 'application/octet-stream' }, { quoted: msg });
                } else {
                    await reply('❌ No hay reporte.');
                }
            }
            else if (text === 'disco') {
                this.awaitingDrive[jid] = true;
                await reply('Elija disco:\n1. C\n2. D\n3. E\n4. F');
            }
            else if (text.startsWith('info ')) {
                const cmd = text.replace('info ', '').trim().toLowerCase();
                const desc = this.descriptions[cmd];
                await reply(desc ? `ℹ️ *${cmd}*: ${desc}` : '❌ Comando no reconocido.');
            }
            else if (text === 'reset session') {
                const sessionPath = path.join(__dirname, 'auth_info_baileys');
                try {
                    if (await fs.pathExists(sessionPath)) {
                        await fs.remove(sessionPath);
                        await reply('🔄 Sesión eliminada. El bot se reiniciará y deberás escanear el QR nuevamente.');
                        console.log('[SESSION] Session folder deleted. Exiting for restart...');
                        process.exit(0);
                    } else {
                        await reply('⚠️ No se encontró la carpeta de sesión.');
                    }
                } catch (err) {
                    await reply(`❌ Error al eliminar sesión: ${err.message}`);
                }
            }
        } catch (err) {
            await reply(`❌ Error: ${err.message}`);
        }
    }

    async showOpc(msg, sock) {
        const jid = msg.key.remoteJid;
        const chunk = this.commands.slice(this.opcIndex, this.opcIndex + 5);
        let list = `📋 COMANDOS (${this.opcIndex + 1}-${Math.min(this.opcIndex + 5, this.commands.length)}):\n\n`;
        chunk.forEach((c, i) => list += `${this.opcIndex + i + 1}. ${c}\n`);
        list += '\n1. Siguiente | 2. Anterior';
        await sock.sendMessage(jid, { text: list }, { quoted: msg });
    }

    async handlePredict(num, msg, sock) {
        const jid = msg.key.remoteJid;
        const base = 'E:/ProcesoAudios/2026';
        const target = path.join(base, `speechToText_doyouanalitics_${num}`);
        const gen = path.join(base, 'evidencias_general');
        try {
            await fs.ensureDir(target);
            await fs.ensureDir(gen);
            const eSrc = path.join(base, 'evidencias');
            const fSrc = path.join(base, 'filtrado');
            if (await fs.pathExists(eSrc)) await fs.move(eSrc, path.join(target, 'evidencias'), { overwrite: true });
            if (await fs.pathExists(fSrc)) await fs.move(fSrc, path.join(target, 'filtrado'), { overwrite: true });
            if (await fs.pathExists(path.join(target, 'evidencias'))) await fs.copy(path.join(target, 'evidencias'), gen);
            await sock.sendMessage(jid, { text: `✅ Predict finalizado para ${num}` }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(jid, { text: `❌ Error en predict: ${e.message}` }, { quoted: msg });
        }
    }
}

module.exports = new CommandHandler();
