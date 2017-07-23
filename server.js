var express = require('express')
    , http = require('http')
    , sseMW = require('./sse')
    , sharedLib = require('./sharedLib')
    , conf = require('./config')
    , bodyParser = require('body-parser')
    //, sql = require('sqlite3').verbose() //TODO turn verbose off
;

var args = sharedLib.processArgs(process.argv);

//console.log("Args: " + JSON.stringify(args));
args.QUERY_SERVER && console.log('Operating as query server');
args.MESSAGE_SERVER && console.log('Operating as message server');

var myPort = (args.QUERY_SERVER && ! args.MESSAGE_SERVER) ? conf.QRY_LISTEN_PORT : conf.MSG_LISTEN_PORT;

// Initialise Kafka if we're a message server
if (args.MESSAGE_SERVER) {
    var kafka = require('kafka-node');
    var Consumer = kafka.Consumer;
    var client = new kafka.Client(conf.ZOOKEEPER_CONN);

    // Configure Kafka Consumer
    var consumer = new Consumer(
        client,
        [],
        {fromOffset: true}
    );

    consumer.on('message', function (message) {
        handleMessage(message);
    });

    consumer.on('error', function(err) {
        console.log("ERROR: " + err.message);
    });

    var topicString = [];
    for (var i = 0; i < conf.kafkaTopics.length; i++) {
        topicString.push({topic: conf.kafkaTopics[i].topic, partition: 0, offset: 0});
    }

    consumer.addTopics(topicString, () => console.log("Topics added"));

    // Clients receiving realtime updates:
    var sseClients = new sseMW.Topic('MESSAGE');
}

// Initialise required databases if we're a query server:
if (args.QUERY_SERVER) {
    // Query clients, these are expected to be shortlived:
    var sseQueryClients = new sseMW.Topic('QUERY');
}

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var server = http.createServer(app);

server.listen(myPort, function () {
    console.log('Server running, version '+conf.APP_VERSION+', Express is listening... at '+ myPort);
});

app.use(express.static(__dirname + '/public'));

app.get('/about', function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("Version "+conf.APP_VERSION+". No Data Requested, so none is returned");
    res.write("Supported URLs:");
    res.write("/public , /public/index.html ");
    res.write("incoming headers" + JSON.stringify(req.headers));
    res.end();
});

//configure sseMW.sseMiddleware as function to get a stab at incoming requests, in this case by adding a
// Connection property to the request
app.use(sseMW.sseMiddleware)

function createConn(req,res) {
    var topics = req.query.topicString;
    var clientConf = {topics: []};

    for (var i = 0; i < conf.kafkaTopics.length; i++) {
        if (topics == null) {
            clientConf.topics.push(conf.kafkaTopics[i].topic);
        } else {
            var spl = topics.split(",");
            for (let s of spl) {
                if (s === conf.kafkaTopics[i].topic) {
                    clientConf.topics.push(s);
                }
            }
        }
    }

    var sseConnection = res.sseConnection;
    sseConnection.setup();
    var connWrapper = new sseMW.ConnectionWrapper(sseConnection,clientConf);
    return connWrapper;
}

//var m;

//send message to set of clients
updateSseClients = function(message, msgTopic, clients) {
    this.m=message;
    this.t=msgTopic;
    //sseClients.forEach(
    clients.forEach(
        function(connWrapper, arrayInd) {
            //XXif (this.t == null || clients.topicInConnConfig(arrayInd, this.t)) {
            if (this.t == null || connWrapper.topicSubscribed(this.t)) {
                console.log("Sending message from client " + this.t + " to client " + arrayInd);
                connWrapper.send(this.m);
            } else {
                console.log("Skipping sending message from topic " + this.t + " to client " + arrayInd);
            }
        }
        , this // this second argument to forEach is the thisArg
        // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
    ); //forEach
}// updateSseClients

// initial registration of SSE Client Connection for messages
if (args.MESSAGE_SERVER) {
    app.get('/jobStatus/updates', function(req,res){
        var newConn = createConn(req, res);
        sseClients.add(newConn);
    } );

    function handleMessage(msg) {
        //TODO be able to handle delimited messages - translate to JSON based on schema in the config
        //TODO be able to handle avro messages - translate to JSON

        var msgVal = JSON.parse(msg.value);
        var metaVal = {};
        var tsCol;

        for (var i = 0; i < conf.kafkaTopics.length; i++) {
            if (conf.kafkaTopics[i].topic === msg.topic) {
                tsCol = conf.kafkaTopics[i].timestampCol;
            }
        }
        if (tsCol) {
            for (k in msgVal) {
                if (k === tsCol) {
                    metaVal['timestampCol'] = k;
                    metaVal['timestampVal'] = msgVal[k];
                }
            }
        }
        console.log(metaVal);
        var outMsg = {topic: msg.topic, metadata: JSON.stringify(metaVal), value: msg.value};
        //console.log("Output msg: "+JSON.stringify(outMsg));
        updateSseClients(outMsg, msg.topic, sseClients);
    }// handleMessage
}

// initial registration of SSE Client Connection for queries
if (args.QUERY_SERVER) {
    app.get('/jobStatus/init', function(req,res){
        var conn = createConn(req, res);
        sseQueryClients.add(conn);

        // TODO start the background query for each topic they subscribed to
        for (var i = 0; i < conf.kafkaTopics.length; i++){
            if (conn.topicSubscribed(conf.kafkaTopics[i].topic)){
                console.log('New consumer is subscribed to topic ' + conf.kafkaTopics[i].topic + '; starting init query');

            }
        }
        // TODO Do one at a time or in parallel?  Start with one-at-a-time.

    } );
/*

    function handleQueryResults(data, client, endInd){
        // data should be an array of comma+quote delimited messages

        // Go through each record in the array
        data.forEach(function(record, client){
            // Transform into JSON

            // Send to the client
        });

        if (endInd){
            // Send end-of-data indicator for this client, so they close the Query connection.
        }
    }
    */
}

// send a heartbeat signal to all SSE clients, once every interval seconds (or every 3 seconds
// if no interval is specified)
initHeartbeat = function(interval) {
    setInterval(function()  {
            var msg = {"label":"The latest", "time":new Date()};
            if (args.MESSAGE_SERVER) {
                updateSseClients(msg, null, sseClients);
            }
            if (args.QUERY_SERVER) {
                updateSseClients(msg, null, sseQueryClients);
            }
        }//interval function
        , interval?interval*1000:3000
    ); // setInterval
}//initHeartbeat

// initialize heartbeat at x second interval
initHeartbeat(30);

