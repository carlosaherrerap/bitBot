const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    jidDecode
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const fs = require('fs-extra');
const path = require('path');
const commandHandler = require('./commandHandler');


async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: 'silent' }),
    });


    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('QR RECEIVED');
            await QRCode.toFile(path.join(__dirname, 'qr.png'), qr);
            console.log('QR code saved as qr.png');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ?
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Opened connection');
            // Remove qr.png if it exists
            const qrPath = path.join(__dirname, 'qr.png');
            if (await fs.pathExists(qrPath)) {
                await fs.remove(qrPath);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            for (const msg of m.messages) {
                if (!msg.key.fromMe && m.type === 'notify') {
                    try {
                        await commandHandler.handle(msg, sock);
                    } catch (err) {
                        console.error('Error handling message:', err);
                    }
                }
            }
        }
    });

    return sock;
}

connectToWhatsApp();
