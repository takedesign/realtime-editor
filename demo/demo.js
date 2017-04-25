// Modules
var express = require('express');
	app = express(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	realtimeEditor = require('realtime-editor');	

// App routing
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');

	app.use("/node_modules", express.static(__dirname + "/node_modules"));
	app.use("/css", express.static(__dirname + "/css"));
	app.use("/js", express.static(__dirname + "/js"));
});

// realtimeEditor hook for saving content
// the data object have several properties including a custom property object which can hold your app specific IDs
realtimeEditor.onSave(function (data) {
	console.log('realtimeEditor.onSave: ', data);
});


http.listen(2000, function () {
	console.log('listening on *:2000');
});