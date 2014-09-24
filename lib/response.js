var _ = require('lodash')
    ,http = require('http');

module.exports = function(req, opts) {
    var res = new http.ServerResponse(req);

    return _.extend(res, {

        write: function(chunk, encoding) {
            this._concatenatedChunks = this._concatenatedChunks ? Buffer.concat([this._concatenatedChunks, chunk]) : chunk;
        },
        end: function(body) {
            if (!body && this._concatenatedChunks) {
                //convert images to base64
                var contentType = res.get('Content-Type');
                if (contentType && contentType.match(/image/)) {
                    this.set('x-base64', true);
                    body = new Buffer(this._concatenatedChunks).toString('base64');
                } else {
                    body = new Buffer(this._concatenatedChunks).toString('utf8');
                }
            }
            opts.endFn && opts.endFn(body);
        }
    });
};