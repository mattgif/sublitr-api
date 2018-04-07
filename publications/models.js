const mongoose = require('mongoose');

const PublicationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        unique: true
    },
    abbr: {
        type: String,
        required: true,
        unique: true
    }
});

PublicationSchema.methods.serialize = function() {
    return {title: this.title, abbr: this.abbr};
};

const Publication = mongoose.model('Publication', PublicationSchema);

module.exports = Publication;