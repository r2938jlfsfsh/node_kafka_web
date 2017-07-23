"use strict";

console.log("loading sqlLib.js");

var TopicQuery = (function () {
    function TopicQuery(res) {
        console.log("Starting TopicQuery ");

        this.res = res;
    }
    TopicQuery.prototype.setup = function () {
        console.log("set up SSE stream for response");
        this.res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
    };
    TopicQuery.prototype.send = function (data) {
        console.log("send event to SSE stream "+JSON.stringify(data));
        this.res.write("data: " + JSON.stringify(data) + "\n\n");
    };
    return TopicQuery;
}());

exports.TopicQuery = TopicQuery;

