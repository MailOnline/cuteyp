'use strict';


var proxy = require('./proxy_mock')
    , makeService = require('./service_mock')
    , test = require('supertest')
    , assert = require('assert');


describe('cuteyp', function() {
    var service1 = makeService('my_service1')
        , service2 = makeService('my_service2');

    beforeEach(function() {
        service1._requests = [];
        service2._requests = [];
    })

    describe('GET should send to correct service', function() {
        it('service 1', function (done) {
            testGET('my_service1', service1, service2).end(done);
        });

        it('service 2', function (done) {
            testGET('my_service2', service2, service1).end(done);
        });
    });


    describe('POST should send to correct service', function() {
        it('service 1', function (done) {
            testPOST('my_service1', service1, service2).end(done);
        });

        it('service 2', function (done) {
            testPOST('my_service2', service2, service1).end(done);
        });
    });


    function testGET(serviceName, service, otherService) {
        return test(proxy)
        .get('/' + serviceName + '/test')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
            var expected = {
                service: serviceName,
                url: '/' + serviceName + '/test',
                method: 'GET',
                body: {}
            };
            assert.deepEqual(res.body, expected);
            assert.deepEqual(service._requests, [ expected ]);
            assert.deepEqual(otherService._requests, [ ]);
        });
    }


    function testPOST(serviceName, service, otherService) {
        return test(proxy)
        .post('/' + serviceName + '/test')
        .set('Content-Type', 'application/json')
        .send({ test: 'test' })
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
            var expected = {
                service: serviceName,
                url: '/' + serviceName + '/test',
                method: 'POST',
                body: { test: 'test' }
            };

            assert.deepEqual(res.body, expected);
            assert.deepEqual(service._requests, [ expected ]);
            assert.deepEqual(otherService._requests, [ ]);
        });
    }
});
