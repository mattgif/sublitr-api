exports.CLIENT_ORIGIN='https://sublitr.netlify.com';
exports.DATABASE_URL = process.env.DATABASE_URL || global.DATABASE_URL || 'mongodb://localhost/sublitr';
exports.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ||
    global.TEST_DATABASE_URL ||
    'mongodb://localhost/test-sublitr';