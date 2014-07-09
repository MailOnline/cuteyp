module.exports = function(opts) {

    var headers = {};

    return {
        send: function(code, body) {
            if (2 == arguments.length) {
                var statusCode = body;
                body = arguments[1];
            }
            console.log("SEND", code, body);
            opts.sendFn && opts.sendFn({ code: code, body: body, headers: headers })
        },
        end: function() {
            console.log("END");
        },
        setHeader: function(field, value) {
            console.log("setHeader", field, value);
            headers[field] = value;
        }
    };
};