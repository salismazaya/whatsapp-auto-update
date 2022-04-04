const { makeWALegacySocket } = require('@adiwajshing/baileys')

const createWaSession = (options = {}) => {
    const client = makeWALegacySocket()

    if (options.before) {
        options.before(client)
    }

    client.ev.on('connection.update', (update) => {
        // console.log(update)
        const { connection, lastDisconnect } = update
        if (update.qr && options.qr) {
            options.qr(update.qr)
        }
        if (connection == 'close') {
            client.ev.removeAllListeners()
            client.end()
            if (options.retry > 0) {
                createWaSession({
                    retry: options.retry - 1,
                    qr: options.qr,
                    success: options.success,
                    failed: options.failed,
                    before: options.before
                })
            } else {
                if (options.failed) {
                    options.failed()
                }
            }
        } else if (connection == 'open') {
            if (options.success) {
                options.success(update.legacy, client.authInfo)
            }
        }
    })
}

module.exports = {
    createWaSession
}