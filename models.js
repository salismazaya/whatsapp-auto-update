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
})

const WaSession = mongoose.model('WaSession', {
    user_id: {
        type: String,
        required: true,
    },
    session: {
        type: String,
        required: true,
    }
})

module.exports = { User, WaSession }