const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    author: {
        type: String,
        required: true,
    },
    authorID: {
        type: String,
        required: true,
    },
    submitted: {
        type: Date,
        required: true,
        default: Date.now()
    },
    publication: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
        default: 'pending'
    },
    file: {
        type: String,
        required: true,
    },
    reviewerInfo: {
        decision: {
            type: String,
            required: true,
            default: 'pending'
        },
        recommendation: {
            type: String,
            required: true,
            default: 'none'
        },
        lastAction: Date,
        comments: [{
            name: String,
            authorID: String,
            date: Date,
            text: String
        }]
    }

});

const Submission = mongoose.model('Submission', SubmissionSchema);

module.exports = {Submission};

