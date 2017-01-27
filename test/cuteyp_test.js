'use strict';

var proxy = require('./proxy_mock')
    , asyncProxy = require('./proxy_async_mock')
    , makeService = require('./service_mock')
    , test = require('supertest')
    , assert = require('assert')
    , fs = require('fs');


describe('cuteyp', function() {
    this.timeout(5000);

    var service1 = makeService('my_service1')
        , service2 = makeService('my_service2');

    beforeEach(function() {
        service1._requests = [];
        service2._requests = [];
        delete service1._expectBody;
        delete service2._expectBody;
    });

    describe('GET should send to correct service', function() {
        it('service 1', function (done) {
            testGET(proxy, service1, service2).end(done);
        });

        it('service 2', function (done) {
            testGET(proxy, service2, service1).end(done);
        });

        it('service 1 with async mapping', function (done) {
            testGET(asyncProxy, service1, service2).end(done);
        });

        it('service 2 with async mapping', function (done) {
            testGET(asyncProxy, service2, service1).end(done);
        });
    });


    describe('POST should send to correct service', function() {
        it('service 1', function (done) {
            testPOST(proxy, service1, service2).end(done);
        });

        it('service 2', function (done) {
            testPOST(proxy, service2, service1).end(done);
        });

        it('service 1 with async mapping', function (done) {
            testPOST(asyncProxy, service1, service2).end(done);
        });

        it('service 2 with async mapping', function (done) {
            testPOST(asyncProxy, service2, service1).end(done);
        });
    });


    it('should get image', function (done) {
        testGetImage(service1, 'logo.gif', done);
    });


    it('should get video (big file)', function (done) {
        testGetImage(service1, 'video.mov', done);
    });


    it('should send unicode characters', function (done) {
        testPOST(proxy, service1, service2, 'Hello - ♤♧♡♢☆😏\ud83d\ude0f').end(done);
    });


    it('should upload image', function (done) {
        testPostImage(service1, 'logo.gif', done);
    });


    it('should upload video', function (done) {
        testPostImage(service1, 'video.mov', done);
    });


    it('should upload image directly', function (done) {
        var service3 = makeService('my_service3', { useCuteyp: false });
        testPostImage(service3, 'logo.gif', done, service3);
    });


    function testGET(proxy, service, otherService) {
        var serviceName = service._serviceName;
        service._expectBody = {};

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


    function testPOST(proxy, service, otherService, testText) {
        var testText = testText || 'test';
        var serviceName = service._serviceName;
        service._expectBody = { test: testText };

        return test(proxy)
        .post('/' + serviceName + '/test')
        .set('Content-Type', 'application/json')
        .send({ test: testText })
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(function (res) {
            var expected = {
                service: serviceName,
                url: '/' + serviceName + '/test',
                method: 'POST',
                body: { test: testText }
            };

            assert.deepEqual(res.body, expected);
            assert.deepEqual(service._requests, [ expected ]);
            assert.deepEqual(otherService._requests, [ ]);
        });
    }


    function testGetImage(service, fileName, done) {
        test(proxy)
        .get('/' + service._serviceName + '/image/' + fileName)
        .expect('Content-Type', /image/)
        .expect(200)
        .end(function (err, res) {
            assert(!err);
            var imgData = fs.readFileSync(__dirname + '/'  + fileName);
            assert.deepEqual(imgData, res.body);
            done(err);
        });
    }


    function testPostImage(service, fileName, done, avoidProxy) {
        console.log('/' + service._serviceName + '/image/' + fileName);
        test(avoidProxy ? service : proxy)
        .post('/' + service._serviceName + '/image/' + fileName)
        .field('Content-Type', 'multipart/form-data')
        .field('name', 'test')
        .attach('logo', __dirname + '/' + fileName)
        .expect(200)
        .end(function (err, res) {
            if (err) console.log(err);
            done(err);
        });
    }
});
