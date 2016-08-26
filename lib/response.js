'use strict';

var _ = require('lodash')
    , http = require('http');

module.exports = function(req, opts) {
    var res = new http.ServerResponse(req);

    return _.extend(res, {
        write: function(chunk, encoding) {
            var bodyInfo = toString(this, chunk);
            opts.writeFn(bodyInfo);

        },
        end: function(chunk, encoding) {
            if (chunk) this.write(chunk, encoding);
            opts.endFn();
        }
    });
};


function toString(self, body) {
    var contentType = self.get('Content-Type');
    var isBinary = contentType && /image|video/.test(contentType);
    body = body.toString(isBinary ? 'base64' : 'utf8');
    return { isBinary: isBinary, body: body };
}
