'use strict';

const LocalStrategy = require('passport-local').Strategy;

const {User} = require('../users/models');

const localStrategy = new LocalStrategy((email, password, done) => {
    User.findOne({ email: email }, function (err, user) {
        if (err) { return done(err); }
        if (!user) {
            console.log('bad user');
            return done(null, false, { message: 'Incorrect username.' });
        }
        if (!user.validatePassword(password)) {
            console.log('bad pass');
            return done(null, false, { message: 'Incorrect password.' });
        }
        console.log('goody good good')
        return done(null, user);
    });
});

module.exports = localStrategy;