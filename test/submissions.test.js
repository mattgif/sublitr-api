'use static';
const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const faker = require('faker');
const fs = require('fs');

const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL, JWT_SECRET} = require('../config');
const {Submission} = require('../submissions/models');

const expect = chai.expect;

chai.use(chaiHttp);

const NUM_SUBMISSIONS_IN_DB = 15;
const NUM_SUBMISSIONS_BY_SPECIFIC_USER = 5;

const adminEmail = 'adminTest@sublitr.com';
const editorEmail = 'editorTest@example.com';
const editorFirst = 'Ed';
const editorLast = 'Ditor';
const editorID = '098765431';
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
            firstName: editorFirst,
            lastName: editorLast,
            id: editorID,
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
        });

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
                    expect('file' in res.body).to.be.true;
                    expect(res.body.status).to.equal('pending');
                })
        });
    });

    describe('POST endpoint', () => {
        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .post('/api/submissions')
                    .send({whatever:'dummy'})
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
                    .send({whatever:'dummy'})
                    .set('authorization', `Bearer ${invalidToken}`)
                    .then(res => expect(res).to.have.status(401))
            })
        });

        it('should reject a submission with a missing title', () => {
            return chai.request(app)
                .post('/api/submissions')
                .field('publication', faker.random.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
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
            return chai.request(app)
                .post('/api/submissions')
                .field('title', faker.lorem.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('publication');
                })
        });

        it('should reject a submission with a missing file', () => {
            return chai.request(app)
                .post('/api/submissions')
                .field('publication', faker.random.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .field('title', faker.random.words())
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Missing field');
                    expect(res.body.location).to.equal('doc');
                })
        });

        it.skip('should reject a submission with non string publication', () => {
            // TODO: field() coverts argument to string, so this should and does pass
            // Need to pass endpoint a non-string somehow
            return chai.request(app)
                .post('/api/submissions')
                .field('title', faker.lorem.words())
                .field('publication', 11)
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('publication must be a string');
                    expect(res.body.location).to.equal('publication');
                })
        });

        it.skip('should reject a submission with non string title', () => {
            // TODO: field() coverts argument to string, so this should and does pass
            // Need to pass endpoint a non-string somehow
            const nonStringTitle = {
                title: 325,
                publication: faker.lorem.words(),
                file: faker.system.commonFileName(),
            };

            return chai.request(app)
                .post('/api/submissions')
                .field('title', 12312)
                .field('publication', faker.random.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('title must be a string');
                    expect(res.body.location).to.equal('title');
                })
        });

        it.skip('should reject a submission with a non string cover letter', () => {
            // TODO: field() coverts argument to string, so this should and does pass
            // Need to pass endpoint a non-string somehow
            return chai.request(app)
                .post('/api/submissions')
                .field('title', faker.lorem.words())
                .field('publication', faker.random.words())
                .field('coverLetter', 72392935492)
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('coverLetter must be a string');
                    expect(res.body.location).to.equal('coverLetter');
                })
        });

        it('should reject a submission with an overly long title', () => {
            return chai.request(app)
                .post('/api/submissions')
                .field('title', Array(129).fill('a').join(''))
                .field('publication', faker.random.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Can\'t be more than 128 characters long');
                    expect(res.body.location).to.equal('title');
                })
        });

        it('should reject a submission with an overly long cover letter', () => {
            return chai.request(app)
                .post('/api/submissions')
                .field('title', faker.lorem.words())
                .field('publication', faker.random.words())
                .field('coverLetter', Array(3001).fill('a').join(''))
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal('Can\'t be more than 3000 characters long');
                    expect(res.body.location).to.equal('coverLetter');
                })
        });

        it('should reject a submission with a pure whitespace title', () => {
            return chai.request(app)
                .post('/api/submissions')
                .field('title', '                    ')
                .field('publication', faker.random.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/spicer-extracts.pdf'), 'spicer-extracts.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal(`Must be at least 1 characters long`);
                    expect(res.body.location).to.equal('title');
                })
        });

        it('should reject a submission with attachment of wrong file type', () => {
            return chai.request(app)
                .post('/api/submissions')
                .field('title', faker.random.words())
                .field('publication', faker.random.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/354.jpg'), '354.jpg')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(422);
                    expect(res).to.be.json;
                    expect(res.body.reason).to.equal('ValidationError');
                    expect(res.body.message).to.equal(`Invalid file type`);
                    expect(res.body.location).to.equal('doc');
                })
        });

        it.skip('should reject a submission with an attachment that is too large', () => {
            // large doc kills the other tests; need more efficient test
            return chai.request(app)
                .post('/api/submissions')
                .field('title', faker.random.words())
                .field('publication', faker.random.words())
                .field('coverLetter', faker.lorem.paragraphs(2))
                .attach('doc', fs.readFileSync('./test/26mb.pdf'), '26mb.pdf')
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(413);
                })
        }).timeout(4000);

        it('should create a new submission', () => {
            // skipping until we can figure out how to stub s3
            const coverLetter = faker.lorem.paragraphs();
            const fileName = 'spicer-extracts.pdf';
            // stub for s3 uploads
            // const s3UploadStub = sinon.stub(awsHandler, 's3Upload');
            // s3UploadStub.resolves(`https://s3.amazonaws.com/sublitr/${userID}-${fileName}`);

            return chai.request(app)
                .post('/api/submissions')
                .field('title', faker.lorem.words())
                .field('publication', faker.random.words())
                .field('coverLetter', coverLetter)
                .attach('doc', fs.readFileSync(`./test/${fileName}`), fileName)
                .set('authorization', `Bearer ${userToken}`)
                .then(res => {
                    expect(res).to.have.status(201);
                    expect(res).to.be.json;
                    expectedFields.forEach(field => { expect(field in res.body).to.be.true });
                    expect(res.body.author).to.equal(`${userFirst} ${userLast}`);
                    expect(res.body.authorID).to.equal(userID);
                    expect(res.body.coverLetter).to.equal(coverLetter);
                    expect(res.body.file).to.equal(`${userID}-${fileName}`);
                    // sinon.assert.calledOnce(s3UploadStub);
                })
        })
    });

    describe('PUT endpoint', () => {
        // get submission as admin
        // make PUT request to id of retrieved submissions

        describe('auth checks', () => {
            const updatedSubmission = {
                author: 'New Author'
            };

            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .get('/api/submissions')
                    .set('authorization', `Bearer ${adminToken}`)
                    .then(res => {
                        const submissionID = res.body[0].id;
                        return chai.request(app)
                            .put(`/api/submissions/${submissionID}`)
                            .send(updatedSubmission)
                            .then(res => expect(res).to.have.status(401))
                    })
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
                    .set('authorization', `Bearer ${adminToken}`)
                    .then(res => {
                        const submissionID = res.body[0].id;
                        return chai.request(app)
                            .put(`/api/submissions/${submissionID}`)
                            .send(updatedSubmission)
                            .set('authorization', `Bearer ${invalidToken}`)
                            .then(res => expect(res).to.have.status(401))
                    })
            });

            it('should reject requests from non-editor/admin users', () => {
                return chai.request(app)
                    .get('/api/submissions')
                    .set('authorization', `Bearer ${adminToken}`)
                    .then(res => {
                        const submissionID = res.body[0].id;
                        return chai.request(app)
                            .put(`/api/submissions/${submissionID}`)
                            .send(updatedSubmission)
                            .set('authorization', `Bearer ${userToken}`)
                            .then(res => expect(res).to.have.status(401))
                    })
            })
        });

        it('should reject request with mismatched req id and param id', () => {
            const newStatus = 'accepted';
            const subWithNewStatus = {
                reviewerInfo: {
                    decision: newStatus
                }
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    subWithNewStatus.id = res.body[0].id;
                    return chai.request(app)
                        .put(`/api/submissions/notCorrectId`)
                        .send(subWithNewStatus)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(400);
                        })
                })
        });

        it('should reject request with non-string decision', () => {
            const subWithNewStatus = {
                reviewerInfo: {
                    decision: 2345
                }
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    const submissionID = res.body[0].id;
                    subWithNewStatus.id = submissionID;
                    return chai.request(app)
                        .put(`/api/submissions/${submissionID}`)
                        .send(subWithNewStatus)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(422);
                            expect(res).to.be.json;
                            expect(res.body.reason).to.equal('ValidationError');
                            expect(res.body.message).to.equal(`decision must be a string`);
                            expect(res.body.location).to.equal('decision');
                        })
                })
        });

        it('should reject request with non-string recommendation', () => {
            const subWithNewStatus = {
                reviewerInfo: {
                    recommendation: 2345
                }
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    const submissionID = res.body[0].id;
                    subWithNewStatus.id = submissionID;
                    return chai.request(app)
                        .put(`/api/submissions/${submissionID}`)
                        .send(subWithNewStatus)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(422);
                            expect(res).to.be.json;
                            expect(res.body.reason).to.equal('ValidationError');
                            expect(res.body.message).to.equal(`recommendation must be a string`);
                            expect(res.body.location).to.equal('recommendation');
                        })
                })
        });

        it('should update the decision & status on editor request', () => {
            // get request from admin to grab a valid submission id
            // put request to end point
            // check for success status
            // fetch submission from db and inspect changes
            const newStatus = 'accepted';
            const subWithNewStatus = {
                reviewerInfo: {
                    decision: newStatus
                }
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    const submissionID = res.body[0].id;
                    subWithNewStatus.id = submissionID;
                    return chai.request(app)
                        .put(`/api/submissions/${submissionID}`)
                        .send(subWithNewStatus)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(204);
                            return Submission.findById(submissionID)
                        })
                        .then(sub => {
                            expect(sub.status).to.equal(newStatus);
                            expect(sub.reviewerInfo.decision).to.equal(newStatus);
                        })
                })
        });

        it('should update the decision & status on admin request', () => {
            // get request from admin to grab a valid submission id
            // put request to end point
            // check for success status
            // fetch submission from db and inspect changes
            const newStatus = 'accepted';
            const subWithNewStatus = {
                reviewerInfo: {
                    decision: newStatus
                }
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    const submissionID = res.body[0].id;
                    subWithNewStatus.id = submissionID;
                    return chai.request(app)
                        .put(`/api/submissions/${submissionID}`)
                        .send(subWithNewStatus)
                        .set('authorization', `Bearer ${adminToken}`)
                        .then(res => {
                            expect(res).to.have.status(204);
                            return Submission.findById(submissionID)
                                .then(sub => {
                                    expect(sub.status).to.equal(newStatus);
                                    expect(sub.reviewerInfo.decision).to.equal(newStatus);
                                })
                        })
                })
        });

        it('should update the recommendation', () => {
            // get request from admin to grab a valid submission id
            // put request to end point
            // check for success status
            // fetch submission from db and inspect changes
            const newStatus = 'accepted';
            const subWithNewStatus = {
                reviewerInfo: {
                    recommendation: newStatus
                }
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    const submissionID = res.body[0].id;
                    subWithNewStatus.id = submissionID;
                    return chai.request(app)
                        .put(`/api/submissions/${submissionID}`)
                        .send(subWithNewStatus)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(204);
                            return Submission.findById(submissionID)
                                .then(sub => {
                                    expect(sub.reviewerInfo.recommendation).to.equal(newStatus);
                                })
                        })
                })
        });
    });

    describe('POST comment endpoint', () => {
        it('should reject requests from non-editor/admin users', () => {
            const comment = {text: faker.random.words()};
            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    return chai.request(app)
                        .post(`/api/submissions/${res.body[0].id}/comment`)
                        .send(comment)
                        .set('authorization', `Bearer ${userToken}`)
                        .then(res => expect(res).to.have.status(401))
                })
        });

        it('should reject a comment without text', () => {
            const newComment = {
                text: '     '
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    return chai.request(app)
                        .post(`/api/submissions/${res.body[0].id}/comment`)
                        .send(newComment)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(422);
                            expect(res).to.be.json;
                            expect(res.body.reason).to.equal('ValidationError');
                            expect(res.body.message).to.equal(`Comment cannot be empty`);
                            expect(res.body.location).to.equal('text');
                        })
                })
        });

        it('should add a first comment', () => {
            const newComment = {
                text: faker.random.words()
            };

            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    const submissionID = res.body[0].id;
                    return chai.request(app)
                        .post(`/api/submissions/${submissionID}/comment`)
                        .send(newComment)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(201);
                            expect(res).to.be.json;
                            expect(res.body).to.be.an('object');
                            expect(res.body.firstName).to.equal(editorFirst);
                            expect(res.body.lastName).to.equal(editorLast);
                            expect(res.body.text).to.equal(newComment.text);
                            expect(res.body.authorID).to.equal(editorID);
                            return Submission.findById(submissionID)
                                .then(sub => {
                                    expect(sub.reviewerInfo.comments).to.be.an('array');
                                    expect(sub.reviewerInfo.comments).to.have.length(1);
                                    const comment = sub.reviewerInfo.comments[0];
                                    expect(comment.firstName).to.equal(editorFirst);
                                    expect(comment.lastName).to.equal(editorLast);
                                    expect(comment.text).to.equal(newComment.text);
                                    expect(comment.authorID).to.equal(editorID);
                                    expect('date' in comment).to.be.true;
                                })
                        })
                })
        });

        it('should add an additional comment', () => {
            const newComment = {
                text: 'look, a new comment!'
            };

            const oldComments = [
                {lastName: 'Brown', firstName: 'Betty', authorID: 'u222222', date: '2018-03-04 21:12', text: faker.lorem.paragraphs()},
                {lastName: 'Abrams', firstName: 'Abe', authorID: 'u111111', date: '2018-03-03 08:30', text: faker.lorem.paragraphs()},
                {lastName: 'Douglas', firstName: 'Debbie', authorID: 'u444444', date: '2018-03-03 08:00', text: faker.lorem.paragraphs()}
            ];

            let submissionID;
            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    submissionID = res.body[0].id;
                    return Submission.findById(submissionID)
                })
                .then(sub => {
                    sub.reviewerInfo.comments = oldComments;
                    sub.save()
                })
                .then(() => {
                    return chai.request(app)
                        .post(`/api/submissions/${submissionID}/comment`)
                        .send(newComment)
                        .set('authorization', `Bearer ${editorToken}`)
                        .then(res => {
                            expect(res).to.have.status(201);
                            expect(res).to.be.json;
                            expect(res.body).to.be.an('object');
                            expect(res.body.firstName).to.equal(editorFirst);
                            expect(res.body.lastName).to.equal(editorLast);
                            expect(res.body.text).to.equal(newComment.text);
                            expect(res.body.authorID).to.equal(editorID);
                            return Submission.findById(submissionID)
                                .then(sub => {
                                    console.log(sub.reviewerInfo.comments);
                                    expect(sub.reviewerInfo.comments).to.be.an('array');
                                    expect(sub.reviewerInfo.comments).to.have.length(oldComments.length + 1);
                                    const comment = sub.reviewerInfo.comments.find(comment => comment.authorID === editorID);
                                    expect(comment).to.exist;
                                    expect(comment.firstName).to.equal(editorFirst);
                                    expect(comment.lastName).to.equal(editorLast);
                                    expect(comment.text).to.equal(newComment.text);
                                    expect('date' in comment).to.be.true;
                                })
                        })
                });
        });
    });

    describe('DELETE endpoint', () => {
        describe('auth checks', () => {
            it('should reject anonymous requests', () => {
                return chai.request(app)
                    .get('/api/submissions')
                    .set('authorization', `Bearer ${adminToken}`)
                    .then(res => {
                        const submissionID = res.body[0].id;
                        return chai.request(app)
                            .delete(`/api/submissions/${submissionID}`)
                            .then(res => expect(res).to.have.status(401))
                    })
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
                    .set('authorization', `Bearer ${adminToken}`)
                    .then(res => {
                        const submissionID = res.body[0].id;
                        return chai.request(app)
                            .delete(`/api/submissions/${submissionID}`)
                            .set('authorization', `Bearer ${invalidToken}`)
                            .then(res => expect(res).to.have.status(401))
                    });
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
                    .get('/api/submissions')
                    .set('authorization', `Bearer ${adminToken}`)
                    .then(res => {
                        const submissionID = res.body[0].id;
                        return chai.request(app)
                            .delete(`/api/submissions/${submissionID}`)
                            .set('authorization', `Bearer ${notAuthorToken}`)
                            .then(res => expect(res).to.have.status(401))
                    });
            });
        });
        // TODO: stub s3
        it('should delete the submission', () => {
            let submissionID;
            return chai.request(app)
                .get('/api/submissions')
                .set('authorization', `Bearer ${adminToken}`)
                .then(res => {
                    submissionID = res.body[0].id;
                    return chai.request(app)
                        .delete(`/api/submissions/${submissionID}`)
                        .set('authorization', `Bearer ${adminToken}`)
                        .then(res => {
                            expect(res).to.have.status(204);
                            Submission.findById(submissionID)
                                .then((sub) => expect(sub).to.be.null)
                        })
                });
        });
    })
});