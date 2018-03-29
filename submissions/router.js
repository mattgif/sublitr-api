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
                    reason: 'NotFound',
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
            if ((err.reason === 'NotFound') || (err.reason === 'AuthenticationError')) {
                return res.status(err.code).json(err);
            }
            res.status(500).json({code: 500, message: 'Internal server error'})
        })
});

router.post('/', (req, res) => {
    // TODO: file uploads
    const requiredFields = ['title', 'publication'];
    res.status(201).json({ok: true})
});

module.exports = router;

