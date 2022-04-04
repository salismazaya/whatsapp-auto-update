const login_required = (req, res, next) => {
    if (!req.session.user) {
        res.redirect('/')
        return
    }

    next()
}

const logout_required = (req, res, next) => {
    if (req.session.user) {
        res.redirect('/dashboard')
        return
    }

    next()
}

module.exports = {
    login_required,
    logout_required
}