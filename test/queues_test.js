'use strict';

var assert = require('assert');

const RedisMock = require('ioredis-mock');

var mockery = require('mockery')
    , stompMock = {};

RedisMock.prototype.brpop = function (subscriptionPath, i, queueFn) {
    queueFn(undefined, []);
};

mockery.registerMock('ioredis', RedisMock);
mockery.registerMock('stompit', stompMock);
mockery.registerAllowables(['../lib/redislist.js', '../lib/stomp.js']);

mockery.enable({ warnOnReplace: true, warnOnUnregistered: false, useCleanCache: true });
assert.equal(stompMock, require('stompit'), 'stompit mocked');

var redisListQueue = require('../lib/redislist.js')
    , stompQueue =  require('../lib/stomp.js');

mockery.disable();


describe('Queues', function() {
    describe('redislist queue', function() {
        testQueue(redisListQueue);
    });

    describe.skip('stomp queue', function() {
        testQueue(stompQueue);
    });


    function testQueue(queueFactory) {
        var queue;

        before(function() {
            queue = queueFactory({ host: 'test', port: 'test', retryStrategy: 'test'});
        });

        it('defines subscriber and send methods', function() {
            assert.equal(typeof queue.subscriber, 'function');
            assert.equal(typeof queue.send, 'function');
        });

        it.skip('subscriber method creates Subscriber object for passed path', function() {
            queue.subscriber('/my_path');
        });
    }
});
