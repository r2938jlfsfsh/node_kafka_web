"use strict";

console.log("loading sse.js");

// ... with this middleware:
function sseMiddleware(req, res, next) {
    console.log(" sseMiddleware is activated with "+ req+" res: "+res);
    res.sseConnection = new Connection(res);
    console.log(" res has now connection  res: "+res.sseConnection );
    next();
}
exports.sseMiddleware = sseMiddleware;
/**
 * A Connection is a simple SSE manager for 1 client.
 */
var Connection = (function () {
    function Connection(res) {
        console.log(" sseMiddleware construct connection for response ");

        this.res = res;
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
        console.log("send event to SSE stream "+JSON.stringify(data));
        this.res.write("data: " + JSON.stringify(data) + "\n\n");
    };
    return Connection;
}());

exports.Connection = Connection;
/**
 * A Topic handles a bundle of connections with cleanup after lost connection.
 */
var Topic = (function () {
    function Topic() {
        this.connections = [];
        this.configs = [];
    }
    Topic.prototype.add = function (conn, conf) {
        var connections = this.connections;
        var configs = this.configs;
        connections.push(conn);
        configs.push(conf);
        console.log('New client connected, config: ' + JSON.stringify(conf) + ', now: ', connections.length);

        conn.res.on('close', function () {
            var i = connections.indexOf(conn);
            if (i >= 0) {
                connections.splice(i, 1);
                configs.splice(i, 1);
            }
            console.log('Client disconnected, now: ', connections.length);
        });
    };
    Topic.prototype.topicInConnConfig = function(ind, topic) {
        var configs = this.configs;
        var topInd = configs[ind].topics.indexOf(topic);
        return topInd >= 0;
    };
    Topic.prototype.forEach = function (cb) {
        this.connections.forEach(cb);
    };
    return Topic;
}());
exports.Topic = Topic;