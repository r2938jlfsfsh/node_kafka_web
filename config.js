"use strict";

console.log("Loading config.js");

const DEFAULT_MSG_PORT = 3000;
const DEFAULT_QRY_PORT = 3001;
const DEFAULT_ZOOKEEPER_CONN = "localhost:32181/"; //Note this is zookeeper, not broker

module.exports = {
    MSG_LISTEN_PORT: process.env.MSG_PORT || DEFAULT_MSG_PORT,
    QRY_LISTEN_PORT: process.env.QRY_PORT || DEFAULT_QRY_PORT,
    APP_VERSION: '0.9',
    //Note this is zookeeper, not broker:
    ZOOKEEPER_CONN: process.env.ZOOKEEPER_CONN || DEFAULT_ZOOKEEPER_CONN,
    // TODO should have this as a full config - maybe need other actions depending on the topic
    // TODO add keyCol list to the topic config - list of fields that make up PK to control update/insert on client
    // TODO add filter fields to the topic config
    // TODO status field to use for colour coding - or have a colour in the metadata?
    kafkaTopics: [
        {
            topic: "jobStatusX",
            timestampCol: "_msgTimestamp",
            tableHeading: "Job Status X",
            initQueryConf: {
                dbType: 'sqlite3',
                dbConf: {
                    filename: '/home/rd/WebstormProjects/db/sqllite.db',
                    query: "select * from job_status_vw where length(job_name) < 5 order by job_name desc"
                }
            }
        },
        {
            topic: "jobStatus",
            timestampCol: "_msgTimestamp",
            tableHeading: "Job Status",
            initQueryConf: {
                dbType: 'sqlite3',
                dbConf: {
                    filename: '/home/rd/WebstormProjects/db/sqllite.db',
                    query: "select * from job_status_vw where length(job_name) < 5 order by job_name"
                }
            }
        }
        ]
};
