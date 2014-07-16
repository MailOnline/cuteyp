var _ = require('lodash')
    ,http = require('http');

module.exports = function(req, opts) {
    var res = new http.ServerResponse(req);

    return _.extend(res, {
        write: function(chunk, encoding) {
            var contentType = res.get('Content-Type');

            if (contentType && contentType.match(/image/)) {
                chunk = new Buffer(chunk).toString('base64');
                this.set('x-base64', true);
            }
            this._body = this._body && this._body.length ? this._body + chunk.toString() : chunk.toString();
        },
        end: function(body) {
            body = body || this._body;
            console.log("END body", body && body.substring(0,100));
            opts.endFn && opts.endFn(body);
        }
    });
};