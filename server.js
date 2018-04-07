'user strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const passport = require('passport');
const mongoose = require('mongoose');

const userRouter = require('./users/router');
const authRouter = require('./auth/router');
const submissionRouter = require('./submissions/router');

mongoose.Promise = global.Promise;

const PORT = process.env.PORT || 3000;

const {CLIENT_ORIGIN, DATABASE_URL} = require('./config');
const {localStrategy, jwtStrategy} = require('./auth/strategies');

const app = express();

app.use(morgan('common'));

// TODO: remove localhost for production
app.use(
    cors({
        origin: [CLIENT_ORIGIN, 'http://localhost:8080']
    })
);

passport.use(localStrategy);
passport.use(jwtStrategy);

app.use('/api/users', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/submissions', submissionRouter);

app.get('*', (req, res) => {
   res.status(404).json({message: 'endpoint not found'});
});

let server;
function runServer(databaseUrl = DATABASE_URL, port = PORT) {
    return new Promise((resolve, reject) => {
        mongoose.connect(databaseUrl, err => {
            if (err) {
                return reject(err);
            }
            server = app.listen(port, () => {
                console.log(`Your app is listening on port ${port}`);
                resolve();
            })
                .on('error', err => {
                    mongoose.disconnect();
                    reject(err);
                });
        });
    });
}

function closeServer() {
    return mongoose.disconnect().then(() => {
        return new Promise((resolve, reject) => {
            console.log('Closing server');
            server.close(err => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    });
}

if (require.main === module) {
    runServer().catch(err => console.error(err));
}

module.exports = { app, runServer, closeServer };

