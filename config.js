exports.CLIENT_ORIGIN=["https://sublitr.netlify.com", "https://sublitr.com", "http://sublitr.com", "http://www.subitr.com", "http://www.subitr.com", "http://localhost:8080"]
exports.DATABASE_URL = process.env.DATABASE_URL || global.DATABASE_URL || 'mongodb://localhost/sublitr';
exports.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ||
    global.TEST_DATABASE_URL ||
    'mongodb://localhost/test-sublitr';
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
exports.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
exports.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
exports.S3_BUCKET = process.env.S3_BUCKET;