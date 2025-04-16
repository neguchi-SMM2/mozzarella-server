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
    } catch (err) {
      console.error("JSON parsing error:", err);
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
            currentIndex: 0,
            previousMaxVolume: 0,
          };
        }

        rooms[currentRoom].clients.push(ws);
        ws.roomId = currentRoom;

        // プレイヤー名の保存
        if (data.username) {
          rooms[currentRoom].playerList.push(data.username);
        }

        // 接続確認・ホスト判定
        ws.send(JSON.stringify({
          type: "initPeer",
          initiator: rooms[currentRoom].clients[0] === ws,
        }));

        // プレイヤーリスト共有
        broadcast(currentRoom, {
          type: "playerList",
          players: rooms[currentRoom].playerList,
          hostId: rooms[currentRoom].hostId,
        });
        break;

      case "signal":
        broadcast(data.roomId, {
          type: "signal",
          signal: data.signal,
        }, ws); // except sender
        break;

      case "startGame":
        broadcast(currentRoom, { type: "startGame" });
        break;

      case "turnData":
        // 音量とターン番号の共有
        rooms[currentRoom].currentIndex = data.currentIndex;
        rooms[currentRoom].previousMaxVolume = data.previousMaxVolume;
        broadcast(currentRoom, {
          type: "turnData",
          currentIndex: data.currentIndex,
          previousMaxVolume: data.previousMaxVolume,
        });
        break;

      case "chat":
        broadcast(currentRoom, {
          type: "chat",
          message: data.message,
          username: data.username,
        });
        break;
    }
  });

  ws.on("close", () => {
    if (currentRoom && rooms[currentRoom]) {
      const index = rooms[currentRoom].clients.indexOf(ws);
      if (index !== -1) rooms[currentRoom].clients.splice(index, 1);
      if (rooms[currentRoom].clients.length === 0) {
        delete rooms[currentRoom];
      }
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
  console.log(`✅ Server listening on port ${PORT}`);
});
