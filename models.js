const mongoose = require('mongoose')

const User = mongoose.model('User', {
    name: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    whatsapp_id: {
        type: String,
    },
})

const WaSession = mongoose.model('WaSession', {
    user_id: {
        type: Number,
        required: true,
    },
    session: {
        type: String,
        required: true,
    }
})

module.exports = { User, WaSession }