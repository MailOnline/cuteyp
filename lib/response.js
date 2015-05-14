var _ = require('lodash')
    ,http = require('http');

module.exports = function(req, opts) {
    var res = new http.ServerResponse(req);

    return _.extend(res, {
        write: function(chunk, encoding) {
            this._chunks = this._chunks ? Buffer.concat([this._chunks, chunk]) : chunk;
        },
        end: function(chunk) {
            var self = this;

            var body = this._chunks && chunk
                        ? Buffer.concat([this._chunks, chunk])
                        : this._chunks
                            ? this._chunks
                            : chunk;

            if (body) body = toString(body);
            opts.endFn && opts.endFn(body);

            function toString(body) {
                var contentType = res.get('Content-Type');
                var base64 = contentType && contentType.match(/image|video/);
                body = body.toString(base64 ? 'base64' : 'utf8');
                if (base64) self.set('x-base64', true);
                return body;
            }
        }
    });
};
