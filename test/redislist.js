'use strict';

/* eslint-env browser, commonjs, node, mocha */

var assert = require('assert'),
    mockery = require('mockery');

mockery.registerSubstitute('redis', 'redis-mock');
mockery.registerAllowables(['../lib/redislist.js']);

mockery.enable({ warnOnReplace: true, warnOnUnregistered: false, useCleanCache: true });

var redisList = require('../lib/redislist.js');

mockery.disable();

describe('Test redislist', function() {
    it('should test pausing redislist subscription', function(done) {
        var queue = redisList();
        var subscriber = queue.subscriber('/my_path');
        var callCount = 0;
        subscriber.on('message', function() {
            callCount++;
        });

        queue.send('/my_path', 'm1', function() {
            process.nextTick(function() {
                assert.equal(callCount, 1);
                subscriber.emit('pause');

                queue.send('/my_path', 'm2', function() {
                    process.nextTick(function() {
                        assert.equal(callCount, 2);

                        queue.send('/my_path', 'm3', function() {
                            process.nextTick(function() {
                                assert.equal(callCount, 2);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });
});
