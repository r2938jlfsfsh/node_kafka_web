"use strict";

console.log("Loading config.js");

const DEFAULT_PORT = 3000;

module.exports = {
    LISTEN_PORT: process.env.PORT || DEFAULT_PORT,
    APP_VERSION: '0.9',
    //Note this is zookeeper, not broker:
    ZOOKEEPER_CONN: process.env.ZOOKEEPER_CONN || "localhost:32181/",
    // TODO Change to an array of supported topics, with corresponding URL that it is monitored from
    // TODO should have this as a full config - maybe need other actions depending on the topic
    //      like adding a unique key based on other fields
    //      converting from ? to JSON etc
    kafkaTopics: [{topic: "jobStatusX"}, {topic: "jobStatus"}]
};
