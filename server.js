/*
* Author: Fabrizio Codello
* Description: Experimenting with Socket.io
*
* TODO: remove user on frontend list when he quits
*		broadcast the usernames
*		do the canvas stuff
*
*/

var http = require('http'),
    sys  = require('sys'),
    fs   = require('fs'),
    io   = require('socket.io'),
    url  = require('url');

var server = http.createServer(function(req, res) {
  var path = url.parse(req.url).pathname;  
  
  switch (path) {
    default:
    	console.log("* HTTP Connection.");
        res.writeHead(200, { 'Content-Type': 'text/html' });
        var rs = fs.createReadStream(__dirname + '/index.html');
        sys.pump(rs, res);
    break;
  }
  
});

server.listen(8080);

var socket = io.listen(server),
	total = 0,
	y = 0,
	conn = [],
	id = 0,
	history = [];

socket.on('connection', function(client) {
	var username,
		x = 0;
	
	console.log('* Lurker connected');
	total++;

	client.on('message', function(data) {	
		if (!username) {
			username = data;
			id++;
			y += 10;
			conn.push({ id: id,
						username: username,
						socket: socket,
						x: x, y: y });
			
			console.log('- '+ username +' is now partecipating');				
			socket.broadcast(JSON.stringify({ msg: '<strong>"'+ username +'" is now partecipating.</strong>', msg_type: 'info' }));
			socket.broadcast(JSON.stringify({ username: username, msg_type: 'userjoin' }));
			socket.broadcast(JSON.stringify({ msg: conn.toString(), msg_type: 'userlist' }));
			
		
			if (history.length > 0) {
				history.forEach(function(h) {
					client.send(JSON.stringify({ username: h.username, msg: h.msg, msg_type: 'history'}));
				});
			}
			return;
		}	
		
		x+= 5;
		
		if ((history.length < 5))
			history.push({ username: username, msg: data });
		else {
			history.splice(0, 1);
			history.push({ username: username, msg: data });
		}
				
		console.log(JSON.stringify({ username: username, msg: data, x: x, y: y}));	
			
		switch (data) {
			case '/who':
					if (total == 1)
						client.send(JSON.stringify({ msg: '* You are forever alone.', msg_type: 'info' }));
					else
						client.send(JSON.stringify({ msg: '* There are '+ total +' users connected.', msg_type: 'info' }));
				break;
			case '/qwe':
					client.send(JSON.stringify({ msg: '* There are '+ total +' users connected.', msg_type: 'info' }));
				break;
				
			default:
				socket.broadcast(JSON.stringify({ username: username, msg: data, x: x, y: y, msg_type: 'message'}));
			break;
		}
	});

	client.on('disconnect', function() {
		if (username) {
			var pos = conn.indexOf(socket);	//WIP
			if (pos>=0)
				conn.splice(pos, 1);
			
			socket.broadcast(JSON.stringify({ username: username, msg_type: 'userquit' }));
			console.log('* '+ username +' disconnected');
		} else
			console.log('* Lurker disconnected');
		total--;
	});
});
