var _ = require('lodash')
    ,http = require('http');

module.exports = function(req, opts) {
    var res = new http.ServerResponse(req);

    return _.extend(res, {
        write: function(chunk, encoding) {
            this._body = this._body && this._body.length ? this._body + chunk.toString() : chunk.toString();
        },
        end: function(body) {
            body = body || this._body;
            opts.endFn && opts.endFn(body);
        }
    });
};