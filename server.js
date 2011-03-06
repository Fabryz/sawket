/*
*	Author: Fabrizio Codello
*	Description: Experimenting with Socket.io, chat lobby	
*	See the README.md for usage and license
*
* TODO: do the canvas stuff
*		improve history messages
*		sort the userlist alphabetically
*		add timestamps
*		check that username has no spaces
*		desktop/page title notification on new message
*		broadcast userlist to lurkers/changenick/quit
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

server.listen(8756);	//8756

var socket = io.listen(server),
	total = 0,
	y = 0,
	conn = {},
	id = 0,
	history = [];

socket.on('connection', function(client) {
	var username,
		x = 0;
	
	console.log('* Lurker connected');
	total++;
	
	sendUserlist(socket, conn);

	client.on('message', function(data) {	
		if (!username) {
			id++;
			y += 10;
			
			if (isDouble(conn, id, data)) {
				client.send(JSON.stringify({ msg: 'That username is already being used. Choose another one.', msg_type: 'info' }));
				return;
			}
			
			username = data;
			conn[id] = { "username": username };
			
			console.log('- "'+ username +'" is now partecipating');				
			socket.broadcast(JSON.stringify({ username: username, msg_type: 'userjoin' }));
			
			sendUserlist(socket, conn);
			
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
		
		var action = data.split(" ");	
		switch (action[0]) {
			case '/who':
					if (total == 1)
						client.send(JSON.stringify({ msg: 'You are forever alone.', msg_type: 'info' }));
					else
						client.send(JSON.stringify({ msg: 'There are '+ total +' users connected.', msg_type: 'info' }));
				break;
			case '/nick':
					if ((typeof action[1] != "undefined") && (action[1] != '')) {
						if (!isDouble(conn, id, action[1])) {
							var old_username = username;
							username = action[1];
							
							for (var c in conn) {
								if (conn[c].username == old_username) {
									conn[c].username = username;	//return?
								}
							}
						
							console.log("- "+ old_username +" is now known as "+ username+ ".");
							socket.broadcast(JSON.stringify({ msg: '"'+ old_username +'" is now known as "'+ username +'".', msg_type: 'event' }));
							sendUserlist(socket, conn);
						} else {
							client.send(JSON.stringify({ msg: 'That username is already being used. Choose another one.', msg_type: 'info' }));
							return;
						}
					} else 
						return;
				break;
				
			default:
				socket.broadcast(JSON.stringify({ username: username, msg: data, x: x, y: y, msg_type: 'message'}));
			break;
		}
	});

	client.on('disconnect', function() {
		if (username) {
			console.log("before "+ JSON.stringify(conn));
						
			delete conn[id];
			
			console.log("after "+ JSON.stringify(conn));
						
			socket.broadcast(JSON.stringify({ username: username, msg_type: 'userquit' }));
			console.log('* '+ username +' disconnected');
			
			sendUserlist(socket, conn);
		} else
			console.log('* Lurker disconnected');
		
		total--;
	});
});

function isDouble(conn, id, username) {	
	for (var c in conn) {
		if ((conn[c].username == username) && (c != id)) {
			return true;
		}
	}
	
	return false;
}

function sendUserlist(socket, conn) {
	var userlist = [];
	
	for (var c in conn) {
		userlist.push(conn[c].username);
	}
	console.log("userlist: "+ userlist +" length: "+ conn.length);
	socket.broadcast(JSON.stringify({ users: userlist, msg_type: 'userlist' }));
}
