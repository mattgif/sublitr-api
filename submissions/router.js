const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const mime = require('mime-types');
const fs = require('fs');

const {Submission} = require('../submissions/models');
const {s3Upload, s3Delete, s3Get} = require('./aws-handler');

const router = express.Router();

const jsonParser = bodyParser.json();
const jwtAuth = passport.authenticate('jwt', {session: false});
const MAX_FILE_SIZE = 25 * 1024 *1024; // 25 MB

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

router.get('/:submissionID/:key', (req, res) => {
    Submission.findById(req.params.submissionID).then(sub => {
        if (!req.user.admin && !req.user.editor && req.user.id !== sub.authoriD) {
            return Promise.reject({
                code: 401,
                reason: 'AuthenticationError',
                message: 'Not authorized to view submission'
            })
        }
        const key = req.params.key;
        s3Get(key).then(s3response => {
            const {getStream, data} = s3response;
            const stream = getStream();
            res.set('Content-Type', mime.lookup(key));
            res.set('Content-Length', data.ContentLength);
            res.set('Last-Modified', data.LastModified);
            res.set('ETag', data.ETag);
            stream.pipe(res)
        })
    })
        .catch(console.error)
        //.catch(() => res.status(500).json({code: 500, message: 'Internal server error'}))
});

router.post('/', [bodyParser.urlencoded({ extended: true }), fileUpload({ limits: { fileSize: MAX_FILE_SIZE } , abortOnLimit: true})], (req, res) => {
    // Check for missing fields
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

    if (!req.files) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: 'doc'
        })
    }

    // Check that each field is the correct type
    const stringFields = ['title', 'publication', 'coverLetter'];
    const nonStringField = stringFields.find(field => (field in req.body) && !(typeof req.body[field] === 'string'));
    if (nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: `${nonStringField} must be a string`,
            location: nonStringField
        })
    }

    const acceptedFileTypes = ['application/pdf'];
    if (!(acceptedFileTypes.includes(req.files.doc.mimetype))) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: `Invalid file type`,
            location: 'doc'
        })
    }

    // Check that fields meet length requirements
    const sizedFields = {
        title: {min: 1, max: 128},
        coverLetter: {max: 3000}
    };

    const tooSmallField = Object.keys(sizedFields).find(field =>
        'min' in sizedFields[field]
        && field in req.body
        && (req.body[field].trim().length < sizedFields[field].min)
    );

    const tooLargeField = Object.keys(sizedFields).find(field =>
        'max' in sizedFields[field]
        && field in req.body
        && req.body[field].trim().length > sizedFields[field].max
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

    // upload the submission to s3 and get the url
    s3Upload({
        Key: `${req.user.id}-${req.files.doc.name}`,
        Body: req.files.doc.data,
        ContentType: req.files.doc.mimetype
    }).then(fileName => {
        Submission.create(
            {
                title: req.body.title,
                author: `${req.user.firstName} ${req.user.lastName}`,
                authorID: req.user.id,
                publication: req.body.publication,
                coverLetter: req.body.coverLetter,
                file: fileName
            }
        ).then(sub => {
            return res.status(201).json(sub.serialize((req.user.admin || req.user.editor)))
        })
    }).catch(() => res.status(500).json({code: 500, message: 'Internal server error'}))
});

router.post('/:id/comment', (req, res) => {
    if (!(req.user.admin || req.user.editor)) {
        return res.status(401).json({
            code: 401,
            reason: 'AuthenticationError',
            message: `Not authorized to comment on submission ${req.params.id}`
        })
    }

    // make sure comment is present and not empty
    if (!req.body.text || (req.body.text.trim().length < 1)) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: `Comment cannot be empty`,
            location: 'text'
        })
    }

    const text = req.body.text.trim();
    const comment = {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        authorID: req.user.id,
        text
    };

    Submission.findById(req.params.id)
        .then(submission => {
            const newComment = submission.reviewerInfo.comments.create(comment);
            submission.reviewerInfo.comments.push(newComment);
            submission.save()
                .then(() => res.status(201).json(newComment._doc))
        })
        .catch(() => res.status(500).json({code: 500, message: 'Internal server error'}))
});

router.delete('/:id/comment/:commentId', (req, res) => {
    Submission.findById(req.params.id)
        .then(sub => {
            const targetComment = sub.reviewerInfo.comments.id(req.params.commentId);
            if (!(req.user.admin) && req.user.id !== targetComment.authorID) {
                return Promise.reject({
                    code: 401,
                    reason: 'AuthenticationError',
                    message: 'Not authorized to delete comment'
                })
            }

            if (req.body.submissionId !== sub._id.toString() || req.body.commentId !== targetComment._id.toString()) {
                return Promise.reject({
                    code: 400,
                    reason: 'Mismatch',
                    message: 'Submission or Comment ID incorrect'
                })
            }
            targetComment.remove();
            sub.save()
                .then(() => res.status(204).json({ok: true}))
        })
        .catch(err => {
            if (err.reason === 'AuthenticationError' || err.reason === 'Mismatch') {
                return res.status(err.code).json(err);
            }
            res.status(500).json({code: 500, message: 'Internal server error'})
        })
});

router.put('/:id', (req, res) => {
    if (!req.user.admin && !req.user.editor) {
        return res.status(401).json({
            code: 401,
            reason: 'AuthenticationError',
            message: `Not authorized to update submission ${req.params.id}`
        })
    }

    if (req.params.id !== req.body.id) {
        return res.status(400).json({
            code: 400,
            reason: 'BadRequest',
            message: 'Submission ID mismatch'
        })
    }

    const stringFields = ['decision', 'recommendation'];
    const nonStringField = stringFields.find(field => (field in req.body.reviewerInfo) && (typeof req.body.reviewerInfo[field] !== 'string'));
    if (nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: `${nonStringField} must be a string`,
            location: nonStringField
        })
    }

    Submission.findById(req.params.id)
        .then(sub => {
            for (let key in req.body.reviewerInfo) {
                sub.reviewerInfo[key] = req.body.reviewerInfo[key]
            }
            sub.status = sub.reviewerInfo.decision;
            sub.save()
                .then(updated => res.status(204).json({ok: true, message: `${updated._id} updated`}))
        })
        .catch(() => res.status(500).json({code: 500, message: 'Internal server error'}))
});

router.delete('/:id', (req, res) => {
    if (!req.user.admin && !req.user.editor) {
        return res.status(401).json({
            code: 401,
            reason: 'AuthenticationError',
            message: `Not authorized`
        })
    }

    Submission.findById(req.params.id)
        .then(sub => {
            s3Delete(sub.file);
            sub.remove()
        })
        .then(() => res.status(204).end())
        .catch(() => res.status(500).json({code: 500, message: 'Internal server error'}))
});

module.exports = router;

