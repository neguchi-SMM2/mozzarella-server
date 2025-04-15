const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const { v4: uuid } = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on("connection", ws => {
  let currentRoom = null;
  let username = null;

  ws.on("message", message => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    switch (data.type) {
      case "join":
        currentRoom = data.roomId;
        username = data.username;
        if (!rooms[currentRoom]) {
          rooms[currentRoom] = { clients: [], host: ws };
        }
        rooms[currentRoom].clients.push({ ws, username });
        // 通知：ホストは最初の参加者
        if (rooms[currentRoom].clients.length === 1) {
          ws.send(JSON.stringify({ type: "hostConfirm", username }));
        }
        broadcast(currentRoom, {
          type: "playerJoined",
          username,
        });
        break;

      case "startGame":
        broadcast(currentRoom, {
          type: "startGame"
        });
        break;

      case "signal":
        // WebRTC signaling
        broadcast(currentRoom, {
          type: "signal",
          from: username,
          signal: data.signal
        });
        break;
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom].clients = rooms[currentRoom].clients.filter(c => c.ws !== ws);
      broadcast(currentRoom, {
        type: "playerLeft",
        username,
      });
      if (rooms[currentRoom].clients.length === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

function broadcast(roomId, msg) {
  if (!rooms[roomId]) return;
  rooms[roomId].clients.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバーがポート${PORT}で起動しました`);
});
