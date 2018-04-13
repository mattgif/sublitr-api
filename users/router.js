const express = require('express');
const router = express.Router();
const bodyParser = require('body-parser');
const passport = require('passport');

const {User} = require('./models');

const jsonParser = bodyParser.json();
const jwtAuth = passport.authenticate('jwt', {session: false});

router.use(jsonParser);

router.get('/', jwtAuth, (req, res) => {
    // check for admin privileges
    if (!req.user.admin) {
        // redirect so users can get their own profile
        return res.status(401).json({
            code: 401,
            reason: 'AuthenticationError',
            message: 'Not authorized to view user list'
        })
    }

    User.find({})
        .then(users => {
            return res.status(200).json(users.map(user => user.serialize()))
        })
        .catch(() => res.status(500).json({code: 500, message: 'Internal server error'}))
});

router.get('/:id', jwtAuth, (req, res) => {
    if (!((req.user.id === req.params.id) || req.user.admin)) {
        // user is a valid user, but neither an admin, nor the user they're trying to delete
        return res.status(401).json({
            code: 401,
            reason: 'AuthenticationError',
            message: 'Not authorized to view account'
        })
    }

    User.findById(req.params.id).then(user => {
        res.status(200).json(user.serialize())
    })
});

router.post('/', (req, res) => {
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
        return res.status(422).json({
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

router.put('/:id', jwtAuth, (req, res) => {
    // check for admin privileges
    if (!req.user.admin) {
        return res.status(401).json({
            code: 401,
            reason: 'AuthenticationError',
            message: 'Not admin'
        })
    }

    const updated = {};
    const topLevelFields = ['firstName', 'lastName', 'email', 'admin', 'editor'];
    topLevelFields.forEach(field => {
        if (field in req.body) {
            updated[field] = req.body[field];
        }
    });

    User
        .findById(req.params.id)
        .then(userToUpdate => {
            for (field in updated) {
                userToUpdate[field] = req.body[field];
            }
            userToUpdate.save();
            return res.status(204).end();
        })
});

router.delete('/:id', jwtAuth, (req, res) => {
    if (!req.user.admin && (req.user.id !== req.params.id)) {
        // user is a valid user, but neither an admin, nor the user they're trying to delete
        return res.status(401).json({
            code: 401,
            reason: 'AuthenticationError',
            message: 'Not authorized to delete account'
        })
    }

    User.findById(req.params.id)
        .then(user => {
            user.remove()
                .then(() => {
                    console.log(`Deleted user with id ${req.params.id}`);
                    res.status(204).end()
                })
        })
});

module.exports = router;