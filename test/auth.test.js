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
    // user.id is generated from mongodb _id, so needs to be reset with each instance
    let userID;

    before(function () {
        return runServer(TEST_DATABASE_URL)
    });

    beforeEach(function () {
        return User.hashPassword(password).then(password =>
            User.create({email,firstName,lastName,password}))
            .then(user => userID = user.id);
    });

    afterEach(function () {
        return tearDownDb();
    });

    after(function () {
        return closeServer()
    });

    describe('api/auth/login', () => {
        it('should reject a login with no credentials', () => {
            return chai.request(app).post('/api/auth/login')
                .then(res => expect(res).to.have.status(400))
        });

        it('should reject a login with invalid email', () => {
            return chai.request(app).post('/api/auth/login').send({email: 'notInDb@example.com', password})
                .then(res => expect(res).to.have.status(401))
        });

        it('should reject a login with invalid password', () => {
            return chai.request(app).post('/api/auth/login').send({email, password: 'badpassword'})
                .then(res => expect(res).to.have.status(401))
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
                    expect(payload.user).to.deep.equal({
                        email,
                        firstName,
                        lastName,
                        editor: false,
                        admin: false,
                        id: userID
                    })
                })
        });
    });

    describe('api/auth/refresh', () => {
        it('Should reject requests with no credentials', () => {
            return chai.request(app).post('/api/auth/refresh').then(res => expect(res).to.have.status(401));
        });

        it('Should reject requests with an invalid token', () => {
            const token = jwt.sign(
                {email, firstName, lastName, editor: false, admin: false, id: userID},
                'wrongSecret',
                {algorithm: 'HS256', expiresIn: '7d'}
            );
            return chai
                .request(app)
                .post('/api/auth/refresh')
                .set('Authorization', `Bearer ${token}`)
                .then(res => expect(res).to.have.status(401));
        });

        it('Should reject requests with an expired token', function () {
            const token = jwt.sign(
                {
                    user: {
                        email,
                        firstName,
                        lastName,
                        editor: false,
                        admin: false,
                        id: userID
                    },
                    exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: email
                }
            );

            return chai
                .request(app)
                .post('/api/auth/refresh')
                .set('authorization', `Bearer ${token}`)
                .then(res => expect(res).to.have.status(401));
        });

        it('Should return a valid auth token with a newer expiry date', function () {
            // Strategy: create valid token, post, and compare expiry
            const token = jwt.sign(
                {
                    user: {
                        email,
                        firstName,
                        lastName,
                        editor: false,
                        admin: false,
                        id: userID
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: email,
                    expiresIn: '7d'
                }
            );
            const decoded = jwt.decode(token);

            return chai
                .request(app)
                .post('/api/auth/refresh')
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
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
                        admin: false,
                        id: userID
                    });
                    expect(payload.exp).to.be.at.least(decoded.exp);
                });
        });
    });
});