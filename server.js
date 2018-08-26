var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var path = require('path');
var bodyParser = require('body-parser');


//socket
io.on('connection', function(socket) {
  console.log("User connected");

  socket.on('newgame', function(name) {
    var name = name;
    var gameid = "";
    var position = "";
    var response = {
      'gameid': gameid,
      'player': position,
    };
    if (openGames.length > 0) {
      position = "player2";
      gameid = openGames[openGames.length - 1];
      games[gameid].player2.name = name;
      openGames.splice(openGames.length - 1, 1);
      response.gameid = gameid;
      response.player = position;
      socket.join(gameid);
      socket.emit('data', response);
      var names = {
        player1: games[gameid].player1.name,
        player2: games[gameid].player2.name,
      }
      io.in(gameid).emit('start', names);



    } else if (openGames.length == 0) {
      gameid = createGame(name);
      openGames.push(gameid);
      position = "player1";
      response.gameid = gameid;
      response.player = position;
      socket.join(gameid);
      socket.emit('data', response);
      io.in(gameid).emit('status', "Waiting for Opponent");
    }

  });

  socket.on('setship', function(msg) {
    var player = msg.player;
    var gameid = msg.gameid;
    var coord = msg.coord;
    var size = msg.size;
    var direction = msg.direction;
    var gameboard = setShip(player, gameid, coord, size, direction);
    var enemyplayer = getEnemy(player);
    if (isready(player, gameid) == true && isready(enemyplayer, gameid) == false) {
      socket.emit('status', "Waiting for Opponent to set his ships");
    }
    if (isready(player, gameid) == true && isready(enemyplayer, gameid) == true) {
      io.in(gameid).emit('setactive', games[gameid].activeplayer);
    }
    if (gameboard == "error") {
      socket.emit('error', gameboard);
    } else {
      socket.emit('draw', gameboard);
    }
  });

  socket.on('shoot', function(msg) {
    var player = msg.player;
    var gameid = msg.gameid;
    var coord = msg.coord;
    var feedback = shoot(player, gameid, coord);
    console.log("Feedback: " + feedback);
    var msg = {
      feedback: feedback,
      coord: coord,
      player: player
    }
    io.in(gameid).emit('feedback', msg);
    if (feedback != "won") {
      io.in(gameid).emit('setactive', games[gameid].activeplayer);
    }
  })

});


app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

var openGames = new Array();
var games = {};

//
//Game logic
//

function createGame(name) {
  var gameid = Math.floor((Math.random() * 100000) + 1);
  var player1 = {
    name: name,
    board: "",
    player: 'player1',
    remainingships: 0,
  };
  var player2 = {
    name: "",
    board: "",
    player: 'player2',
    remainingships: 0,
  };
  var board1 = new Array(10);
  var board2 = new Array(10);
  board1 = drawBoard(board1);
  board2 = drawBoard(board2);
  player1.board = board1;
  player2.board = board2;
  var game = {
    player1: player1,
    player2: player2,
    activeplayer: "player1"
  }

  games[gameid] = game;
  return gameid;
}

function setShip(player, gameid, coord, size, direction) {
  var enemyplayer = getEnemy(player);
  games[gameid][player].remainingships += size;
  if (games[gameid][player].remainingships > 30) {
    console.log("to many ships");
    return "error"
  }
  var x = coord[1];
  var y = coord[2];
  var length1 = parseInt(x) + parseInt(size);
  var length2 = parseInt(y) + parseInt(size);
  if (direction == "vertical") {
    for (i = x; i < parseInt(length1); i++) {
      games[gameid][player].board[i][y] = "X";
    }
  } else if (direction == "horizontal") {
    for (j = y; j < parseInt(length2); j++) {
      games[gameid][player].board[x][j] = "X";
    }
  }
  //  console.log(gameboard);
  return games[gameid][player].board;
}

function shoot(player, gameid, coord) {
  var x = parseInt(coord[1]);
  var y = parseInt(coord[2]);
  var left = x - 1;
  var right = x + 1;
  var bottom = y - 1;
  var top = y + 1;
  var enemyplayer = getEnemy(player);
  games[gameid].activeplayer = enemyplayer;

  if (games[gameid][enemyplayer].board[x][y] == "X") {
    games[gameid][enemyplayer].board[x][y] = "H";
    games[gameid][enemyplayer].remainingships--;
    if (games[gameid][enemyplayer].remainingships == 0) {
      return "won";
    } else {
      var found = false;
      var end = false;
      while (left >= 0 && left < 10 && !end && !found) {
        if (games[gameid][enemyplayer].board[left][y] == "O") {
          end = true;
        }
        if (games[gameid][enemyplayer].board[left][y] == "X") {
          found = true;
        }
        left--
      }
      end = false;
      while (right >= 0 && right < 10 && !end && !found) {
        if (games[gameid][enemyplayer].board[right][y] == "O") {
          end = true;
        }
        if (games[gameid][enemyplayer].board[right][y] == "X") {
          found = true;
        }
        right++;
      }
      end = false;
      while (top >= 0 && top < 10 && !end && !found) {
        if (games[gameid][enemyplayer].board[x][top] == "O") {
          end = true;
        }
        if (games[gameid][enemyplayer].board[x][top] == "X") {
          found = true;
        }
        top--;
      }
      end = false;
      while (bottom >= 0 && bottom < 10 && !end && !found) {
        if (games[gameid][enemyplayer].board[x][bottom] == "O") {
          end = true;
        }
        if (games[gameid][enemyplayer].board[x][bottom] == "X") {
          found = true;
        }
        bottom++;
      }
      if (!found) {
        return "sink";
      }
    }
    return "hit";
  } else if (games[gameid][enemyplayer].board[x][y] == "O") {
    return "miss";
  }
}

function isready(player, gameid) {
  if (games[gameid][player].remainingships == 30) {
    return true;
  } else {
    return false;
  }
}

function getEnemy(player) {
  if (player == "player1") {
    return "player2"
  } else if (player == "player2") {
    return "player1";
  }
}

function drawBoard(board) {
  for (i = 0; i < board.length; i++) {
    board[i] = new Array(10);
    for (j = 0; j < 10; j++) {
      board[i][j] = "O";
    }
  }
  return board;
}




server.listen(3000, function() {
  console.log("Listening on: 3000");
});
