CuteyP    ( Queue <-> Http )
===========================

[![Greenkeeper badge](https://badges.greenkeeper.io/MailOnline/cuteyp.svg)](https://greenkeeper.io/)

Simple mechanism for converting Express Http to a queue and back.

[![Build Status](https://travis-ci.org/MailOnline/cuteyp.svg?branch=master)](https://travis-ci.org/MailOnline/cuteyp)

KNOWN ISSUES
============
Currently multibyte only works reliably with Express 3 and formidable.
Streaming only works from server->client

INSTALL
=======
npm install  cuteyp

Example Usage
=============

Common dependencies
-------------------

```
var express = require('express');
var cuteyp = require('cuteyp');
```


Example front end (FE) server (Http -> Queue)
==============================================

```
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
```

`redisConfig` can include `host`, `port` and any other options supported by [node redis](https://github.com/NodeRedis/node_redis) client.

mappingFn can be asynchronous with callback as a second parameter. Callback should be called with `err` and `destination`.


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



