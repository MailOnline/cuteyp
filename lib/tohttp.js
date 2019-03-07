'use strict';

var Response = require('./response')
    , _ = require('lodash')
    , http = require('http')
    , server = http.createServer()
    , EventEmitter = require('events').EventEmitter;

module.exports = toHttp;

function toHttp(app, queueImpl, subscriptionPath, filterFn) {
    var subscriber = queueImpl.subscriber(subscriptionPath);

    subscriber.on('message', function (error, message) {
        if (error) {
            console.error('read message error ' + error.message);
            subscriber.emit('ack', error, message);
            return message.ack();
        }

        var body = message.body;
        var parsed = JSON.parse(body);

        var start = process.hrtime();
        var parsed = JSON.parse(body);
        var end  = process.hrtime(start);
        var duration = (end[0] * 1000) + (end[1] /1000000);


        var replyTo = parsed.replyTo;
        var correlationId = parsed.correlationId;
        var startTime = process.hrtime();

        if (filterFn) {
            if (!filterFn(parsed)) {
                console.error("Ignoring message, failed filter");
                return;
            }
        }

        var headers = parsed.headers;
        headers.correlationId = correlationId;

        // minimal fake socket to get express
        // to work with the IncomingMessage
        var req = new http.IncomingMessage({
            __proto__: EventEmitter.prototype,
            readable: true,
            resume: function() {}
        });

        // grab the inherited method
        var originalON = req.on;

        // redefine the method to handle data asked later on
        // by formidable.parse(req) method
        // (which adds listeners after but we don't know *when*)
        req.on = function on(msg) {
            // if the message is 'data'
            if (msg === 'data') {
                // flag this object synchronously
                this._askedForData = true;
                // emit 'data', if any, and 'end' next tick
                // to allow chained listeners to be added
                // after this req.on(...) call
                Promise.resolve(this).then(function (self) {
                    // emit the data only if there was some
                    if (self._data) {
                        self.emit('data', self._data);
                    }
                    // emit the end listener regardless
                    self.emit('end');
                });
            }
            // if message is 'end' and nobody asked for data
            else if (msg === 'end' && !this._askedForData) {
                // emit 'end' next tick
                Promise.resolve(this).then(function (self) {
                    // however, if some code added event
                    // 'end' before 'data' for some reason,
                    // do not emit 'end' again and just return
                    // 'cause it would happen already via 'data'
                    if (self._askedForData) return;
                    self.emit('end');
                });
            }
            // return whatever would've returned  the original .on()
            return originalON.apply(this, arguments);
        };


        _.extend(req, {
            headers: parsed.headers,
            url: parsed.url,
            method: parsed.method
        });

        var res = new Response(req, {
            writeFn: function (bodyInfo, encoding) {
                var outgoingResponse = {
                    version: 2,
                    correlationId: correlationId
                };

                if (!this._headersSent) {
                    res.emit('header'); // forces headers to be set
                    this._headersSent = true;
                    outgoingResponse.first = true;
                    outgoingResponse.headers = res._headers;
                    outgoingResponse.code = res.statusCode;
                }

                if (bodyInfo.body) {
                    _.extend(outgoingResponse, bodyInfo);
                    this._bodyLength = this._bodyLength > 0 ? this._bodyLength + bodyInfo.body.length : bodyInfo.body.length;
                }
                queueImpl.send(replyTo, JSON.stringify(outgoingResponse));

            },
            endFn: function () {
                var hrDuration = process.hrtime(startTime);
                var durationMs = (hrDuration[0] * 1000) + (hrDuration[1] /1000000);
                var outgoingResponse = {
                    version: 2,
                    headers: res._headers,
                    code: res.statusCode,
                    correlationId: correlationId,
                    duration: durationMs,
                    end: true
                };

                console.log( req.method, correlationId, res.statusCode, parsed.url, replyTo, outgoingResponse.headers.location, this._bodyLength, durationMs);

                queueImpl.send(replyTo, JSON.stringify(outgoingResponse));
                message.ack();
                subscriber.emit('ack', error, message);
                // Notify listeners that the response is complete, the order of events
                // is important, `close` must be the last one
                res.emit('end');
                res.emit('finish');
                res.emit('close');
            }
        });

        if (parsed.body) {
            req._data = parsed.headers["x-base64"] ? new Buffer(parsed.body, 'base64') : parsed.body;
        }

        var metric = {
            ns: 'cuteyp.toHttp parse',
            url: req.url,
            body: req.body,
            path: req.path,
            method: req.method,
            replyTo: replyTo,
            correlationId: correlationId,
            duration: duration
        };
        logMe(metric);

        // Emit a request event on a mocked server, ideally it should be done on
        // the actual server, but `app` doesn't hold a reference to it
        // For tracking purposes however, emitting on this server has the same effect
        server.emit('request', req, res);

        app.handle(req, res);

    });

    return subscriber;
}


function isNumeric(val) {
    return !isNaN(parseFloat(val)) && isFinite(val);
}

function logMe(metric) {
    console.log('LOGME ' + Object.keys(metric).map(
        key => isNumeric(metric[key])
            ? (key + '=' + metric[key])
            : (key + '="' + metric[key] + '"')
    ).join(" "));
}