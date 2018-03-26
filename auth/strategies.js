'use strict';
const { Strategy: LocalStrategy } = require('passport-local');

const { User } = require('../users/models');

const localStrategy = new LocalStrategy({usernameField: 'email'}, (email, password, callback) => {
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

module.exports = {localStrategy};