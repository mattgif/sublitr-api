const aws = require('aws-sdk');
const { S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = require('../config');
const fs = require('fs'); // implicitly used by aws

aws.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
});

const s3 = new aws.S3();

function s3Upload(fileInfo) {
    // fileInfo: object with k/v pairs for 'Key', 'Body' (the file itself), and 'ContentType' (e.g. pdf).
    // returns url of object on s3 server
    return new Promise((resolve, reject) => {
        const requiredKeys = ['Key', 'Body', 'ContentType'];
        const missingKey = requiredKeys.find(keyField => !(keyField in fileInfo));
        if (missingKey) {
            return Promise.reject({
                code: 422,
                reason: 'ValidationError',
                message: 'Missing key',
                location: missingKey
            })
        }
        const url = `https://s3.amazonaws.com/sublitr/${fileInfo.Key}`;
        const params = Object.assign({}, fileInfo, {
            "Bucket": S3_BUCKET,
            "ACL": "bucket-owner-full-control"
        });

        s3.putObject(params, function(err, data) {
            if (err) {
                reject(console.error(err, err.stack));
            }
        });
        resolve(url);
    })
}

function s3Delete(url) {
    // takes string URL for file location and deletes that file from s3
    return new Promise((resolve, reject) => {
        const split = url.split('/');
        const key = split[split.length-1];
        const params = {
            Bucket: S3_BUCKET,
            Delete: {
                Objects: [{
                    Key: key,
                }]
            }
        };
        s3.deleteObjects(params, function(err, data) {
            if (err) {
                reject(console.error(err, err.stack));
            } else {
                resolve(console.log('s3 item deleted', data));
            }
        })
    })
}

module.exports = {s3Upload, s3Delete};
