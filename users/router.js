const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');

const {User} = require('./models');

const jsonParser = bodyParser.json();

router.get('/', (req, res) => {
    res.status(200).json({ok: true})
});

router.post('/', jsonParser, (req, res) => {
    // Register a new user

    // Check to make sure all required fields are present
    const requiredFields = ['email', 'firstName', 'lastName', 'password'];
    const missingField = requiredFields.find(field => !(field in req.body));

    if (missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: missingField
        })
    }

    // Check to make sure all fields are correct data type
    const stringFields = ['email', 'firstName', 'lastName', 'password'];
    const nonStringField = stringFields.find(field => typeof req.body[field] !== 'string');

    if (nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Incorrect field type: expected string',
            location: nonStringField
        })
    }

    // Check for leading or trailing whitespace on explicitly trimmed fields
    const trimmedFields = ['email', 'password'];
    const nonTrimmedField = trimmedFields.find(field => req.body[field] !== req.body[field].trim());

    if (nonTrimmedField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Cannot start or end with whitespace',
            location: nonTrimmedField
        })
    }

    // Check that fields meet length requirements
    const sizedFields = {
        password: {min: 8, max: 72},
        firstName: {min: 1},
        lastName: {min: 1}
    };

    const tooSmallField = Object.keys(sizedFields).find(field =>
        'min' in sizedFields[field] && (req.body[field].trim().length < sizedFields[field].min)
    );

    const tooLargeField = Object.keys(sizedFields).find(field =>
        'max' in sizedFields[field] && req.body[field].trim().length > sizedFields[field].max
    );

    if (tooLargeField || tooSmallField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: tooLargeField ? `Can't be more than ${sizedFields[tooLargeField].max} characters long`
                : `Must be at least ${sizedFields[tooSmallField].min} characters long`,
            location: tooLargeField || tooSmallField
        })
    }

    // Check that email follows valid pattern
    const emailIsValid = email => {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    };

    if (!(emailIsValid(req.body.email))) {
        res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Invalid email address',
            location: 'email'
        })
    }

    let {email, firstName, lastName, password} = req.body;
    firstName = firstName.trim();
    lastName = lastName.trim();

    return User.find({email})
        // Check if user w/that email is already in the db
        .count()
        .then(count => {
            if (count > 0) {
                // Reject if collision found
                return Promise.reject({
                    code: 422,
                    reason: 'ValidationError',
                    message: 'User with that email already exists',
                    location: 'email'
                })
            }
            // No user w/email exists, generate hashed pw
            return User.hashPassword(password);
        })
        .then(hashedPassword => {
            return User.create({
                email,
                firstName,
                lastName,
                password: hashedPassword
            });
        })
        .then(user => {
           return res.status(201).json(user.serialize());
        })
        .catch(err => {
            if (err.reason === 'ValidationError') {
                return res.status(err.code).json(err);
            }
            res.status(500).json({code: 500, message: 'Internal server error'})
        });
});

module.exports = router;