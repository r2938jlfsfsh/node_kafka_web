"use strict";

console.log("loading sharedLib.js");

function processArgs(args){
    var retArgs = {};

    // Set-up defaults:
    retArgs['MESSAGE_SERVER'] = true;
    retArgs['QUERY_SERVER'] = true;

    // Ignore first 2 arguments which are node and script name
    for(var argNum = 2; argNum < args.length; argNum++){
        var argArr = args[argNum].split('=');
        switch(argArr[0]){
            case '--SERVER_TYPE':
                switch(argArr[1]) {
                    case 'messageServer':
                        retArgs['QUERY_SERVER'] = false;
                        break;
                    case 'queryServer':
                        retArgs['MESSAGE_SERVER'] = false;
                        break;
                    default:
                        console.log("WARNING: invalid SERVER_TYPE parameter passed, ignoring: " + argArr[1]);
                }
                break;
            default:
                console.log("WARNING: Invalid parameter passed, ignoring: " + argArr);
        }
    }//);
    return retArgs;
}
exports.processArgs = processArgs;

function pad(pad, str, padLeft) {
    if (typeof str === 'undefined')
        return pad;
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

function formatMessage(msg, topic, type, conf) {
    var msgVal;
    var metaVal = {};
    var tsCol;

    switch(type){
        //TODO be able to handle delimited messages - translate to JSON based on schema in the config
        //TODO be able to handle avro messages - translate to JSON
        case 'JSON':
            msgVal = JSON.parse(msg);
            break;
        default:
            console.log("ERROR: unsupported message type in formatMessage: " + type);
            return null;
    }

    for (var i = 0; i < conf.kafkaTopics.length; i++) {
        if (conf.kafkaTopics[i].topic === topic) {
            tsCol = conf.kafkaTopics[i].timestampCol;
        }
    }
    if (tsCol) {
        for (var k in msgVal) {
            if (k === tsCol) {
                metaVal['timestampCol'] = k;
                // Pad the timestamp out to include milliseconds to make comparisons easier
                metaVal['timestampVal'] = pad("00000000000000000", msgVal[k], false);
            }
        }
    }

    //TODO remove this hack
    switch (msgVal['status']) {
        case 'ENDED_OK':
            metaVal['rowColour'] = 'green';
            break;
        case 'FAILED':
            metaVal['rowColour'] = 'red';
            break;
    }
    //console.log(metaVal);
    return {topic: topic, metadata: JSON.stringify(metaVal), value: msg};
}// formatMessage
exports.formatMessage = formatMessage;
