"use strict";

console.log("loading sharedLib.js");

function processArgs(args){
    var retArgs = {};

    // Set-up defaults:
    retArgs['SERVER_TYPE'] = 'all';

    // Ignore first 2 arguments which are node and script name
    for(var argNum = 2; argNum < args.length; argNum++){
        var argArr = args[argNum].split('=');
        switch(argArr[0]){
            case '--SERVER_TYPE':
                switch(argArr[1]) {
                    case 'messageServer':
                        retArgs['SERVER_TYPE'] = 'messageServer';
                        break;
                    case 'queryServer':
                        retArgs['SERVER_TYPE'] = 'queryServer';
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
