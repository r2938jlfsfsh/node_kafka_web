"use strict";

console.log("loading sse.js");

// ... with this middleware:
function sseMiddleware(req, res, next) {
    //console.log(" sseMiddleware is activated with "+ req+" res: "+res);
    res.sseConnection = new Connection(res);
    //console.log(" res has now connection  res: "+res.sseConnection );
    next();
}
exports.sseMiddleware = sseMiddleware;
/**
 * A Connection is a simple SSE manager for 1 client.
 */
var Connection = (function () {
    function Connection(res) {
        //console.log(" sseMiddleware construct connection for response ");

        this.res = res;
        this.messageCount = 0;
    }
    Connection.prototype.setup = function () {
        console.log("set up SSE stream for response");
        this.res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
    };
    Connection.prototype.send = function (data) {
        //console.log("send event to SSE stream "+JSON.stringify(data));
        this.messageCount++;
        this.res.write("data: " + JSON.stringify(data) + "\n\n");
    };
    return Connection;
}());

exports.Connection = Connection;

// Wrap a connection object up with its configuration
var ConnectionWrapper = (function () {
    function ConnectionWrapper(conn, conf) {
        this.connection = conn;
        this.conf = conf;
    }

    ConnectionWrapper.prototype.topicSubscribed = function(topic) {
        var topInd = this.conf.topics.indexOf(topic);
        return topInd >= 0;
    }

    ConnectionWrapper.prototype.send = function(msg, topic) {
        switch(topic) {
            case "__HEARTBEAT":
                var newMsg = msg;
                newMsg["messageCount"] = this.connection.messageCount;
                console.log("Sending heartbeat message: " + JSON.stringify(newMsg));
                this.connection.send(newMsg);
                break;
            case "__QUERY_END":
                this.connection.send(msg);
                break;
            default:
                if (this.topicSubscribed(topic)) {
                    this.connection.send(msg);
                }
        }
    }

    return ConnectionWrapper;
}());
exports.ConnectionWrapper = ConnectionWrapper;

/**
 * A Topic handles a bundle of connections with cleanup after lost connection.
 */
var Topic = (function () {
    function Topic(serverType) {
        this.connections = [];
        this.serverType = serverType || 'UNKNOWN';
        console.log("Created new connection bundle of type " + this.serverType);
    }
    Topic.prototype.add = function (connWrapper) {
        var connections = this.connections;
        var serverType = this.serverType;
        connections.push(connWrapper);
        console.log('New ' + this.serverType + ' client connected, config: ' + JSON.stringify(connWrapper.conf) + ', now: ', connections.length);

        connWrapper.connection.res.on('close', function () {
            for(var i = 0; i < connections.length; i++){
                if (connections[i].connection == connWrapper.connection){
                    connections.splice(i, 1);
                }
            }
            console.log(serverType + ' client disconnected, now: ', connections.length);
        });
    };

    Topic.prototype.forEach = function (cb) {
        this.connections.forEach(cb);
    };
    return Topic;
}());
exports.Topic = Topic;