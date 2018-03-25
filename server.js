const express = require('express');
const app = express();
const cors= require('cors');
const {CLIENT_ORIGIN} = require('./config');

const userRouter = require('./users/router');
const PORT = process.env.PORT || 3000;

app.use(
    cors({
        origin: CLIENT_ORIGIN
    })
);

app.use('/api/users', userRouter);

app.get('*', (req, res) => {
   res.status(404).json({message: 'endpoint not found'});
});

app.listen(PORT, () => console.log('Listening on port ${PORT}'));

module.exports = {app};
