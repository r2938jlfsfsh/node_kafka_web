var express = require('express')
    , http = require('http')
    , sseMW = require('./sse')
    , conf = require('./config');

var kafka = require('kafka-node');
var Consumer = kafka.Consumer;
//TODO add authentication
var client = new kafka.Client(conf.ZOOKEEPER_CONN);

var app = express();
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

// TODO Make this generic, not just jobStatus - should have one for each supported topic\
// TODO Or it should be one but take a list of topics to follow
// initial registration of SSE Client Connection
app.get('/jobStatus/updates', function(req,res){
    var sseConnection = res.sseConnection;
    sseConnection.setup();
    sseClients.add(sseConnection);
} );

var m;
//send message to all registered SSE clients
updateSseClients = function(message) {
    this.m=message;
    sseClients.forEach(
        function(sseConnection) {
            sseConnection.send(this.m);
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

consumer.addTopics([
    { topic: conf.kafkaTopic, partition: 0, offset: 0}
], () => console.log("Topic added: " + conf.kafkaTopic));

function handleMessage(msg) {
    //var top3 = JSON.parse(msg.value);
    //top3.continent = new Buffer(msg.key).toString('ascii');
    //updateSseClients( top3);
    //console.log("Full msg: "+JSON.stringify(msg));
    var outMsg = {topic: msg.topic, value: msg.value};
    //console.log("Output msg: "+JSON.stringify(outMsg));
    updateSseClients(outMsg);
}// handleMessage