'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');

const {app, runServer, closeServer} = require('../server');
const {User} = require('../users/models');

const {TEST_DATABASE_URL, JWT_SECRET} = require('../config');
const expect = chai.expect;

chai.use(chaiHttp);

describe('Auth endpoints', () => {
    const email = 'user@example.com';
    const password = 'passtest123';
    const firstName = 'Testy';
    const lastName = 'Testman';

    before(function () {
        runServer(TEST_DATABASE_URL)
    });

    beforeEach(function () {
        return User.hashPassword(password)
            .then(hashedPass => {
                User.create({
                    email,
                    firstName,
                    lastName,
                    password: hashedPass
                })
            })
    });

    afterEach(function () {
        return mongoose.connection.dropDatabase();
    });

    after(function () {
        closeServer()
    });

    it('should reject a login with no credentials', () => {
        return chai.request(app).post('/api/auth/login')
            .then(res => expect(res).to.have.status(400))
    });

    it('should return a valid auth token', () => {
        return chai.request(app)
            .post('/api/auth/login')
            .send({email: email, password: password})
            .then(res => {
                expect(res).to.have.status(200);
                expect(res).to.be.an('object');
                const token = res.body.authToken;
                expect(token).to.be.a('string');
                const payload = jwt.verify(token, JWT_SECRET, {
                    algorithm: ['HS256']
                });
                expect(payload.user).to.deep.equal({
                    email,
                    firstName,
                    lastName,
                    editor: false,
                    admin: false
                })
            })
    })
});