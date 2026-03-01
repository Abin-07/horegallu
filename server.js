const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server);

let waitingUser = null;
let onlineUsers = 0;

io.on("connection", (socket) => {
  onlineUsers++;
  io.emit("user-count", onlineUsers);

  if (waitingUser) {
    socket.partner = waitingUser;
    waitingUser.partner = socket;

    socket.emit("matched");
    waitingUser.emit("matched");

    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit("waiting");
  }

  socket.on("message", (msg) => {
    if (socket.partner) socket.partner.emit("message", msg);
  });

  socket.on("typing", () => {
    if (socket.partner) socket.partner.emit("typing");
  });

  socket.on("next", () => {
    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }
    socket.partner = null;

    if (!waitingUser) {
      waitingUser = socket;
      socket.emit("waiting");
    }
  });

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("user-count", onlineUsers);

    if (socket.partner) {
      socket.partner.emit("partner-left");
      socket.partner.partner = null;
    }
    if (waitingUser === socket) waitingUser = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Horegallu running on port", PORT);
});