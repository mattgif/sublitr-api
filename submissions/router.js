const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');

const {Submission} = require('../submissions/models');

const router = express.Router();

const jsonParser = bodyParser.json();
const jwtAuth = passport.authenticate('jwt', {session: false});

router.use(jsonParser);
router.use(jwtAuth);

router.get('/', (req, res) => {
    const adminOrAuthor = (req.user.admin || req.user.editor);
    let query;
    if (!adminOrAuthor) {
        // set query so we only return items matching requester's own id
        query = {authorID: req.user.id}
    }

    Submission.find(query)
        .then(_submissions => {
            const submissions = _submissions.map(submission => submission.serialize(adminOrAuthor));
            res.status(200).json(submissions)
        })
});

router.get('/:submissionID', (req, res) => {
    const adminOrAuthor = (req.user.admin || req.user.editor);
    Submission.findById(req.params.submissionID)
        .then(submission => {
            if (!submission) {
                return Promise.reject({
                    code: 404,
                    reason: 'notFound',
                    message: 'No document with that ID'
                })
            }

            if (!adminOrAuthor && (submission.authorID !== req.user.id)) {
                // user is not admin, editor, or author of doc
                return Promise.reject({
                    code: 401,
                    reason: 'AuthenticationError',
                    message: 'Not authorized to view submission'
                })
            }

            res.status(200).json(submission.serialize(adminOrAuthor))
        })
        .catch(err => {
            if ((err.reason === 'notFound') || (err.reason === 'AuthenticationError')) {
                return res.status(err.code).json(err);
            }
            res.status(500).json({code: 500, message: 'Internal server error'})
        })
});

router.post('/', (req, res) => {
    // Check for missing fields
    // TODO: file field, cover letter
    const requiredFields = ['title', 'publication'];
    const missingField = requiredFields.find(field => !(field in req.body));
    if (missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: missingField
        })
    }

    // Check that each field is the correct type
    // TODO: file type, cover letter
    const stringFields = ['title', 'publication'];
    const nonStringField = stringFields.find(field => !(typeof req.body[field] === 'string'));
    if (nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: `${nonStringField} must be a string`,
            location: nonStringField
        })
    }

    // Check that fields are correctly sized
    // TODO: cover letter
    // Check that fields meet length requirements
    const sizedFields = {
        title: {min: 1, max: 128},
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

    // TODO: file, cover letter
    Submission
        .create({
            title: req.body.title,
            author: `${req.user.firstName} ${req.user.lastName}`,
            authorID: req.user.id,
            publication: req.body.publication,
            file: 'REPLACE'
        })
        .then(sub => {
            return res.status(201).json(sub.serialize((req.user.admin || req.user.editor)))
        })
        .catch(() => res.status(500).json({code: 500, message: 'Internal server error'}))
});

module.exports = router;

