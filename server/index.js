// server/index.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Room } = require("./gameState");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "client")));

const rooms = {};

const NIGHT_DURATION_MS = 45 * 1000;
const DAY_DURATION_MS = 90 * 1000;
const VOTING_DURATION_MS = 30 * 1000;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms[code]);
  return code;
}

function publicPlayerList(room) {
  return room.playerList().map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
  }));
}

function broadcastPlayerList(room) {
  io.to(room.code).emit("player_list", publicPlayerList(room));
}

function sendSystemMessage(room, text) {
  const msg = { author: "Sistema", text, ts: Date.now() };
  room.chatLog.push(msg);
  io.to(room.code).emit("chat_message", msg);
}

function startNightPhase(room) {
  room.phase = "night";
  room.dayNumber += 1;
  room.resetNightState();

  io.to(room.code).emit("phase_change", {
    phase: "night",
    dayNumber: room.dayNumber,
    durationMs: NIGHT_DURATION_MS,
  });
  sendSystemMessage(room, `Cae la noche ${room.dayNumber}. Los roles con accion nocturna deben actuar.`);

  room.alivePlayers().forEach((player) => {
    if (player.role && player.role.hasNightAction) {
      io.to(player.socketId).emit("night_action_request", {
        role: player.role.id,
        roleName: player.role.name,
        targets: room.alivePlayers()
          .filter((p) => p.id !== player.id || player.role.id === "doctor")
          .map((p) => ({ id: p.id, name: p.name })),
      });
    }
  });

  clearTimeout(room.phaseTimer);
  room.phaseTimer = setTimeout(() => resolveNight(room), NIGHT_DURATION_MS);
}

function resolveNight(room) {
  const { wolfVotes, protectedPlayerId } = room.nightState;

  const voteCounts = {};
  Object.values(wolfVotes).forEach((targetId) => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  let victimId = null;
  const entries = Object.entries(voteCounts);
  if (entries.length > 0) {
    const maxVotes = Math.max(...entries.map(([, c]) => c));
    const topTargets = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);
    victimId = topTargets[Math.floor(Math.random() * topTargets.length)];
  }

  const deaths = [];
  if (victimId && victimId !== protectedPlayerId && room.players[victimId] && room.players[victimId].alive) {
    room.players[victimId].alive = false;
    deaths.push(room.players[victimId]);
  }

  Object.entries(room.nightState.seerResults || {}).forEach(([seerId, result]) => {
    io.to(seerId).emit("night_action_result", result);
  });

  startDayPhase(room, deaths);
}

function startDayPhase(room, deaths) {
  room.phase = "day";
  io.to(room.code).emit("phase_change", {
    phase: "day",
    dayNumber: room.dayNumber,
    durationMs: DAY_DURATION_MS,
  });

  if (deaths.length === 0) {
    sendSystemMessage(room, "Amanece. Nadie murio esta noche. El pueblo puede debatir.");
  } else {
    deaths.forEach((p) => {
      sendSystemMessage(room, `Amanece. ${p.name} fue encontrado muerto. Su rol era: ${p.role.name}.`);
    });
  }

  broadcastPlayerList(room);

  const winner = room.checkWinCondition();
  if (winner) return endGame(room, winner);

  clearTimeout(room.phaseTimer);
  room.phaseTimer = setTimeout(() => startVotingPhase(room), DAY_DURATION_MS);
}

function startVotingPhase(room) {
  room.phase = "voting";
  room.resetVotes();
  io.to(room.code).emit("phase_change", {
    phase: "voting",
    dayNumber: room.dayNumber,
    durationMs: VOTING_DURATION_MS,
  });
  sendSystemMessage(room, "Comienza la votacion. Elige a quien crees que es un lobo.");

  clearTimeout(room.phaseTimer);
  room.phaseTimer = setTimeout(() => resolveVoting(room), VOTING_DURATION_MS);
}

function resolveVoting(room) {
  const voteCounts = {};
  Object.values(room.votes).forEach((targetId) => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  let lynchedId = null;
  const entries = Object.entries(voteCounts);
  if (entries.length > 0) {
    const maxVotes = Math.max(...entries.map(([, c]) => c));
    const topTargets = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);
    if (topTargets.length === 1) lynchedId = topTargets[0];
  }

  if (lynchedId && room.players[lynchedId]) {
    room.players[lynchedId].alive = false;
    sendSystemMessage(
      room,
      `El pueblo vota. ${room.players[lynchedId].name} es linchado. Su rol era: ${room.players[lynchedId].role.name}.`
    );
  } else {
    sendSystemMessage(room, "El pueblo no logra ponerse de acuerdo. Nadie es linchado.");
  }

  broadcastPlayerList(room);

  const winner = room.checkWinCondition();
  if (winner) return endGame(room, winner);

  startNightPhase(room);
}

function endGame(room, winner) {
  room.phase = "ended";
  clearTimeout(room.phaseTimer);
  io.to(room.code).emit("game_over", {
    winner,
    roles: room.playerList().map((p) => ({ name: p.name, role: p.role.name, team: p.role.team })),
  });
  sendSystemMessage(room, winner === "good" ? "El pueblo gana la partida." : "Los lobos ganan la partida.");
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ playerName }, callback) => {
    const code = generateRoomCode();
    const room = new Room(code, socket.id);
    room.addPlayer(socket.id, playerName || "Jugador");
    rooms[code] = room;
    socket.join(code);
    callback({ ok: true, code });
    broadcastPlayerList(room);
  });

  socket.on("join_room", ({ code, playerName }, callback) => {
    const room = rooms[(code || "").toUpperCase()];
    if (!room) return callback({ ok: false, error: "La sala no existe." });
    if (room.phase !== "lobby") return callback({ ok: false, error: "La partida ya comenzo." });

    room.addPlayer(socket.id, playerName || "Jugador");
    socket.join(room.code);
    callback({ ok: true, code: room.code });
    broadcastPlayerList(room);
    sendSystemMessage(room, `${playerName || "Un jugador"} se unio a la sala.`);
  });

  socket.on("start_game", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.hostSocketId) return;
    if (room.playerList().length < 4) return;

    room.assignRoles();
    room.playerList().forEach((p) => {
      io.to(p.socketId).emit("role_assigned", { role: p.role.id, roleName: p.role.name, team: p.role.team, description: p.role.description });
    });

    sendSystemMessage(room, "La partida ha comenzado. Revisa tu rol en privado.");
    startNightPhase(room);
  });

  socket.on("night_action", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.phase !== "night") return;
    const player = room.players[socket.id];
    if (!player || !player.alive || !player.role.hasNightAction) return;

    const result = player.role.resolveNightAction(room, socket.id, targetId);

    if (player.role.id === "seer" && result) {
      room.nightState.seerResults[socket.id] = result;
    }
  });

  socket.on("day_vote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.phase !== "voting") return;
    const player = room.players[socket.id];
    if (!player || !player.alive) return;

    room.votes[socket.id] = targetId;
    io.to(room.code).emit("vote_update", { voterId: socket.id, targetId });
  });

  socket.on("chat_message", ({ code, text }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;

    const msg = { author: player.name, text, ts: Date.now() };
    room.chatLog.push(msg);
    io.to(room.code).emit("chat_message", msg);
  });

  socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      if (room.players[socket.id]) {
        const name = room.players[socket.id].name;
        room.removePlayer(socket.id);
        broadcastPlayerList(room);
        sendSystemMessage(room, `${name} se desconecto.`);
        if (room.playerList().length === 0) {
          clearTimeout(room.phaseTimer);
          delete rooms[code];
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor de Hombre Lobo escuchando en puerto ${PORT}`);
});
