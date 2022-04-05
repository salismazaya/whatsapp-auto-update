const wa = require('@adiwajshing/baileys')
const fs = require('fs')
const makeWASocket = wa['default']

const wa_sessions = {}

if (!fs.existsSync('./tmp/')) {
    fs.mkdirSync('./tmp')
}

const createWaSession = (config) => {
    config = config || {}
    if (config.auth) {
        var sess_path = `./tmp/${(Math.random() + 1).toString(36).substring(7)}.json`
        fs.writeFileSync(sess_path, JSON.stringify(config.auth))
        var { state } = wa.useSingleFileAuthState(sess_path)
    } else {
        var sess_path = `./tmp/${(Math.random() + 1).toString(36).substring(7)}.json`
        var { state } = wa.useSingleFileAuthState(sess_path)
    }
    
    const start = () => {
        const client = makeWASocket({
            auth: state
        })
    
        if (config.before) {
            config.before(client)
        }
    
        client.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update
            if (update.qr && config.qr) {
                config.qr(update.qr)
            }
            if (connection == 'close') {
                client.ev.removeAllListeners()
                client.end()
                var _a, _b;
                var shouldReconnect = ((_b = (_a = lastDisconnect.error) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.statusCode) !== wa.DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    start()
                } else if (config.retry > 0) {
                    console.log(config.retry)
                    config.retry--
                    start()
                } else {
                    if (config.failed) {
                        config.failed(client)
                    }
                }
            } else if (connection == 'open') {
                setTimeout(() => {
                    fs.unlinkSync(sess_path)
                }, 8000)
                if (config.success) {
                    config.success(client, state)
                }
            }
        })
    }

    start()
}

module.exports = {
    wa_sessions,
    createWaSession
}