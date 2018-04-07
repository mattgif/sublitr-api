const express = require('express');
const Publication = require('./models');
const router = express.Router();


router.get('/', (req, res) => {
    Publication.find()
        .then(pubs => {
            return res.status(200).json(pubs.map(pub => pub.serialize()))
        });
});

module. exports = router;