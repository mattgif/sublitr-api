'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');
const {User} = require('../users/models');

const expect = chai.expect;
chai.use(chaiHttp);

// used to generate an object representing a new user
function generateNewUser() {
    return {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password()
    }
}

// tear down for afterEach block
function tearDownDb() {
    return mongoose.connection.dropDatabase();
}

describe('users API', () => {
    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    afterEach(function() {
        return tearDownDb();
    });

    after(function() {
        return closeServer();
    });

    describe('POST endpoint', () => {
        it('should reject users with missing email', () => {
            const userWithoutEmail = {
                firstName: faker.name.firstName(),
                lastName: faker.name.lastName(),
                password: faker.internet.password()
            };
            return chai.request(app)
                .post('/api/users')
                .send(userWithoutEmail)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('email');
                });
        });

        it('should reject users with missing password', () => {
            const userWithoutPassword = {
                firstName: faker.name.firstName(),
                lastName: faker.name.lastName(),
                email: faker.internet.email()
            };

            return chai.request(app)
                .post('/api/users')
                .send(userWithoutPassword)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('password');
                });
        });

        it('should reject users with missing firstName', () => {
            const userWithoutFirstName = {
                lastName: faker.name.lastName(),
                email: faker.internet.email(),
                password: faker.internet.password()
            };
            return chai.request(app)
                .post('/api/users')
                .send(userWithoutFirstName)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('firstName');
                });
        });

        it('should reject users with missing lastName', () => {
            const userWithoutLastName = {
                firstName: faker.name.firstName(),
                email: faker.internet.email(),
                password: faker.internet.password()
            };
            return chai.request(app)
                .post('/api/users')
                .send(userWithoutLastName)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('lastName');
                });
        });

        it('should reject users with non-string email', () => {
            const userWithNonStringEmail = generateNewUser();
            userWithNonStringEmail.email = 333333;
            return chai.request(app)
                .post('/api/users')
                .send(userWithNonStringEmail)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Incorrect field type: expected string');
                    expect(res.body.location).to.equal('email');
                });
        });

        it('should reject users with non-string password', () => {
            const userWithNonStringPassword = generateNewUser();
            userWithNonStringPassword.password = 333333;
            return chai.request(app)
                .post('/api/users')
                .send(userWithNonStringPassword)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Incorrect field type: expected string');
                    expect(res.body.location).to.equal('password');
                });
        });

        it('should reject users with non-string firstName', () => {
            const userWithNonStringFirstName = generateNewUser();
            userWithNonStringFirstName.firstName = 333333;
            return chai.request(app)
                .post('/api/users')
                .send(userWithNonStringFirstName)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Incorrect field type: expected string');
                    expect(res.body.location).to.equal('firstName');
                });
        });

        it('should reject users with non-string lastName', () => {
            const userWithNonStringLastName = generateNewUser();
            userWithNonStringLastName.lastName = 333333;
            return chai.request(app)
                .post('/api/users')
                .send(userWithNonStringLastName)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Incorrect field type: expected string');
                    expect(res.body.location).to.equal('lastName');
                });
        });

        it('should reject users with non-trimmed email', () => {
            const userWithWhiteSpaceEmail = generateNewUser();
            userWithWhiteSpaceEmail.email = ` ${userWithWhiteSpaceEmail.email}`;
            return chai.request(app)
                .post('/api/users')
                .send(userWithWhiteSpaceEmail)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Cannot start or end with whitespace');
                    expect(res.body.location).to.equal('email');
                })
        });

        it('should reject users with non-trimmed password', () => {
            const userWithWhiteSpacePassword = generateNewUser();
            userWithWhiteSpacePassword.password = ` ${userWithWhiteSpacePassword.password}`;
            return chai.request(app)
                .post('/api/users')
                .send(userWithWhiteSpacePassword)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Cannot start or end with whitespace');
                    expect(res.body.location).to.equal('password');
                })
        });

        it('should reject users with empty firstName', () => {
            const userWithEmptyFirstName = generateNewUser();
            userWithEmptyFirstName.firstName = '';
            return chai.request(app)
                .post('/api/users')
                .send(userWithEmptyFirstName)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Must be at least 1 characters long');
                    expect(res.body.location).to.equal('firstName');
                })
        });

        it('should reject users with empty lastName', () => {
            const userWithEmptyLastName = generateNewUser();
            userWithEmptyLastName.lastName = '';
            return chai.request(app)
                .post('/api/users')
                .send(userWithEmptyLastName)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Must be at least 1 characters long');
                    expect(res.body.location).to.equal('lastName');
                })
        });

        it('should reject users with passwords < 8 characters', () => {
            const userTooShortPass = generateNewUser();
            userTooShortPass.password = '1234567';
            return chai.request(app)
                .post('/api/users')
                .send(userTooShortPass)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Must be at least 8 characters long');
                    expect(res.body.location).to.equal('password');
                })
        });

        it('should reject users with passwords > 72 characters', () => {
            const userTooLongPass = generateNewUser();
            userTooLongPass.password = new Array(73).fill('a').join('');
            return chai.request(app)
                .post('/api/users')
                .send(userTooLongPass)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal(`Can't be more than 72 characters long`);
                    expect(res.body.location).to.equal('password');
                })
        });

        it('should reject users with emails that already exist', () => {
            const newUser = generateNewUser();
            // Create an initial user
            return User.create(newUser)
            // Try to create a second user with the same username
                .then(() =>chai.request(app).post('/api/users').send(newUser))
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('User with that email already exists');
                    expect(res.body.location).to.equal('email');
                });
        });

        describe('reject users with invalid email address', () => {
            const invalidEmails = ['asdf', 'asdf.com', 'asdf@asdf', '@.com'];
            invalidEmails.forEach(invalidAddress => {
                it(`should reject email of ${invalidAddress}`, () => {
                    const newUser = generateNewUser();
                    newUser.email = invalidAddress;
                    return chai.request(app).post('/api/users').send(newUser)
                        .then(res => {
                            expect(res).to.have.status(422);
                            expect(res.body.reason).to.equal('ValidationError');
                            expect(res.body.message).to.equal('Invalid email address');
                            expect(res.body.location).to.equal('email');
                        })
                });
            });
        });

        it('should add a new user', () => {
            const newUser = generateNewUser();
            return chai.request(app)
                .post('/api/users')
                .send(newUser)
                .then(res => {
                    expect(res).to.have.status(201);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('object');
                    expect(res.body).to.have.keys(
                        'firstName',
                        'lastName',
                        'email',
                        'id',
                        'editor',
                        'admin'
                    );
                    expect(res.body.firstName).to.equal(newUser.firstName);
                    expect(res.body.lastName).to.equal(newUser.lastName);
                    expect(res.body.email).to.equal(newUser.email);
                    //    check for new user in db
                    return User.findOne({email: newUser.email})
                })
                .then(user => {
                    expect(user).to.not.be.null;
                    expect(user.firstName).to.equal(newUser.firstName);
                    expect(user.lastName).to.equal(newUser.lastName);
                    return user.validatePassword(newUser.password);
                })
                .then(passwordIsCorrect => {
                    expect(passwordIsCorrect).to.be.true;
                })
        })
    });

    describe('PUT endpoint', () => {

    });

});