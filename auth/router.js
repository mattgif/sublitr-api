const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');

const {JWT_SECRET, JWT_EXPIRY} = require('../config');

const router = express.Router();

const createAuthToken = function(user) {
    return jwt.sign({user}, JWT_SECRET, {
        subject: user.email,
        expiresIn: JWT_EXPIRY,
        algorithm: 'HS256'
    });
};

const localAuth = passport.authenticate('local', {session: false});

router.post('/login', localAuth, (req, res) => {
    const authToken = createAuthToken(req.user.serialize());
    res.json({authToken})
});

module.exports = router;