'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');

const {app} = require('../server');

const expect = chai.expect;
chai.use(chaiHttp);


describe('API', function() {
    it('should 404 on GET request to invalid endpoint', () => {
        return chai.request(app)
            .get('/api/fooooo')
            .then(function(res) {
                expect(res).to.have.status(404);
                expect(res).to.be.json;
                expect(res.body).to.be.an('object');
                expect(res.body.message).to.equal('endpoint not found');
            });
    });
});

