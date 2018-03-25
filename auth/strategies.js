'use strict';

const LocalStrategy = require('passport-local');

const {User} = require('../users/models');

const localStrategy = new LocalStrategy((email, password, callback) => {
    User.findOne({email: email})
        .then(user => {
            return user.validatePassword(password)
        })
        .then(isValid => {
            return callback(null, user)
        })
});

module.exports = {localStrategy};