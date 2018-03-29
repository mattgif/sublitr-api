const mongoose = require('mongoose');

// TODO: coverletter
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
        lastAction: {
            type: Date,
            required: true,
            default: Date.now()
        },
        comments: [{
            name: String,
            authorID: String,
            date: Date,
            text: String
        }]
    }

});

SubmissionSchema.methods.serialize = function(editor) {
    const submission = {
        id: this._id,
        title: this.title,
        author: this.author,
        authorID: this.authorID,
        submitted: this.submitted,
        status: this.status,
        publication: this.publication,
    };

    if (editor) {
        submission.file = this.file;
        submission.reviewerInfo = this.reviewerInfo;
    }

    return submission;
};

const Submission = mongoose.model('Submission', SubmissionSchema);

module.exports = {Submission};

