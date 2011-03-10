/*
*	Author: Fabrizio Codello
*	Description: Node.js + Socket.io chat with some nice features
*	See the README.md for usage and license
*
* TODO:
*		sendUserlist socket/client on lurker join/quit
*		disable action comm for usernames (lurker can do /who?)
*		fix id on isDouble
*		X slots history on frontend input field
*
*		do canvas experiments
*		desktop/page title notification on new message
*		sound on join/quit/newmessage?
*		/help with all action commands
*		understand if you're lurking from UI
*		daily chatlogs?
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

server.listen(8765);	//8765

var socket = io.listen(server),
	total = 0
	total_active = 0,
	conn = {},
	history = [],
	history_max_length = 5,
	last_id = 0,
	data_max_length = 512,
	y = 0;

socket.on('connection', function(client) {
	var username,
		user_id,
		x = 0;
	
	console.log('* Lurker connected');
	total++;
	
	sendUserlist(socket, conn);

	client.on('message', function(data) {	
		if (!data)	//discard empty messages
			return;
		
		data = data.substring(0, data_max_length);
	
		if (!username) {	//lurker2active
		
			if (!checkUsername(client, conn, last_id+1, data))
				return;
			
			last_id++;
			username = data;
			user_id = last_id;
			conn[user_id] = { "username": username };
			total_active++;
			y += 10;
			
			console.log('- "'+ username +'" is now partecipating');				
			socket.broadcast(JSON.stringify({ username: username, msg_type: 'userjoin' }));
			
			sendUserlist(socket, conn);
			
			if (history.length > 0) {
				history.forEach(function(h) {
					client.send(JSON.stringify({ time: h.time, username: h.username, msg: h.msg, msg_type: 'history'}));
				});
			}
			return;
		}				//end lurker2active
		
		x+= 5;
						
		var time = new Date();
		console.log(JSON.stringify({ id: user_id, time: dateString(time), username: username, msg: data, x: x, y: y}));	//debug
		
		var action = data.split(" ");	
		switch (action[0]) {
			case '/who':
					if (total == 1)
						client.send(JSON.stringify({ msg: 'You are forever alone.', msg_type: 'info' }));
					else
						client.send(JSON.stringify({ msg: 'There are '+ total +' users connected: '+ total_active +' active, '+ (total-total_active) +' lurker'+ (total-total_active == 1?'':'s') +'.', msg_type: 'info' }));
						
					//debug
					console.log('* '+ total +' users connected: '+ total_active +' active, '+ (total-total_active) +' lurkers.');
					console.log('* '+ JSON.stringify(conn));
				break;
			case '/nick':
					if ((typeof action[1] != "undefined") && (action[1] != '')) {
						if (checkUsername(client, conn, user_id, action[1])) {
							var old_username = username;
							username = action[1];							
							conn[user_id].username = username;
						
							console.log("- "+ old_username +" is now known as "+ username+ ".");
							socket.broadcast(JSON.stringify({ msg: '"'+ old_username +'" is now known as "'+ username +'".', msg_type: 'event' }));
							sendUserlist(socket, conn);
						} else
							return;
					} else 
						return;
				break;
				case '/time':
					var time = new Date();
					
					client.send(JSON.stringify({ msg: 'Server time: '+ time +'.', msg_type: 'info' }));
				break;
				
			default:
				var time = new Date();
				
				if (history.length = history_max_length)
					history.splice(0, 1);
				history.push({ time: dateString(time), username: username, msg: data });
				
				socket.broadcast(JSON.stringify({ time: dateString(time), username: username, msg: data, x: x, y: y, msg_type: 'message'}));
			break;
		}
	});

	client.on('disconnect', function() {
		if (username) {				
			delete conn[user_id];
			total_active--;
			
			socket.broadcast(JSON.stringify({ username: username, msg_type: 'userquit' }));
			console.log('* "'+ username +'" disconnected');
			
			sendUserlist(socket, conn);
		} else
			console.log('* Lurker disconnected');
		
		total--;
	});
});

//Check if username is already being used
function isDouble(conn, user_id, username) {	//fix id not required on lurker2active
	for (var c in conn) {
		if ((conn[c].username == username) && (c != user_id)) {
			return true;
		}
	}
	return false;
}

//Send the whole userlist, sorted alphabetically
function sendUserlist(socket, conn) {
	var userlist = [];
	for (var c in conn) {
		userlist.push(conn[c].username);
	}
	userlist.sort();
	
	socket.broadcast(JSON.stringify({ users: userlist, msg_type: 'userlist' }));
}

//Check that 3 <= username <= 16, has no spaces, is not already being used
function checkUsername(client, conn, user_id, data) {
	if ((data.length < 3) || (data.length > 16)) {
		client.send(JSON.stringify({ msg: 'Your username length must be minimum 3 and maximum 16 chars. Choose another one.', msg_type: 'info' }));
		return false;
	}			
	if (data.indexOf(' ') >= 0) {
		client.send(JSON.stringify({ msg: 'Your username cannot contain spaces. Choose another one.', msg_type: 'info' }));
		return false;
	}
	if (total_active > 0) {
	console.log(total+ ":" +total_active);
		if (isDouble(conn, user_id, data)) {
			client.send(JSON.stringify({ msg: 'That username is already being used. Choose another one.', msg_type: 'info' }));
			return false;
		}
	}
	
	return true;
}

//Return the current time in hh:mm:ss format
function dateString(d) {
    function pad(n) {
        return (n<10? '0'+n : n);
    }
    
    return pad(d.getHours())+':'+ pad(d.getMinutes())+':'+ pad(d.getSeconds());
}
