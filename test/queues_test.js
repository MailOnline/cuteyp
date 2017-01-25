'use strict';

var assert = require('assert');

var mockery = require('mockery')
    , stompMock = {};
mockery.registerSubstitute('redis', 'redis-mock');
mockery.registerMock('stompit', stompMock);
mockery.registerAllowables(['../lib/redis.js', '../lib/redislist.js', '../lib/stomp.js']);

mockery.enable({ warnOnReplace: true, warnOnUnregistered: false, useCleanCache: true });
assert.equal(stompMock, require('stompit'), 'stompit mocked');

var redisQueue = require('../lib/redis.js')
    , redisListQueue = require('../lib/redislist.js')
    , stompQueue =  require('../lib/stomp.js');

mockery.disable();


describe('Queues', function() {
    describe('redis queue', function() {
        testQueue(redisQueue);
    });

    describe('redislist queue', function() {
        testQueue(redisListQueue);
    });

    describe.skip('stomp queue', function() {
        testQueue(stompQueue);
    });


    function testQueue(queueFactory) {
        var queue;

        before(function() {
            queue = queueFactory();
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
