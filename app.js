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
const qrcodeTerminal = require('qrcode-terminal');
const http = require('http');

let latestQr = null;

// Simple HTTP server to show QR code
const server = http.createServer(async (req, res) => {
    if (req.url === '/qr.png') {
        const qrPath = path.join(__dirname, 'qr.png');
        if (await fs.pathExists(qrPath)) {
            const img = await fs.readFile(qrPath);
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(img, 'binary');
        } else {
            res.writeHead(404);
            res.end('QR not found');
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
            <html>
                <head>
                    <title>WhatsApp Bot QR</title>
                    <meta http-equiv="refresh" content="5">
                    <style>
                        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
                        .card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
                        img { max-width: 300px; margin-top: 20px; }
                        h1 { color: #128c7e; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Escanea el código QR</h1>
                        <p>El bot se conectará automáticamente.</p>
                        \${latestQr ? '<img src="/qr.png?t=' + Date.now() + '">' : '<p>Esperando el código QR... o ya estás conectado.</p>'}
                    </div>
                </body>
            </html>
        `);
    }
});

server.listen(9001, () => {
    console.log('QR Web View available at http://localhost:9001');
});


async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
    });


    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            latestQr = qr;
            console.log('QR RECEIVED');
            qrcodeTerminal.generate(qr, { small: true });
            await QRCode.toFile(path.join(__dirname, 'qr.png'), qr);
            console.log('QR code saved as qr.png and displayed in terminal');
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
            latestQr = null;
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
