var Response = require('./lib/response')
    ,stompit = require('stompit');
    ;
//socketio = require('socket.io');

//var app = express();
//app.listen(8080);
module.exports = function(app, stompOpts, path) {

    var connections = new stompit.ConnectFailover([stompOpts]);

    var channel = new stompit.ChannelFactory(connections);

    channel.subscribe(path, function(error, message) {

        if (error) {
            console.log('subscribe error ' + error.message);
            return;
        }

        message.readString('utf8', function(error, body) {

            if (error) {
                console.log('read message error ' + error.message);
                return;
            }

            console.log('received message: ' + body);
            var parsed = JSON.parse(body);
            var replyTo = parsed.replyTo;

            var req = {
                headers: parsed.headers,
                url: parsed.url,
                method: parsed.method
            };

            var res = new Response({
                sendFn: function(resp) {
                    console.log("returning resp", resp);
                    channel.send(replyTo, JSON.stringify(resp));
                }
            });

            app.handle(req, res);

            message.ack();
        });
    });
}