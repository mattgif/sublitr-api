const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const mime = require('mime-types');
const fs = require('fs');
const shortid = require('shortid');
const Publication = require('./models');
const {User} = require('../users/models');
const {s3PublicUpload, s3PublicDelete} = require('./aws-handler');

const router = express.Router();
const DEFAULT_IMAGE = 'https://s3.amazonaws.com/sublitr-images/logo.svg';

const jsonParser = bodyParser.json();
const jwtAuth = passport.authenticate('jwt', {session: false});
const MAX_FILE_SIZE = 25 * 1024 *1024; // 25 MB

router.use(jsonParser);

router.get('/', (req, res) => {
    Publication.find()
        .then(pubs => {
            return res.status(200).json(pubs.map(pub => pub.serialize()))
        });
});

router.delete('/:id', jwtAuth, (req, res) => {
    if (!req.user.admin) {
        return Promise.reject({
            code: 401,
            reason: 'AuthenticationError',
            message: 'Only admins can delete publications'
        })
    }
    return Publication.findById(req.params.id)
        .then(pub => {
            if (pub.image && pub.image !== DEFAULT_IMAGE) {
                s3PublicDelete(pub.image)
            }
            pub.remove()
                .then(() => {
                    console.log(`Deleted publication ${req.params.id}`);
                    res.status(204).end()
                })
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({code: 500, message: 'Internal server error'})
        })
});

router.put('/:id', jwtAuth, (req, res) => {
    if (!req.user.admin) {
        return Promise.reject({
            code: 401,
            reason: 'AuthenticationError',
            message: 'Only admins can update publications'
        })
    }

    if (!req.body.editors) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: 'editors'
        })
    }

    const {editors} = req.body;

    // toggle editor to true for all users included as editor
    const editorIds = Object.keys(editors).map(e => {return editors[e].id});
    User.updateMany( {_id: {$in : editorIds}}, {editor: true} ).then(() => console.log('updated')).catch(console.error)

    return Publication.findById(req.params.id)
        .then(pub => {
            console.log(editors);
            pub.editors = editors;
            pub.save().then((pub) => res.status(200).json(pub.serialize()));
        })
        .catch(err => {
            if (err.reason === 'Forbidden') {
                return res.status(err.code).json(err)
            }
            res.status(500).json({code: 500, message: 'Internal server error'})
        });

});

router.post('/', [jwtAuth, bodyParser.urlencoded({ extended: true }), fileUpload({ limits: { fileSize: MAX_FILE_SIZE } , abortOnLimit: true})], (req, res) => {
    if (!req.user.admin) {
        return Promise.reject({
            code: 401,
            reason: 'AuthenticationError',
            message: 'Only admins can create publications'
        })
    }

    const requiredFields = ['title'];
    const missingField = requiredFields.find(field => !(field in req.body));
    if (missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: missingField
        })
    }

    const stringFields = ['title'];
    const nonStringField = stringFields.find(field => (field in req.body) && !(typeof req.body[field] === 'string'));
    if (nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: `${nonStringField} must be a string`,
            location: nonStringField
        })
    }

    // Check that fields meet length requirements
    const sizedFields = {
        title: {min: 1, max: 128}
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

    let editors = {};
    if (req.body.editors) {
        // parse array, then toggle editor to true for all editor ids
        editors = JSON.parse(req.body.editors).reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});

        // const editorIds = Object.keys(editors).map(e => editors[e].id);
        // User.updateMany( {_id: {$in : editorIds}}, {editor: true} ).catch(console.error)
    }

    const newPublication = {
        title: req.body.title,
        abbr: shortid.generate(),
        editors
    };

    // upload the submission to s3 and get the url
    let image = '';
    if (req.files && req.files.image) {
        image = `${newPublication.abbr}-image.jpg`;
        s3PublicUpload({
            Key: image,
            Body: req.files.image.data,
            ContentType: req.files.image.mimetype
        });
        newPublication.image = 'https://s3.amazonaws.com/sublitr-images/' + image;
    }

    return Publication.find({title: newPublication.title}).count()
        .then(count => {
            if (count > 0) {
                // Reject if collision found
                return Promise.reject({
                    code: 422,
                    reason: 'ValidationError',
                    message: 'Publication with that name already exists',
                    location: 'title'
                })
            }
        })
        .then(() => {
            return Publication.create(newPublication)
                .then(pub => {return res.status(201).json(pub.serialize())})
        })
        .catch(err => {
            if (err.reason === 'ValidationError') {
                return res.status(err.code).json(err);
            }
            res.status(500).json({code: 500, message: 'Internal server error'})
        });
});

module. exports = router;