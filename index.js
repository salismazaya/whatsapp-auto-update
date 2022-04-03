const express = require('express')
const session = require('express-session')
const mongoose = require('mongoose')
const MongoDBStore = require('connect-mongodb-session')(session);
const flash = require('connect-flash')
const bcrypt = require('bcrypt')
const bodyParser = require('body-parser')
const { User, WaSession } = require('./models')
const app = express()
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
	next()
})

app.get('/', (req, res) => {
	console.log(req.session)
	const context = {
		'title': 'Login',
	}
	res.render('templates/index', context)
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
		res.redirect('/')
		return
	}

	if (!bcrypt.compareSync(password, user.password)) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Password salah!'
		})
		res.redirect('/')
		return	
	}

	req.session.user = user
	req.flash('messages', {
		'type': 'success',
		'message': 'Ok'
	})
	res.redirect('/')
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
		res.redirect('')
		return
	} 

	if (confirm_password.length < 5 || confirm_password.length > 12) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Konfirmasi password minimal 5, maksimal 12'
		})
		res.redirect('')
		return
	}

	if (!(password == confirm_password)) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Password dan Konfirmasi password tidak sama :)'
		})
		res.redirect('')
		return
	}

	if (await User.findOne({ username })) {
		req.flash('messages', {
			'type': 'error',
			'message': 'Username sudah terdaftar :)'
		})
		res.redirect('')
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
	res.redirect('')
})

mongoose.connect(process.env.DATABASE || 'mongodb://127.0.0.1:27017/wa-auto-update').then(() => {
	app.listen(PORT, () => {
		console.log(`App listening on port ${PORT}`)
	})
})