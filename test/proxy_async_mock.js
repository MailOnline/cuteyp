'use strict';

var express = require('express')
    , cuteyp = require('../cuteyp');

var app = express();

module.exports = app;

var queue = require('./queue_mock')();

cuteyp.fromHttp(app, queue, {
    replyTo: 'queue.reply',
    ttl: 1000,
    mappingFn: function(req, callback) {
        setTimeout(function() {
            var service = req.path.split('/')[1];
            callback(null, 'queue.request.' + service);
        });
    }
});
