'use strict';

var express = require('express')
    , cuteyp = require('../cuteyp');

var app = express();

module.exports = app;

var queue = require('./queue_mock')();

cuteyp.fromHttp(app, queue, {
    replyTo: 'queue.reply',
    ttl: 1000,
    mappingFn: function(req) {
        var service = req.path.split('/')[1];
        return 'queue.request.' + service;
    }
});
