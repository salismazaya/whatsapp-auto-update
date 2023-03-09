const express = require('express')
const session = require('express-session')
const mongoose = require('mongoose')
const MongoDBStore = require('connect-mongodb-session')(session)
const flash = require('connect-flash')
const bcrypt = require('bcrypt')
const bodyParser = require('body-parser')
const { User, WaSession } = require('./models')
const { login_required, logout_required } = require('./middlewares')
const { createWaSession, wa_sessions } = require('./wa')
const app = express()
const http = require('http')
const server = http.createServer(app)
const { Server } = require('socket.io')
const qrcode = require('qrcode')
const io = new Server(server)
const PORT = process.env.PORT || 3000

const store = new MongoDBStore({
	uri: process.env.DATABASE || 'mongodb://127.0.0.1:27017/wa-auto-update',
	collection: 'sessions'
})

app.set('view engine', 'ejs')
app.use('/static', express.static('./static'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(flash())

app.use(session({
	secret: process.env.SECRET_KEY || 'salisganteng',
	saveUninitialized: false,
	resave: true,
	cookie: {
		maxAge: 1000 * 60 * 60 * 24 * 3
	},
	store
}))

app.use((req, res, next) => {
	res.locals.get_messages = () => {
		return req.flash('messages')
	}

	console.log(`${req.method} - ${req.path}`)
	next()
})

io.on('connection', (socket) => {
	socket.on('connect-wa', async (sess_id) => {
	  	const sess = await mongoose.connection.db.collection('sessions').findOne({
			_id: sess_id
	  	})
		const wa_session = await WaSession.findOne({
			user_id: sess.session.user._id.toString()
		})

		const user = await User.findOne({
			_id: sess.session.user._id.toString()
		})

		if (wa_session || !user) {
			return
		}

		createWaSession({
			retry: 5,
			before: (client) => {
				socket.on('disconnect', async () => {
					client.ev.removeAllListeners()
					client.end()
					console.log('disconnect on qr - closing wa web connection')
				})
			},
			qr: async (qr) => {
				socket.emit('QRImage', await qrcode.toDataURL(qr))
			},
			failed: (client) => {
				console.log('max retries - closing wa web connection')
			},
			success: async (client, authState) => {
				const wa_session = new WaSession({
					user_id: user._id,
					session: JSON.stringify(authState)
				})
				await wa_session.save()
				console.log(wa_session._id)
				wa_sessions[wa_session._id] = client
				socket.emit('connected-wa', authState)
			}
		})
	})

	socket.on('disconnect-wa', async (whatsapp_session_id) => {
		const client = wa_sessions[whatsapp_session_id]
		console.log(whatsapp_session_id)
		if (client) {
			const whatsapp_session_obj = await WaSession.findOne({_id: whatsapp_session_id})
			if (whatsapp_session_obj) {
				await whatsapp_session_obj.delete()
			}
			await client.logout()
		}
	})
})

app.get('/', (req, res) => {
	const context = {
		'title': 'Home',
	}
	res.render('templates/index', context)
})

app.get('/login', logout_required, (req, res) => {
	const context = {
		'title': 'Login',
	}
	res.render('templates/login', context)
})

app.post('/login', async (req, res) => {
	const { username, password } = req.body
	const user = await User.findOne({
		username
	})
	if (!user) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Username tidak ditemukan!'
		})
		res.redirect('/login')
		return
	}

	if (!bcrypt.compareSync(password, user.password)) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Password salah!'
		})
		res.redirect('/login')
		return
	}

	req.session.user = user
	req.flash('messages', {
		'type': 'success',
		'message': 'Ok'
	})
	res.redirect('/dashboard')
})

app.get('/register', (req, res) => {
	const context = {
		'title': 'Register',
	}
	res.render('templates/register', context)
})


app.post('/register', async (req, res) => {
	const { username, password, confirm_password } = req.body
	if (password.length < 5 || password.length > 12) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Password minimal 5, maksimal 12'
		})
		res.redirect('/register')
		return
	} 

	if (confirm_password.length < 5 || confirm_password.length > 12) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Konfirmasi password minimal 5, maksimal 12'
		})
		res.redirect('/register')
		return
	}

	if (!(password == confirm_password)) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Password dan Konfirmasi password tidak sama :)'
		})
		res.redirect('/register')
		return
	}

	if (await User.findOne({ username })) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Username sudah terdaftar :)'
		})
		res.redirect('/register')
		return
	}

	const encrypted_password = bcrypt.hashSync(password, bcrypt.genSaltSync())

	const user = new User({
		name: username,
		username,
		password: encrypted_password
	})
	user.save()

	req.flash('messages', {
		'type': 'success',
		'message': 'Sukses mendaftar :)'
	})
	res.redirect('/register')
})


app.get('/dashboard', login_required, async (req, res) => {
	if (!req.session.user) {
		return
	}
	
	const wa_session = await WaSession.findOne({
		user_id: req.session.user._id.toString()
	})

	const context = {
		title: 'Dashboard',
		sess_id: req.sessionID
	}

	if (wa_session) {
		context.wa_session_id = wa_session._id
		const authState = JSON.parse(wa_session.session)
		context.whatsapp_id = authState.creds.me.id
		context.whatsapp_name = authState.creds.me.verifiedName || authState.creds.me.name || 'Anonymous';
	} else {
		context.whatsapp_id = ''
		context.whatsapp_name = ''
		context.wa_session_id = ''
	}

	context.connect_status = wa_session ? 'connected' : 'disconnect'

	res.render('templates/dashboard', context)
})

mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/wa-auto-update').then(() => {
	WaSession.find({}, (err, sessions) => {
		sessions.forEach(session => {
			const authState = JSON.parse(session.session)
			createWaSession({
				retry: 3,
				auth: authState,
				failed: async (client) => {
					const wa_session = await WaSession.findOne({
						_id: session._id
					})
					if (wa_session) {
						await wa_session.delete()
					}
				},
				success: (client, authState) => {
					wa_sessions[session._id] = client
				}
			})
		})
	})
	server.listen(PORT, () => {
		console.log(`App listening on port ${PORT}`)
	})
})