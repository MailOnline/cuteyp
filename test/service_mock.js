'use strict';

var express = require('express')
    , cuteyp = require('../cuteyp')
    , bodyParser = require('body-parser')
    , fs = require('fs');

module.exports = function(serviceName) {
    var app = express();
    app._requests = [];

    app.use(bodyParser());
    app.get('/' + serviceName + '/test', handler);
    app.post('/' + serviceName + '/test', handler);
    app.get('/' + serviceName + '/image', getImage);

    var queue = require('./queue_mock')();
    cuteyp.toHttp(app, queue, 'queue.request.' + serviceName);

    return app;


    function handler(req, res) {
        var data = {
            service: serviceName,
            url: req.url,
            method: req.method,
            body: req.body
        };
        app._requests.push(data);
        // console.log('service:', data);
        res.set('Content-Type', 'application/json');
        res.send(JSON.stringify(data));
    }


    function getImage(req, res) {
        res.set('Content-Type', 'image/gif');
        fs.createReadStream(__dirname + '/logo.gif')
        .pipe(res);
    }
}
