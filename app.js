var express = require('express')
    , http = require('http')
    , sseMW = require('./sse')
    , conf = require('./config')
    , bodyParser = require('body-parser');

var kafka = require('kafka-node');
var Consumer = kafka.Consumer;
//TODO add authentication
var client = new kafka.Client(conf.ZOOKEEPER_CONN);

var app = express();
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var server = http.createServer(app);

server.listen(conf.LISTEN_PORT, function () {
    console.log('Server running, version '+conf.APP_VERSION+', Express is listening... at '+ conf.LISTEN_PORT);
});

// Realtime updates
var sseClients = new sseMW.Topic();

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

// initial registration of SSE Client Connection
app.get('/jobStatus/updates', function(req,res){
    var topics = req.query.topicString;
    var clientConf = {topics: []};

    for (var i = 0; i < conf.kafkaTopics.length; i++) {
        if (topics == null){
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
    sseClients.add(sseConnection, clientConf);
    //TODO add initialisation from query
} );

var m;

//send message to all registered SSE clients
updateSseClients = function(message, msgTopic) {
    this.m=message;
    this.t=msgTopic;
    sseClients.forEach(
        function(sseConnection, arrayInd) {
            if (this.t == null || sseClients.topicInConnConfig(arrayInd, this.t)) {
                console.log("Sending message from client " + this.t + " to client " + arrayInd);
                sseConnection.send(this.m);
            } else {
                console.log("Skipping sending message from topic " + this.t + " to client " + arrayInd);
            }
        }
        , this // this second argument to forEach is the thisArg
        // (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach)
    ); //forEach
}// updateSseClients

// send a heartbeat signal to all SSE clients, once every interval seconds (or every 3 seconds
// if no interval is specified)
initHeartbeat = function(interval) {
    setInterval(function()  {
            var msg = {"label":"The latest", "time":new Date()};
            updateSseClients(msg);
        }//interval function
        , interval?interval*1000:3000
    ); // setInterval
}//initHeartbeat

// initialize heartbeat at x second interval
initHeartbeat(30);

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

function handleMessage(msg) {
    //TODO be able to handle delimited messages - translate to JSON based on pre-defined schema
    //TODO be able to handle avro messages - translate to JSON
    //var top3 = JSON.parse(msg.value);
    //top3.continent = new Buffer(msg.key).toString('ascii');
    //updateSseClients( top3);
    //console.log("Full msg: "+JSON.stringify(msg));

    var outMsg = {topic: msg.topic, value: msg.value};
    //console.log("Output msg: "+JSON.stringify(outMsg));
    updateSseClients(outMsg, msg.topic);
}// handleMessage