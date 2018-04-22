const chai = require('chai');
const chaiHttp = require('chai-http');
const {app, runServer, closeServer} = require('../server');
const faker = require('faker');
const Publication = require('../publications/models');
const {TEST_DATABASE_URL} = require('../config');
const jwt = require('jsonwebtoken');
const {JWT_SECRET} = require('../config');

const expect = chai.expect;
const NUM_OF_PUBS = 5;

const adminToken = jwt.sign({
        user: {
            email: 'asdf@asdf.com',
            firstName: 'Firstathy',
            lastName: 'Lastnamerham',
            admin: true,
            editor: false
        }
    },
    JWT_SECRET,
    {
        algorithm: 'HS256',
        subject: 'asdf@asdf.com',
        expiresIn: '7d'
    }
);

chai.use(chaiHttp);

function seedDb(NUM_OF_PUBS) {
    const pubs = [];
    for(let i=0; i<NUM_OF_PUBS; i++) {
        pubs.push({
            title: faker.random.words(),
            abbr: faker.random.uuid(),
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
            .set('Authorization', `Bearer ${adminToken}`)
            .then(res => {
                expect(res).to.have.status(200);
                expect(res).to.be.json;
                expect(res.body).to.be.an('array');
                expect(res.body.length).to.be.at.least(NUM_OF_PUBS);
            })
    });

    it('should create a new publication', () => {
        return chai.request(app)
            .post('/api/publications')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({title: 'new submission'})
            .then(res => {
                expect(res).to.have.status(201);
                expect(res).to.be.json;
                expect(res.body).to.be.an('object');
                expect(res.body).to.have.all.keys('title', 'id', 'abbr', 'editors', 'image')
            })
    });

    it('should delete a publication', () => {
        let id;
        const title = 'asdfasdfasdf';
        Publication.create({
            title: title,
            abbr: 'asdf'
        })
            .then(pub => {
                id = pub._id;
                return chai.request(app)
                    .delete(`api/publications/${id}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .then(res => {
                        expect(res).to.have.status(204);
                        return Publication.find({title}).count()
                            .then(count => expect(count).to.equal(0))
                    })
            })
    });

    it('should update a publication', () => {
        const newTitle = 'foooooooooo';
        let id;
        Publication.create({
            title: 'baaaaaaar',
            abbr: 'asdfasdf'
        })
            .then(pub => {
                id = pub._id;
                return chai.request(app)
                    .put(`api/publications/${id}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({title: newTitle})
                    .then(res => {
                        expect(res).to.have.status(200);
                        expect(res).to.be.json;
                        expect(res.body).to.be.an('object');
                        expect(res.body.title).to.equal(newTitle);
                    })
            })
    })
});



