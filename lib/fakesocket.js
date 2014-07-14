var stream = require('stream');
var util = require('util');
var Duplex = stream.Duplex ||
    require('readable-stream').Duplex;

module.exports = FakeSocket;

/**
 * Duplex stream which:
 *  - generates current time every sec for rstream
 *  - outputs the write stream to stdout
 *
 * Stop the read stream by calling stopTimer
 */
function FakeSocket(options) {
    // allow use without new operator
    if (!(this instanceof FakeSocket)) {
        return new FakeSocket(options);
    }
    Duplex.call(this, options); // init
    this.readArr = []; // array of times to read

    // every second, add new time string to array
//    this.timer = setInterval(addTime, 1000, this.readArr);
}
util.inherits(FakeSocket, Duplex);


FakeSocket.prototype._read = function readBytes(n) {
    console.log("_read");
    var self = this;
    while (this.readArr.length) {
        console.log("readArr", this.readArr);
        var chunk = this.readArr.shift();
        console.log("reading", chunk);
        if (!self.push(chunk)) {
            break; // false from push, stop reading
        }
    }
//    if (self.timer) { // continuing if have timer
        // call readBytes again after a second has
        // passed to see if more data then
//        setTimeout(readBytes.bind(self), 1000, n);
//    } else { // we are done, push null to end stream
//        self.push(null);
//    }
    return "boo\n\n";
};

/* stops the timer and ends the read stream */
//FakeSocket.prototype.stopTimer = function () {
//    if (this.timer) clearInterval(this.timer);
//    this.timer = null;
//};

/* for write stream just ouptut to stdout */
FakeSocket.prototype._write =
    function (chunk, enc, cb) {
        console.log('write: ', chunk.toString());
        cb();
    };

