CuteyP    ( Queue <-> Http )
===========================

Simple mechanism for converting Express Http to a queue and back.

INSTALL
=======
npm install  cuteyp

Example Usage
=============

Common dependencies
-------------------
var express = require('express');
var cuteyp = require('cuteyp');

Example front end (FE) server (Http -> Queue)
==============================================
var app = express();
app.listen(8080);

var queue = cuteyp.redis(redisConfig); //OR = cuteyp.stomp(stompitConfig);

cuteyp.fromHttp(app, queue, {
    replyTo: 'queue.reply',
    ttl: 30000, // depends on implementation
    mappingFn: function(req) { // 
        var service = req.path.split('/')[1];
        return 'queue.request.' + service;
    }
});

Example backend service (BE) (Queue -> Http)
=============================================

var app = express();
app.get('/foo/bar', function() { ...});

var queue = cuteyp.redis(redisConfig); //OR = cuteyp.stomp(stompitConfig);
cuteyp.toHttp(app, queue, 'queue.request.foo' );

Explanation
===========
Http requests to FE are converted into messages and placed on the queue.
The BE service subscribes to the queue on a particular channel/queue and 
when it receives a message it converts it into an Http request and passes 
it to express to 'handle'. When express writes the response, cuteyp 
captures the response, packages it up in a message and returns it to the 
queue via the replyTo address. Back on the FE, cuteyp is subscribing to 
the replyTo queue and will convert the reply message to a response to write 
back to the client.


Binary Support
==============
Images are converted to Base64


Queue Support
=============
Redis and Stomp are supported and there is a simple interface to implement your own queue



