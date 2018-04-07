const mongoose = require('mongoose');

const PublicationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    }
});

PublicationSchema.methods.serialize = function() {
    return this.title;
};

const Publication = mongoose.model('Publication', PublicationSchema);

module.exports = Publication;