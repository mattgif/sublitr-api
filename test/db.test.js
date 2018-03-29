const chai = require('chai');
const mongoose = require('mongoose');
const faker = require('faker');

const {runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');
const {User} = require('../users/models');
const {Submission} = require('../submissions/models');

const expect = chai.expect;

function tearDownDb() {
    return mongoose.connection.dropDatabase();
}

function seedSubmissions() {
    let submissions = []
    for (let i=0; i<10; i++) {
        submissions.push({
            title: faker.lorem.words(),
            author: faker.name.findName(),
            authorID: faker.random.number(),
            publication: faker.random.words(),
            file: faker.system.commonFileName(),
        })
    }
    Submission.insertMany(submissions)
}

describe('User collection', () => {
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

describe('Submissions collection', () => {
    const title = "Demo title";
    const author = "Abbie Author";
    const authorID = "u5555555";
    const publication = "Journal 1";
    const file = '/file/location.pdf';


    before(function() {
        return runServer(TEST_DATABASE_URL)
    });

    beforeEach(function() {
       return seedSubmissions()
    });

    afterEach(function() {
        return Submission.remove({});
    });

    after(function() {
        return closeServer()
    });

    it('should create a new submission', () => {
        return Submission.create({title, author, authorID, publication, file})
            .then(submission => {
                expect(submission.title).to.equal(title);
                expect(submission.author).to.equal(author);
                expect(submission.authorID).to.equal(authorID);
                expect(submission.publication).to.equal(publication);
                expect(submission.file).to.equal(file);
                expect(submission.status).to.equal('pending');
                expect(submission.reviewerInfo.decision).to.equal('pending');
                expect(submission.reviewerInfo.recommendation).to.equal('none');
            })
    })
});