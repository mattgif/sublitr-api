'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL, JWT_SECRET} = require('../config');
const {User} = require('../users/models');

const expect = chai.expect;
chai.use(chaiHttp);

const NUM_FAKE_USERS = 10;

// used to generate an object representing a new user
function generateNewUser() {
    return {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        email: faker.internet.email(),
        password: faker.internet.password()
    }
}

const email = 'user@example.com';
const firstName = 'Testy';
const lastName = 'Testman';
let userID;

function seedDb(NUM_FAKE_USERS) {
    let count = NUM_FAKE_USERS;
    const fakeUsers = [];
    // create one known user
    fakeUsers.push({
        email,
        firstName,
        lastName,
        password: faker.internet.password()
    });
    count --;
    for (let i=0; i<count; i++) {
        fakeUsers.push({
            email: faker.internet.email(),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
            password: faker.internet.password(),
            editor: Math.random() < .5
        })
    }
    return User.insertMany(fakeUsers)
        .then(() => {
            return User.findOne({email})
                .then(user => userID = user._id.toString());
        });
}

describe('users API', () => {
    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function() {
        return seedDb(NUM_FAKE_USERS);
    });

    afterEach(function() {
        return User.remove({})
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

        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                const updatedUser = {email: 'shouldNotBeHere@example.com'};
                return chai.request(app)
                    .put(`/api/users/${userID}`)
                    .send(updatedUser)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user.email).to.equal(email));
            });

            it('Should reject requests with an invalid token', () => {
                const updatedUser = {email: 'shouldNotBeHere@example.com'};
                const token = jwt.sign(
                    {
                        email,
                        firstName,
                        lastName,
                        admin: false,
                        editor: false,
                        id: userID
                    },
                    'wrongSecret',
                    {
                        algorithm: 'HS256',
                        expiresIn: '7d'
                    }
                );

                return chai
                    .request(app)
                    .put(`/api/users/${userID}`)
                    .send(updatedUser)
                    .set('Authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user.email).to.equal(email));
            });

            it('Should reject requests with an expired token', () => {
                const updatedUser = {email: 'shouldNotBeHere@example.com'};
                const token = jwt.sign(
                    {
                        user: {
                            email,
                            firstName,
                            lastName,
                            admin: false,
                            editor: false,
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
                    .put(`/api/users/${userID}`)
                    .send(updatedUser)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user.email).to.equal(email));
            });

            it('should reject requests from non-admin users', () => {
                const updatedUser = {email: 'shouldNotBeHere@example.com'};
                const token = jwt.sign(
                    {
                        user: {
                            email,
                            firstName,
                            lastName,
                            admin: false,
                            editor: false,
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

                return chai.request(app)
                    .put(`/api/users/${userID}`)
                    .send(updatedUser)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user.email).to.equal(email));
            })
        });

        describe('admin can update user', () => {
            // strategy: create admin account, create non-admin user account
            // send put request to endpoint/userID with admin credentials & updated payload
            // check for correct response code
            // check db to make sure change was made
            it('should update user info', () => {
                const adminEmail = 'testAdmin@example.com';
                const updatedUser = {
                    email: 'newemail@example.com',
                    firstName: 'Changed',
                    lastName: 'New Last Name',
                    editor: true
                };

                const token = jwt.sign(
                    {
                        user: {
                            email: adminEmail,
                            firstName: 'Test',
                            lastName: 'Admin',
                            admin: true,
                            editor: false,
                            id: 'aaaaaaaaaaaaaa'
                        }
                    },
                    JWT_SECRET,
                    {
                        algorithm: 'HS256',
                        subject: adminEmail,
                        expiresIn: '7d'
                    }
                );

                return chai.request(app)
                    .put(`/api/users/${userID}`)
                    .send(updatedUser)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(204);
                        return User.findById(userID)
                    })
                    .then(user => {
                        const updatedFields = ['email', 'firstName', 'lastName', 'editor'];
                        updatedFields.forEach(field => {
                            expect(user[field]).to.equal(updatedUser[field])
                        })
                    })
            })
        });

    });

    describe('DELETE endpoint', () => {

        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .delete(`/api/users/${userID}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user).to.exist);
            });

            it('Should reject requests with an invalid token', () => {
                const token = jwt.sign(
                    {
                        email,
                        firstName,
                        lastName,
                        admin: false,
                        editor: false,
                        id: userID
                    },
                    'wrongSecret',
                    {
                        algorithm: 'HS256',
                        expiresIn: '7d'
                    }
                );

                return chai
                    .request(app)
                    .delete(`/api/users/${userID}`)
                    .set('Authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user).to.exist);
            });

            it('Should reject requests with an expired token', () => {
                const token = jwt.sign(
                    {
                        user: {
                            email,
                            firstName,
                            lastName,
                            admin: false,
                            editor: false,
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
                    .delete(`/api/users/${userID}`)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user).to.exist);
            });

            it('should reject requests from non-self non-admin users', () => {
                const token = jwt.sign(
                    {
                        user: {
                            email,
                            firstName,
                            lastName,
                            admin: false,
                            editor: false,
                            id: 'adifferentpersonsid'
                        }
                    },
                    JWT_SECRET,
                    {
                        algorithm: 'HS256',
                        subject: email,
                        expiresIn: '7d'
                    }
                );

                return chai.request(app)
                    .delete(`/api/users/${userID}`)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                        return User.findById(userID)
                    })
                    .then(user => expect(user.email).to.exist);
            })
        });

        it('should delete the account', () => {
            const adminEmail = 'admin@example.com';
            const token = jwt.sign(
                {
                    user: {
                        email: adminEmail,
                        firstName: 'Adam',
                        lastName: 'Administratorman',
                        admin: true,
                        editor: false,
                        id: 'whatever'
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: adminEmail,
                    expiresIn: '7d'
                }
            );
            return chai.request(app)
                .delete(`/api/users/${userID}`)
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(204);
                    return User.findById(userID).count()
                })
                .then(count => {
                    expect(count).to.equal(0)
                })
        });

        it('should reject request to delete admin', () => {
            // find user, set to admin, then try to delete
            const adminEmail = 'admin@example.com';
            const token = jwt.sign(
                {
                    user: {
                        email: adminEmail,
                        firstName: 'Adam',
                        lastName: 'Administratorman',
                        admin: true,
                        editor: false,
                        id: 'whatever'
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: adminEmail,
                    expiresIn: '7d'
                }
            );
            return User
                .findByIdAndUpdate(userID, {admin: true})
                .then(() => {
                    return chai.request(app)
                        .delete(`/api/users/${userID}`)
                        .set('authorization', `Bearer ${token}`)
                        .then(res => {
                            expect(res).to.have.status(403);
                        })
                })
        })
    });

    describe('GET endpoint for specfic user', () => {
        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .get(`/api/users/${userID}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                    })
            });

            it('Should reject requests with an invalid token', () => {
                const token = jwt.sign(
                    {
                        email: email,
                        firstName: firstName,
                        lastName: lastName,
                        admin: false,
                        editor: false,
                        id: userID
                    },
                    'wrongSecret',
                    {
                        algorithm: 'HS256',
                        expiresIn: '7d'
                    }
                );

                return chai
                    .request(app)
                    .get(`/api/users/${userID}`)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                    })
            });

            it('Should reject requests with an expired token', () => {
                const token = jwt.sign(
                    {
                        user: {
                            email,
                            firstName,
                            lastName,
                            admin: false,
                            editor: false,
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
                    .get(`/api/users/${userID}`)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                    })
            });

            it('should reject requests from non-self, non-admin users', () => {
                const token = jwt.sign(
                    {
                        user: {
                            email,
                            firstName,
                            lastName,
                            admin: false,
                            editor: false,
                            id: 'nottherightuser'
                        }
                    },
                    JWT_SECRET,
                    {
                        algorithm: 'HS256',
                        subject: email,
                        expiresIn: '7d'
                    }
                );

                return chai.request(app)
                    .get(`/api/users/${userID}`)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                    })
            })
        });

        it('should return the user if requesting self', () => {
            const token = jwt.sign(
                {
                    user: {
                        email,
                        firstName,
                        lastName,
                        admin: false,
                        editor: false,
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

            return chai.request(app)
                .get(`/api/users/${userID}`)
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('object');
                    expect(res.body.email).to.equal(email);
                    expect(res.body.firstName).to.equal(firstName);
                    expect(res.body.lastName).to.equal(lastName);
                    expect(res.body.id).to.equal(userID);
                    expect(res.body.admin).to.be.false;
                })
        });

        it('should return the user if requester is admin', () => {
            const adminEmail = 'admin@example.com';
            const adminFirst = 'Adam';
            const adminLast = 'Administratorman';

            const token = jwt.sign(
                {
                    user: {
                        email: adminEmail,
                        firstName: adminFirst,
                        lastName: adminLast,
                        admin: true,
                        editor: false,
                        id: 'whatever'
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: email,
                    expiresIn: '7d'
                }
            );

            return chai.request(app)
                .get(`/api/users/${userID}`)
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('object');
                    expect(res.body.email).to.equal(email);
                    expect(res.body.firstName).to.equal(firstName);
                    expect(res.body.lastName).to.equal(lastName);
                    expect(res.body.id).to.equal(userID);
                    expect(res.body.admin).to.be.false;
                })
        });
    });

    describe('GET endpoint, generic request', () => {
        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .get(`/api/users/`)
                    .then(res => {
                        expect(res).to.have.status(401);
                    })
            });

            it('Should reject requests with an invalid token', () => {
                const token = jwt.sign(
                    {
                        email: email,
                        firstName: firstName,
                        lastName: lastName,
                        admin: false,
                        editor: false,
                        id: userID
                    },
                    'wrongSecret',
                    {
                        algorithm: 'HS256',
                        expiresIn: '7d'
                    }
                );

                return chai
                    .request(app)
                    .get(`/api/users/`)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                    })
            });

            it('Should reject requests with an expired token', () => {
                const token = jwt.sign(
                    {
                        user: {
                            email,
                            firstName,
                            lastName,
                            admin: false,
                            editor: false,
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
                    .get(`/api/users/`)
                    .set('authorization', `Bearer ${token}`)
                    .then(res => {
                        expect(res).to.have.status(401);
                    })
            });

        });
        it.skip('should return own profile for requests from non-admin users', () => {
            // redundant with JWT architecture
            const token = jwt.sign({
                    user: {
                        email,
                        firstName,
                        lastName,
                        admin: false,
                        editor: false,
                        id: userID
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: email,
                    expiresIn: '7d'
                });
            return chai.request(app)
                .get(`/api/users/`)
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body.user).to.be.an('object');
                    expect(res.body.user.email).to.equal(email);
                    expect(res.body.user.id).to.equal(userID);
                })
        });

        it('should not allow non-admins to view user list', () => {
            const token = jwt.sign({
                    user: {
                        email,
                        firstName,
                        lastName,
                        admin: false,
                        editor: false,
                        id: userID
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: email,
                    expiresIn: '7d'
                });
            return chai.request(app)
                .get(`/api/users/`)
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(401);
                })
        });

        it('should return list of all users if requester is admin', () => {
            const adminEmail = 'admin@example.com';
            const adminFirst = 'Adam';
            const adminLast = 'Administratorman';

            const token = jwt.sign(
                {
                    user: {
                        email: adminEmail,
                        firstName: adminFirst,
                        lastName: adminLast,
                        admin: true,
                        editor: false,
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
            return chai.request(app)
                .get(`/api/users/`)
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('array');
                    expect(res.body).to.have.lengthOf(NUM_FAKE_USERS);
                    ['email', 'firstName', 'lastName', 'admin', 'editor'].forEach(field => {
                        expect(field in res.body[0]).to.be.true;
                    });
                    expect('password' in res.body[0]).to.be.false;
                })
        });
    });
});