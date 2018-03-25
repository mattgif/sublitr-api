const express = require('express');
const app = express();
const passport = require('passport');
const cors= require('cors');
const {CLIENT_ORIGIN} = require('./config');

const userRouter = require('./users/router');
const {localStrategy} = require('./auth/strategies');
const authRouter = require('./auth/router');
const PORT = process.env.PORT || 3000;

const {DATABASE_URL} = require('./config');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect(DATABASE_URL);

app.use(
    cors({
        origin: CLIENT_ORIGIN
    })
);

passport.use(localStrategy);

app.use('/api/users', userRouter);
app.use('/api/auth', authRouter);

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

