'use strict';

const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const UserSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    admin: {
        type: Boolean,
        required: true,
        default: false
    },
    editor: {
        type: Boolean,
        required: true,
        default: false
    },
    password: {
        type: String,
        required: true
    }
});

UserSchema.methods.serialize = function() {
    return {
        firstName: this.firstName,
        lastName: this.lastName,
        admin: this.admin,
        editor: this.editor,
        email: this.email,
        id: this._id
    }
};

UserSchema.methods.validatePassword = function(password) {
    return bcrypt.compare(password, this.password)
};

UserSchema.statics.hashPassword = function(password) {
    return bcrypt.hash(password, 10)
};

const User = mongoose.model('User', UserSchema);

module.exports = {User};