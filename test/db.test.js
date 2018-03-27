const chai = require('chai');
const mongoose = require('mongoose');

const {runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');
const {User} = require('../users/models');

const expect = chai.expect;

function tearDownDb() {
    return mongoose.connection.dropDatabase();
}

describe('User collection in db', () => {
    const email = 'user@example.com';
    const password = 'passtest123';
    const firstName = 'Testy';
    const lastName = 'Testman';

    before(function() {
        return runServer(TEST_DATABASE_URL)
    });

    afterEach(function() {
        return tearDownDb();
    });

    after(function() {
        return closeServer()
    });

    it('should create a new user', () => {
        return User.create({email,firstName,lastName,password}).then(user => {
            expect(user.firstName).to.equal(firstName);
            expect(user.lastName).to.equal(lastName);
            expect(user.email).to.equal(email);
        })
    });

    it('should have a serialize method that returns user with correct keys', () => {
        return User.create({email,firstName,lastName,password}).then(user => {
            return user.serialize()
        })
            .then(user => {
                const fields = ['email', 'firstName', 'lastName', 'admin', 'editor'];
                fields.forEach(field => {
                    expect(field in user).to.be.true;
                });
                expect('password' in user).to.be.false;
            });
    })
});