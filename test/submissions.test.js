'use static';
const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const faker = require('faker');

const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL, JWT_SECRET} = require('../config');
const {Submission} = require('../submissions/models');

const expect = chai.expect;

chai.use(chaiHttp);

const NUM_SUBMISSIONS_IN_DB = 15;
const NUM_SUBMISSIONS_BY_SPECIFIC_USER = 5;

const adminEmail = 'adminTest@sublitr.com';
const editorEmail = 'editorTest@example.com';
const userEmail = 'testUser@example.com';
const userID = '1234567880';
const userFirst = 'Usey';
const userLast = 'Userman';
const expectedFields = ['authorID', 'submitted', 'id', 'author', 'status', 'title', 'publication'];

const adminToken = jwt.sign({
        user: {
            email: adminEmail,
            firstName: 'Firstathy',
            lastName: 'Lastnamerham',
            admin: true,
            editor: false
        }
    },
    JWT_SECRET,
    {
        algorithm: 'HS256',
        subject: adminEmail,
        expiresIn: '7d'
    }
);

const editorToken = jwt.sign({
        user: {
            email: editorEmail,
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
            admin: false,
            editor: true
        }
    },
    JWT_SECRET,
    {
        algorithm: 'HS256',
        subject: editorEmail,
        expiresIn: '7d'
    }
);

const userToken = jwt.sign({
        user: {
            email: userEmail,
            id: userID,
            firstName: userFirst,
            lastName: userLast,
            admin: false,
            editor: false
        }
    },
    JWT_SECRET,
    {
        algorithm: 'HS256',
        subject: userEmail,
        expiresIn: '7d'
    }
);

function seedDB() {
    const submissions = [];
    let remainingCount = NUM_SUBMISSIONS_IN_DB;

    for (let i=0; i<NUM_SUBMISSIONS_BY_SPECIFIC_USER; i++) {
        // seed submissions from specific user so we can test that the user is able to retrieve their own submissions
        // decrement remaining count
        submissions.push({
            title: faker.lorem.words(),
            author: `${userFirst} ${userLast}`,
            authorID: userID,
            publication: faker.random.words(),
            file: faker.system.commonFileName(),
        });
        remainingCount--;
    }

    for (let i=0; i<remainingCount; i++) {
        submissions.push({
            title: faker.lorem.words(),
            author: faker.name.findName(),
            authorID: faker.random.number(),
            publication: faker.random.words(),
            file: faker.system.commonFileName(),
        });
    }

    return Submission.insertMany(submissions)
}

describe('submissions API', () => {
    before(function() {
        return runServer(TEST_DATABASE_URL)
    });

    beforeEach(function() {
        testStart = Date.now();
        return seedDB();
    });

    afterEach(function() {
        return Submission.remove({});
    });

    after(function() {
        return closeServer()
    });

    describe('GET endpoint for all submissions', () => {
        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .get('/api/submissions')
                    .then(res => expect(res).to.have.status(401))
            });

            it('should reject requests with an invalid token', () => {
                const invalidToken = jwt.sign({
                        user: {
                            email: userEmail,
                            firstName: faker.name.firstName(),
                            lastName: faker.name.lastName()
                        }
                    },
                    'notTheSecret',
                    {
                        algorithm: 'HS256',
                        subject: userEmail,
                        expiresIn: '7d'
                    }
                );

                return chai.request(app)
                    .get('/api/submissions')
                    .set('authorization', `Bearer ${invalidToken}`)
                    .then(res => expect(res).to.have.status(401))
            })
        });

        it('should return a list of all submissions for editors', () => {
            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${editorToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('array');
                    expect(res.body).to.have.length(NUM_SUBMISSIONS_IN_DB);
                    const randomIndex = Math.floor(Math.random() * (NUM_SUBMISSIONS_IN_DB - 1));
                    const testSub = res.body[randomIndex];
                    expectedFields.forEach(field => { expect(field in testSub).to.be.true });
                    expect('reviewerInfo' in testSub).to.be.true;
                    expect('file' in testSub).to.be.true;
                    expect(testSub.status).to.equal('pending');
                    expect(testSub.reviewerInfo.decision).to.equal('pending');
                    expect(testSub.reviewerInfo.recommendation).to.equal('none');
                })
        });

        it('should return a list of all submissions for admin', () => {
            //    send request as admin
            //    check response body length and make sure it matches seed length
            //    check check random item in array and make sure it has correct keys/values
            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('array');
                    expect(res.body).to.have.length(NUM_SUBMISSIONS_IN_DB);
                    const randomIndex = Math.floor(Math.random() * (NUM_SUBMISSIONS_IN_DB - 1));
                    const testSub = res.body[randomIndex];
                    expectedFields.forEach(field => { expect(field in testSub).to.be.true });
                    expect('reviewerInfo' in testSub).to.be.true;
                    expect('file' in testSub).to.be.true;
                    expect(testSub.status).to.equal('pending');
                    expect(testSub.reviewerInfo.decision).to.equal('pending');
                    expect(testSub.reviewerInfo.recommendation).to.equal('none');
                })
        });

        it('should return a list of (only) user\'s own submissions if not editor/admin', () => {
            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('array');
                    expect(res.body).to.have.length(NUM_SUBMISSIONS_BY_SPECIFIC_USER);
                    res.body.forEach(submission => {
                        expectedFields.forEach(field => { expect(field in submission).to.be.true });
                        expect('reviewerInfo' in submission).to.be.false;
                        expect(submission.status).to.equal('pending');
                        expect(submission.author).to.equal(`${userFirst} ${userLast}`);
                        expect(submission.authorID).to.equal(userID);
                    });
                })
        });
    });

    describe('GET endpoint for specific submission', () => {
        let submissionID;
        let authorID;

        beforeEach(function() {
            return Submission.findOne().then(sub => {
                submissionID = sub._id;
                authorID = sub.authorID;
            })
        });

        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .get(`/api/submissions/${submissionID}`)
                    .then(res => expect(res).to.have.status(401))
            });

            it('should reject requests with an invalid token', () => {
                const invalidToken = jwt.sign({
                        user: {
                            email: userEmail,
                            firstName: faker.name.firstName(),
                            lastName: faker.name.lastName()
                        }
                    },
                    'notTheSecret',
                    {
                        algorithm: 'HS256',
                        subject: userEmail,
                        expiresIn: '7d'
                    }
                );

                return chai.request(app)
                    .get(`/api/submissions/${submissionID}`)
                    .set('authorization', `Bearer ${invalidToken}`)
                    .then(res => expect(res).to.have.status(401))
            });

            it('should reject requests from non-admin, non-editor users who aren\'t the author', () => {
                const notAuthorToken = jwt.sign({
                        user: {
                            email: 'notauthor@example.com',
                            id: 'notlegit',
                            firstName: 'testast',
                            lastName: 'asdfas',
                            admin: false,
                            editor: false
                        }
                    },
                    JWT_SECRET,
                    {
                        algorithm: 'HS256',
                        subject: 'notauthor@example.com',
                        expiresIn: '7d'
                    }
                );

                return chai.request(app)
                    .get(`/api/submissions/${submissionID}`)
                    .set('authorization', `Bearer ${notAuthorToken}`)
                    .then(res => expect(res).to.have.status(401))
            });
        })

        it('should return specific submission for editor',  () => {
            return chai.request(app)
                .get(`/api/submissions/${submissionID}`)
                .set('authorization', `Bearer ${editorToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('object');
                    expectedFields.forEach(field => { expect(field in res.body).to.be.true });
                    expect('reviewerInfo' in res.body).to.be.true;
                    expect('file' in res.body).to.be.true;
                    expect(res.body.status).to.equal('pending');
                    expect(res.body.reviewerInfo.decision).to.equal('pending');
                    expect(res.body.reviewerInfo.recommendation).to.equal('none');
                })
        });

        it('should return specific submission for admin',  () => {
            return chai.request(app)
                .get(`/api/submissions/${submissionID}`)
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('object');
                    expectedFields.forEach(field => { expect(field in res.body).to.be.true });
                    expect('reviewerInfo' in res.body).to.be.true;
                    expect('file' in res.body).to.be.true;
                    expect(res.body.status).to.equal('pending');
                    expect(res.body.reviewerInfo.decision).to.equal('pending');
                    expect(res.body.reviewerInfo.recommendation).to.equal('none');
                })
        });

        it('should return specific submission for author',  () => {
            const authorToken = jwt.sign({
                    user: {
                        email: 'author@author.biz',
                        id: authorID,
                        firstName: 'asdf',
                        lastName: 'whiahwefpa',
                        admin: false,
                        editor: false
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: 'author@author.biz',
                    expiresIn: '7d'
                }
            );
            return chai.request(app)
                .get(`/api/submissions/${submissionID}`)
                .set('authorization', `Bearer ${authorToken}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res).to.be.json;
                    expect(res.body).to.be.an('object');
                    expectedFields.forEach(field => { expect(field in res.body).to.be.true });
                    expect('reviewerInfo' in res.body).to.be.false;
                    expect('file' in res.body).to.be.false;
                    expect(res.body.status).to.equal('pending');
                })
        });
    });

    describe('POST endpoint', () => {
        const newSubmission = {
            title: faker.lorem.words(),
            publication: faker.random.words(),
            file: faker.system.commonFileName(),
        };

        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .post('/api/submissions')
                    .send(newSubmission)
                    .then(res => expect(res).to.have.status(401))
            });

            it('should reject requests with an invalid token', () => {
                const invalidToken = jwt.sign({
                        user: {
                            email: userEmail,
                            firstName: faker.name.firstName(),
                            lastName: faker.name.lastName()
                        }
                    },
                    'notTheSecret',
                    {
                        algorithm: 'HS256',
                        subject: userEmail,
                        expiresIn: '7d'
                    }
                );

                return chai.request(app)
                    .post('/api/submissions')
                    .send(newSubmission)
                    .set('authorization', `Bearer ${invalidToken}`)
                    .then(res => expect(res).to.have.status(401))
            })
        });

        it('should reject a submission with a missing title', () => {
            const missingTitle = {
                publication: faker.random.words(),
                file: faker.system.commonFileName(),
            };

            return chai.request(app)
                .post('/api/submissions')
                .send(missingTitle)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('title');
                })
        });

        it('should reject a submission with a missing publication', () => {
            const missingPub = {
                title: faker.lorem.words(),
                file: faker.system.commonFileName(),
            };

            return chai.request(app)
                .post('/api/submissions')
                .send(missingPub)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('publication');
                })
        });

        // TODO: file, cover letter

        it('should reject a submission with non string publication', () => {
            const nonStringPub = {
                title: faker.lorem.words(),
                publication: 11,
                file: faker.system.commonFileName(),
            };

            return chai.request(app)
                .post('/api/submissions')
                .send(nonStringPub)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('publication must be a string');
                    expect(res.body.location).to.equal('publication');
                })
        });

        it('should reject a submission with non string title', () => {
            const nonStringTitle = {
                title: 325,
                publication: faker.lorem.words(),
                file: faker.system.commonFileName(),
            };

            return chai.request(app)
                .post('/api/submissions')
                .send(nonStringTitle)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('title must be a string');
                    expect(res.body.location).to.equal('title');
                })
        });

        it('should reject a submission with an overly long title', () => {
            const tooLongTitle = {
                title: Array(129).fill('a').join(''),
                publication: faker.lorem.words(),
                file: faker.system.commonFileName(),
            };

            return chai.request(app)
                .post('/api/submissions')
                .send(tooLongTitle)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Can\'t be more than 128 characters long');
                    expect(res.body.location).to.equal('title');
                })
        });

        it('should reject a submission with a pure whitespace title', () => {
            const whitespaceTitle = {
                title: '                      ',
                publication: faker.lorem.words(),
                file: faker.system.commonFileName(),
            };

            return chai.request(app)
                .post('/api/submissions')
                .send(whitespaceTitle)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal(`Must be at least 1 characters long`);
                    expect(res.body.location).to.equal('title');
                })
        });

        it('should create a new submission', () => {
            return chai.request(app)
                .post('/api/submissions')
                .send(newSubmission)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(201);
                    expect(res).to.be.json;
                    expectedFields.forEach(field => { expect(field in res.body).to.be.true });
                    expect(res.body.author).to.equal(`${userFirst} ${userLast}`);
                    expect(res.body.authorID).to.equal(userID);
                })
        })
    })
});