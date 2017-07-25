"use strict";

console.log("loading sqlLib.js");

var sharedLib = require('./sharedLib')
    , conf = require('./config');

var async = require('async')
    , sqlite3 = require('sqlite3').verbose() //TODO turn verbose off
;

function runClientQueries(conn, topicConf){
    console.log('New consumer started - registering init queries');

    var queryList = [];

    for (var i = 0; i < topicConf.length; i++) {
        if (conn.topicSubscribed(topicConf[i].topic)) {
            console.log('New consumer is subscribed to topic ' + topicConf[i].topic + '; adding to query list');
            queryList.push({conn: conn, topic: topicConf[i]});
        }
    }

    // Run the queries one at a time, in the background.
    async.eachSeries(queryList, function (query, cb) {
            runQuery(query, function (err, data) {
                cb(err, data);
            });
        }
        , function (err, data) {
            if (!err) {
                console.log("Finished processing user queries successfully.");
            } else {
                console.log("ERROR: failed to process all user queries: " + err.message);
            }

            var msg = {message: "QUERIES_COMPLETE"};
            conn.send(msg, "__QUERY_END");
        }
    );
}
exports.runClientQueries = runClientQueries;

function runQuery(query, cb) {
    var t = query.topic.topic;
    console.log(t + ": In runQuery, for topic " + JSON.stringify(query.topic));
    var conn = query.conn;

    var db = new sqlite3.Database(query.topic.initQueryConf.dbConf.filename, sqlite3.OPEN_READONLY);

    console.log(t + ": Opened DB");

    db.each(query.topic.initQueryConf.dbConf.query
        , function(err, row){
            if (row.job_name.substring(1,8) === 'job99998' || row.job_name === 'job2'){
                console.log(t + ': Result row: ' + JSON.stringify(row));
            }
            var outMsg = sharedLib.formatMessage(JSON.stringify(row), t, 'JSON', conf);
            //console.log("New output: "+ JSON.stringify(outMsg));
            conn.send(outMsg, t);
        }
    );
    console.log(t + ": Finished db.each call");
    db.close(function(err, data){
        if (err){
            console.log(t + ": ERROR closing DB");
        } else {
            console.log(t + ": DB closed successfully");
        }
        cb(null, t);
    });
    console.log(t + ": At end of runQuery");
}
