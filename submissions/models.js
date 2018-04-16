const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    authorID: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: Date.now
    }
});


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
    coverLetter: String,
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
            default: Date.now
        },
        comments: [CommentSchema]
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
        coverLetter: this.coverLetter,
        file: this.file
    };

    if (editor) {
        submission.reviewerInfo = this.reviewerInfo;
    }

    return submission;
};

const Submission = mongoose.model('Submission', SubmissionSchema);

module.exports = {Submission};

