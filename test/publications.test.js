const chai = require('chai');
const chaiHttp = require('chai-http');
const {app, runServer, closeServer} = require('../server');
const faker = require('faker');
const Publication = require('../publications/models');
const {TEST_DATABASE_URL} = require('../config');

const expect = chai.expect;
const NUM_OF_PUBS = 5;

chai.use(chaiHttp);

function seedDb(NUM_OF_PUBS) {
    const pubs = [];
    for(let i=0; i<NUM_OF_PUBS; i++) {
        pubs.push({
            title: faker.random.words(),
            abbr: faker.random.uuid()
        })
    }
    return Publication.insertMany(pubs);
}

describe('publications API', () => {
    before(function() {
        return runServer(TEST_DATABASE_URL)
    });

    beforeEach(function() {
        return seedDb(NUM_OF_PUBS)
    });

    afterEach(function() {
        return Publication.remove();
    });

    after(function() {
        return closeServer()
    });

    it('should return an array of publications', () => {
        return chai.request(app)
            .get('/api/publications')
            .then(res => {
                expect(res).to.have.status(200);
                expect(res).to.be.json;
                expect(res.body).to.be.an('array');
                expect(res.body).to.have.length(NUM_OF_PUBS);
            })
    })

});



