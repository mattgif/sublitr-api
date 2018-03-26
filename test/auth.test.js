'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL, JWT_SECRET} = require('../config');
const {User} = require('../users/models');

const expect = chai.expect;
chai.use(chaiHttp);

// tear down for afterEach block
function tearDownDb() {
    return mongoose.connection.dropDatabase();
}

describe('Auth endpoints', () => {
    const email = 'user@example.com';
    const password = 'passtest123';
    const firstName = 'Testy';
    const lastName = 'Testman';

    before(function () {
        return runServer(TEST_DATABASE_URL)
    });

    beforeEach(function () {
        return User.hashPassword(password).then(password =>
            User.create({email,firstName,lastName,password}))
    });

    afterEach(function () {
        return tearDownDb();
    });

    after(function () {
        return closeServer()
    });

    it.skip('should reject a login with no credentials', () => {
        return chai.request(app).post('/api/auth/login')
            .then(res => expect(res).to.have.status(400))
    });

    it('should return a valid auth token', () => {
        return chai.request(app)
            .post('/api/auth/login')
            .send({email, password})
            .then(res => {
                expect(res).to.have.status(200);
                expect(res).to.be.an('object');
                const token = res.body.authToken;
                expect(token).to.be.a('string');
                const payload = jwt.verify(token, JWT_SECRET, {
                    algorithm: ['HS256']
                });
                const id = payload.user.id;
                expect(payload.user).to.deep.equal({
                    email,
                    firstName,
                    lastName,
                    editor: false,
                    admin: false,
                    id
                })
            })
    })
});