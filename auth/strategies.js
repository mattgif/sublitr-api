'use strict';
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');

const { User } = require('../users/models');
const {JWT_SECRET} = require('../config');

const localStrategy = new LocalStrategy({usernameField: 'email'}, (email, password, callback) => {
    // Strategy: Look for supplied email in db (reject if not found), validate password with method on User object
    // (reject if invalid), callback when done
    let user;
    User.findOne({ email: email })
        .then(_user => {
            user = _user;
            if (!user) {
                return Promise.reject({
                    reason: 'LoginError',
                    message: 'Incorrect email or password'
                });
            }
            return user.validatePassword(password);
        })
        .then(isValid => {
            if (!isValid) {
                return Promise.reject({
                    reason: 'LoginError',
                    message: 'Incorrect email or password'
                });
            }
            return callback(null, user);
        })
        .catch(err => {
            if (err.reason === 'LoginError') {
                return callback(null, false, err);
            }
            return callback(err, false);
        });
});

const jwtStrategy = new JwtStrategy({
        // Strategy: Check header for 'Bearer' and decrypt with JWT_SECRET & HS256
        // assign payload to req.user
        secretOrKey: JWT_SECRET,
        jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('Bearer'),
        algorithms: ['HS256']
    },
    (payload, done) => {done(null, payload.user)}
);

module.exports = {localStrategy, jwtStrategy};