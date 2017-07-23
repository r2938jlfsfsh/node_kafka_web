"use strict";

console.log("Loading config.js");

const DEFAULT_MSG_PORT = 3000;
const DEFAULT_QRY_PORT = 3001;

module.exports = {
    MSG_LISTEN_PORT: process.env.MSG_PORT || DEFAULT_MSG_PORT,
    QRY_LISTEN_PORT: process.env.QRY_PORT || DEFAULT_QRY_PORT,
    APP_VERSION: '0.9',
    //Note this is zookeeper, not broker:
    ZOOKEEPER_CONN: process.env.ZOOKEEPER_CONN || "localhost:32181/",
    // TODO Change to an array of supported topics, with corresponding URL that it is monitored from
    // TODO should have this as a full config - maybe need other actions depending on the topic
    //      like adding a unique key based on other fields
    //      converting from ? to JSON etc
    kafkaTopics: [
        {
            topic: "jobStatusX",
            timestampCol: "_msgTimestamp",
            initQueryConf: {}
        },
        {
            topic: "jobStatus",
            timestampCol: "_msgTimestamp",
            initQueryConf: {
                dbType: 'sqlite3',
                dbConf: {
                    filename: 'sqllite.db',
                    // TODO Add process date placeholder
                    query: "select * from jobStatus_vw"
                }
            }
        }
        ]
};
