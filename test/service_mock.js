'use strict';

var express = require('express')
    , cuteyp = require('../cuteyp')
    , bodyParser = require('body-parser')
    , formidable = require('formidable')
    , fs = require('fs')
    , assert = require('assert');


module.exports = function(serviceName, opts) {
    opts = opts || {};

    var app = express();
    app._serviceName = serviceName;
    app._requests = [];

    app.use(bodyParser());
    app.get('/' + serviceName + '/test', handler);
    app.post('/' + serviceName + '/test', handler);
    app.get('/' + serviceName + '/image/:image', getImage);
    app.post('/' + serviceName + '/image/:image', postImage);

    var queue = require('./queue_mock')();
    if (opts.useCuteyp !== false)
        cuteyp.toHttp(app, queue, 'queue.request.' + serviceName);

    return app;


    function handler(req, res) {
        var data = {
            service: serviceName,
            url: req.url,
            method: req.method,
            body: req.body
        };
        if (app._expectBody) assert.deepEqual(req.body, app._expectBody);

        app._requests.push(data);
        // console.log('service:', data);
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(data));
    }


    function getImage(req, res) {
        res.set('Content-Type', 'image/gif');
        fs.createReadStream(__dirname + '/' + req.params.image)
        .pipe(res);
    }


    function postImage(req, res) {
        var form = new formidable.IncomingForm();
        form.parse(req, function (err, fields, files) {
            if (err) return res.send(500, err);

            try {
                assert.equal(fields.name, 'test');
                var uploadedImgData = fs.readFileSync(files.logo.path);
                var imgData = fs.readFileSync(__dirname + '/' + req.params.image);
                assert.deepEqual(uploadedImgData, imgData);
                res.set('Content-Type', 'text/plain');
                res.send(200, 'OK');
            } catch(e) {
                res.send(500, e.message);
            }            
        });
    }
};
