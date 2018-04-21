const aws = require('aws-sdk');
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = require('../config');
const fs = require('fs'); // implicitly used by aws

aws.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
});

const S3_BUCKET = 'sublitr-images';
const s3 = new aws.S3();

function s3PublicUpload(fileInfo) {
    // fileInfo: object with k/v pairs for 'Key', 'Body' (the file itself), and 'ContentType' (e.g. pdf).
    // returns key of object on s3 server
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
        const params = Object.assign({}, fileInfo, {
            "Bucket": S3_BUCKET,
            "ACL": "bucket-owner-full-control"
        });

        s3.putObject(params, function(err, data) {
            if (err) {
                reject(console.error(err, err.stack));
            }
        });
        resolve(fileInfo.Key);
    })
}

function s3PublicDelete(url) {
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
                resolve(data);
            }
        })
    })
}

module.exports = {s3PublicUpload, s3PublicDelete};
