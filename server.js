/*
*	Author: Fabrizio Codello
*	Description: Experimenting with Node.js + Socket.io: chat lobby	
*	See the README.md for usage and license
*
* TODO:
*		add timestamps
*		max length on username (and message?)
*		sendUserlist socket/client on lurker join/quit
*		disable action comm for usernames (lurker can do /who?)
*
*		do canvas experiments
*		remove action messages from history?
*		desktop/page title notification on new message
*		sound on join/quit?
*		/help with all action commands
*		understand if you're lurking from UI
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

server.listen(8080);	//8765

var socket = io.listen(server),
	total = 0
	total_active = 0,
	conn = {},
	history = [],
	history_length = 5,
	last_id = 0,
	y = 0;

socket.on('connection', function(client) {
	var username,
		user_id,
		x = 0;
	
	console.log('* Lurker connected');
	total++;
	
	sendUserlist(socket, conn);

	client.on('message', function(data) {	
		if (!username) {	//from lurker2active
			last_id++;
			y += 10;
			
			if (data.indexOf(' ') >= 0) {
				client.send(JSON.stringify({ msg: 'Your username cannot contain spaces. Choose another one.', msg_type: 'info' }));
				return;
			}
			if (isDouble(conn, last_id, data)) {
				client.send(JSON.stringify({ msg: 'That username is already being used. Choose another one.', msg_type: 'info' }));
				last_id--;	//fix isDouble
				return;
			}
			
			username = data;
			user_id = last_id;
			conn[user_id] = { "username": username };
			total_active++;
			
			console.log('- "'+ username +'" is now partecipating');				
			socket.broadcast(JSON.stringify({ username: username, msg_type: 'userjoin' }));
			
			sendUserlist(socket, conn);
			
			if (history.length > 0) {
				history.forEach(function(h) {
					client.send(JSON.stringify({ username: h.username, msg: h.msg, msg_type: 'history'}));
				});
			}
			return;
		}				//end lurker2active
		
		x+= 5;
		
		if ((history.length < history_length))
			history.push({ username: username, msg: data });
		else {
			history.splice(0, 1);
			history.push({ username: username, msg: data });
		}
				
		console.log(JSON.stringify({ id: user_id, username: username, msg: data, x: x, y: y}));
		
		var action = data.split(" ");	
		switch (action[0]) {
			case '/who':
					if (total == 1)
						client.send(JSON.stringify({ msg: 'You are forever alone.', msg_type: 'info' }));
					else
						client.send(JSON.stringify({ msg: 'There are '+ total +' users connected: '+ total_active +' active, '+ (total-total_active) +' lurker'+ (total-total_active == 1?'':'s') +'.', msg_type: 'info' }));
						
					console.log(JSON.stringify(conn));
				break;
			case '/nick':
					if ((typeof action[1] != "undefined") && (action[1] != '')) {
						if (!isDouble(conn, user_id, action[1])) {
							var old_username = username;
							username = action[1];
							
							for (var c in conn) {
								if (conn[c].username == old_username) {	//doublecheck with id?
									conn[c].username = username;
									break;
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
			delete conn[user_id];
			total_active--;
			
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
	
	userlist.sort();
	
	console.log("Userlist: "+ userlist);
	socket.broadcast(JSON.stringify({ users: userlist, msg_type: 'userlist' }));
}
