var express = require('express')
    , http = require('http')
    , sseMW = require('./sse');

var kafka = require('kafka-node');
var Consumer = kafka.Consumer;
var client = new kafka.Client("localhost:29092/");
var countriesTopic = "node_test";

var app = express();
var server = http.createServer(app);

var PORT = process.env.PORT || 3000;
var APP_VERSION = '0.9';

server.listen(PORT, function () {
    console.log('Server running, version '+APP_VERSION+', Express is listening... at '+PORT+" ");
});

// Realtime updates
var sseClients = new sseMW.Topic();

app.use(express.static(__dirname + '/public'));
app.get('/about', function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write("Version "+APP_VERSION+". No Data Requested, so none is returned");
    res.write("Supported URLs:");
    res.write("/public , /public/index.html ");
    res.write("incoming headers" + JSON.stringify(req.headers));
    res.end();
});

//configure sseMW.sseMiddleware as function to get a stab at incoming requests, in this case by adding a
// Connection property to the request
app.use(sseMW.sseMiddleware)

// initial registration of SSE Client Connection
app.get('/topn/updates', function(req,res){
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
            updateSseClients(msg);// JSON.stringify(msg));
        }//interval function
        , interval?interval*1000:3000
    ); // setInterval
}//initHeartbeat

// initialize heartbeat at 10 second interval
initHeartbeat(4);


// Configure Kafka Consumer for Kafka Top3 Topic and handle Kafka message (by calling updateSseClients)
var consumer = new Consumer(
    client,
    [],
    {fromOffset: true}
);

consumer.on('message', function (message) {
    console.log("got message");
    handleCountryMessage(message);
});

consumer.addTopics([
    { topic: countriesTopic, partition: 0, offset: 0}
]); //, () => console.log("topic added"));

function handleCountryMessage(countryMessage) {
    var top3 = JSON.parse(countryMessage.value);
    top3.continent = new Buffer(countryMessage.key).toString('ascii');
    updateSseClients( top3);
}// handleCountryMessage