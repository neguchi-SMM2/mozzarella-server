const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on("connection", (ws) => {
  ws.id = uuidv4();
  let currentRoom = null;

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }

    switch (data.type) {
      case "join":
        currentRoom = data.roomId;
        if (!rooms[currentRoom]) {
          rooms[currentRoom] = {
            clients: [],
            hostId: ws.id,
            playerList: [],
          };
        }

        rooms[currentRoom].clients.push(ws);
        ws.roomId = currentRoom;
        if (data.username) {
          rooms[currentRoom].playerList.push(data.username);
        }

        ws.send(JSON.stringify({
          type: "initPeer",
          initiator: rooms[currentRoom].clients[0] === ws
        }));

        broadcast(currentRoom, {
          type: "playerList",
          players: rooms[currentRoom].playerList,
        });
        break;

      case "signal":
        broadcast(data.roomId, {
          type: "signal",
          signal: data.signal,
        }, ws);
        break;

      case "startGame":
        broadcast(currentRoom, { type: "startGame" });
        break;

      case "turnData":
        broadcast(currentRoom, {
          type: "turnData",
          currentIndex: data.currentIndex,
          previousMaxVolume: data.previousMaxVolume
        });
        break;

      case "chat":
        broadcast(currentRoom, {
          type: "chat",
          message: data.message,
          username: data.username
        });
        break;
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].clients = rooms[currentRoom].clients.filter(c => c !== ws);
      if (rooms[currentRoom].clients.length === 0) delete rooms[currentRoom];
    }
  });
});

function broadcast(roomId, message, exclude = null) {
  if (!rooms[roomId]) return;
  rooms[roomId].clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== exclude) {
      client.send(JSON.stringify(message));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});
