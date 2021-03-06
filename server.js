var express = require('express')
    , http = require('http')
    , sseMW = require('./sse')
    , sharedLib = require('./sharedLib')
    , conf = require('./config')
    , bodyParser = require('body-parser')
    , sqlLib = require('./sqlLib')
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

if (args.MESSAGE_SERVER) {
    app.use(express.static(__dirname + '/public'));
    app.use(function (req, res, next) {

        // Website you wish to allow to connect
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

        // Set to true if you need the website to include cookies in the requests sent
        // to the API (e.g. in case you use sessions)
        //res.setHeader('Access-Control-Allow-Credentials', true);

        // Pass to next layer of middleware
        next();
    });

    app.get('/about', function (req, res) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write("Version "+conf.APP_VERSION+". No Data Requested, so none is returned");
        res.write("Supported URLs:");
        res.write("/public , /public/index.html ");
        res.write("incoming headers" + JSON.stringify(req.headers));
        res.end();
    });
}

if (args.QUERY_SERVER) {
    app.use(function (req, res, next) {

        // Website you wish to allow to connect
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

        // Set to true if you need the website to include cookies in the requests sent
        // to the API (e.g. in case you use sessions)
        //res.setHeader('Access-Control-Allow-Credentials', true);

        // Pass to next layer of middleware
        next();
    });
}


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
    return new sseMW.ConnectionWrapper(sseConnection,clientConf);
}


//send message to set of clients
updateSseClients = function(message, msgTopic, clients) {
    this.m=message;
    this.t=msgTopic;
    clients.forEach(
        function(connWrapper) {
                connWrapper.send(this.m, this.t);
        }
        , this // this second argument to forEach is the thisArg
        // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
    ); //forEach
}; // updateSseClients

// initial registration of SSE Client Connection for messages
if (args.MESSAGE_SERVER) {
    app.get('/jobStatus/updates', function(req,res){
        var newConn = createConn(req, res);
        sseClients.add(newConn);
    } );

    function handleMessage(msg) {
        //TODO Should be able to get message format from the head of the msg, rather than hardcoded JSON
        var outMsg = sharedLib.formatMessage(msg.value, msg.topic, 'JSON', conf);
        //console.log("New output: "+JSON.stringify(outMsg));
        updateSseClients(outMsg, msg.topic, sseClients);
    }// handleMessage
}

// initial registration of SSE Client Connection for queries
if (args.QUERY_SERVER) {
    app.get('/jobStatus/init', function (req, res) {
        var conn = createConn(req, res);
        sseQueryClients.add(conn);
        sqlLib.runClientQueries(conn, conf.kafkaTopics);
    });
}

// TODO should check for a new version of the config periodically so doesn't need restarting

// send a heartbeat signal to all SSE clients, once every interval seconds (or every 3 seconds
// if no interval is specified)
initHeartbeat = function(interval) {
    setInterval(function()  {
            var msg = {"label":"HEARTBEAT", "time":new Date()};
            if (args.MESSAGE_SERVER) {
                updateSseClients(msg, "__HEARTBEAT", sseClients);
            }
            if (args.QUERY_SERVER) {
                updateSseClients(msg, "__HEARTBEAT", sseQueryClients);
            }
        }//interval function
        , interval?interval*1000:3000
    ); // setInterval
}; //initHeartbeat

// initialize heartbeat at x second interval
initHeartbeat(5);

