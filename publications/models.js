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
    },
    editors: Object,
    image: String
});

PublicationSchema.methods.serialize = function() {
    return {id: this._id, title: this.title, abbr: this.abbr, editors: this.editors, image: this.image};
};

const Publication = mongoose.model('Publication', PublicationSchema);

module.exports = Publication;