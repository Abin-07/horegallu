const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static(__dirname));

const reports = {}; // { ip: { count, bannedUntil } }

const server = http.createServer(app);
const io = new Server(server);

let waitingUser = null;
let onlineUsers = 0;

io.on("connection", (socket) => {
  const ip =
    socket.handshake.headers["x-forwarded-for"] ||
    socket.conn.remoteAddress;

  // 🔒 BAN CHECK
  if (reports[ip] && reports[ip].bannedUntil > Date.now()) {
    socket.emit("banned", {
      until: new Date(reports[ip].bannedUntil).toLocaleString()
    });
    socket.disconnect();
    return;
  }

  // 👥 ONLINE COUNT
  onlineUsers++;
  io.emit("user-count", onlineUsers);

  // 🔗 MATCH USERS
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

  // 💬 MESSAGE
  socket.on("message", (msg) => {
    if (socket.partner) socket.partner.emit("message", msg);
  });

  // ✍️ TYPING
  socket.on("typing", () => {
    if (socket.partner) socket.partner.emit("typing");
  });

  // 🚨 REPORT USER (✅ STEP 3 — ADDED HERE)
  socket.on("report", () => {
    if (!reports[ip]) {
      reports[ip] = { count: 1, bannedUntil: null };
    } else {
      reports[ip].count++;
    }

    console.log(`Report from ${ip}: ${reports[ip].count}`);

    if (reports[ip].count >= 5) {
      reports[ip].bannedUntil =
        Date.now() + 5 * 24 * 60 * 60 * 1000; // 5 days

      socket.emit("banned", {
        until: new Date(reports[ip].bannedUntil).toLocaleString()
      });
      socket.disconnect();
    }
  });

  // ⏭ NEXT STRANGER
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

  // ❌ DISCONNECT
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