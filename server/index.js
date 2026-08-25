// server/index.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Room } = require("./gameState");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 2e6 });

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "..", "client")));

const rooms = {};

const START_COUNTDOWN_MS = 20 * 1000;
const NIGHT_DURATION_MS = 45 * 1000;
const DAY_DURATION_MS = 90 * 1000;
const VOTING_DURATION_MS = 30 * 1000;
const MAX_PLAYERS = 20;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms[code]);
  return code;
}

function publicPlayerList(room) {
  return room.playerList().map((p) => ({ id: p.id, name: p.name, alive: p.alive, avatar: p.avatar, isBot: p.isBot }));
}

function broadcastPlayerList(room) {
  io.to(room.code).emit("player_list", publicPlayerList(room));
}

function sendSystemMessage(room, text) {
  const msg = { author: "Sistema", text, ts: Date.now() };
  room.chatLog.push(msg);
  io.to(room.code).emit("chat_message", msg);
}

function showPopup(room, text, type) {
  io.to(room.code).emit("show_popup", { text, type: type || "info" });
}

function sendWolfChatMessage(room, author, text) {
  const msg = { author, text, ts: Date.now() };
  room.wolvesAlive().forEach((w) => {
    if (w.socketId) io.to(w.socketId).emit("wolf_chat_message", msg);
  });
}

function broadcastWolfVoteTally(room) {
  const tally = {};
  Object.entries(room.nightState.wolfVotes || {}).forEach(([voterId, targetId]) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });
  room.wolvesAlive().forEach((w) => {
    if (w.socketId) io.to(w.socketId).emit("wolf_vote_tally", { tally });
  });
}

function getDayActionTargets(room, role) {
  let candidates = room.alivePlayers();

  if (role.id === "witch") {
    candidates = candidates.filter((p) => p.role.team === "good");
  } else if (role.id === "wolf_shaman") {
    candidates = candidates.filter((p) => p.role.team === "evil");
  }

  return candidates.map((p) => ({ id: p.id, name: p.name }));
}

function sendDayActionRequests(room) {
  room.alivePlayers().filter((p) => !p.isBot).forEach((player) => {
    const role = player.role;
    if (!role.hasDayActionOnce) return;
    if (room.usedOnceAbilities.has(player.id)) return;

    const targets = getDayActionTargets(room, role);
    io.to(player.socketId).emit("day_action_request", {
      role: role.id,
      roleName: role.name,
      targets,
    });
  });
}

function botChooseNightTarget(room, bot) {
  const role = bot.role;
  let candidates = room.alivePlayers().filter((p) => p.id !== bot.id || ["doctor", "druid"].includes(role.id));

  if (role.id === "necromancer") {
    candidates = Object.values(room.deadPlayers).filter((p) => p.role.team === "good");
  } else if (role.team === "evil" && (role.id === "werewolf" || role.id === "alpha_wolf")) {
    candidates = room.alivePlayers().filter((p) => {
      if (p.role.team !== "good") return false;
      if (p.role.id === "king" && room.isKingImmuneAtNight()) return false;
      return true;
    });
  }

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].id;
}

function runBotNightActions(room) {
  room.botsAlive().forEach((bot) => {
    const role = bot.role;
    const alreadyUsedOnce = role.hasNightActionOnce && room.usedOnceAbilities.has(bot.id);
    if ((role.hasNightAction || role.hasNightActionOnce) && !alreadyUsedOnce) {
      if (room.nightState.disabledPlayerIds.has(bot.id)) return;
      const targetId = botChooseNightTarget(room, bot);
      if (!targetId || !role.resolveNightAction) return;

      const result = role.resolveNightAction(room, bot.id, targetId);
      if (!result) return;
      if (role.hasNightActionOnce) room.usedOnceAbilities.add(bot.id);

      if (role.id === "seer") room.nightState.seerResults[bot.id] = result;
      if (role.id === "mystic") room.nightState.mysticResults[bot.id] = result;
      if (role.id === "bard") room.nightState.bardResults[bot.id] = result;
      if (role.id === "werewolf" || role.id === "alpha_wolf") broadcastWolfVoteTally(room);
    }
  });
}

function runBotDayActions(room) {
  room.botsAlive().forEach((bot) => {
    const role = bot.role;
    if (!role.hasDayActionOnce) return;
    if (room.usedOnceAbilities.has(bot.id)) return;

    const targets = getDayActionTargets(room, role).filter((t) => t.id !== bot.id);
    if (targets.length === 0) return;
    const targetId = targets[Math.floor(Math.random() * targets.length)].id;

    const result = role.resolveDayAction ? role.resolveDayAction(room, bot.id, targetId) : null;
    if (!result) return;
    room.usedOnceAbilities.add(bot.id);

    if (result.type === "witch_reveal") {
      sendSystemMessage(room, `La Witch revela que ${result.targetName} es ${result.roleName}.`);
      showPopup(room, `🧙 La Witch revela: ${result.targetName} es ${result.roleName}`, "info");
    }
    if (result.type === "wolf_shaman_protect") {
      sendSystemMessage(room, "El Wolf Shaman ha protegido a alguien del linchamiento de hoy.");
    }
  });
}

function runBotVotes(room) {
  room.botsAlive().forEach((bot) => {
    const candidates = room.alivePlayers().filter((p) => p.id !== bot.id);
    if (candidates.length === 0) return;
    const targetId = candidates[Math.floor(Math.random() * candidates.length)].id;
    registerVote(room, bot.id, targetId);
  });
}

function registerVote(room, voterId, targetId) {
  const voter = room.players[voterId];
  if (!voter) return;
  room.votes[voterId] = targetId;

  const target = room.players[targetId];
  if (target) {
    sendSystemMessage(room, `🗳️ ${voter.name} vota por ${target.name}.`);
  }

  broadcastVoteTally(room);
}

function broadcastVoteTally(room) {
  const tally = {};
  const detail = [];

  Object.entries(room.votes).forEach(([voterId, targetId]) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
    const voter = room.players[voterId];
    const target = room.players[targetId];
    if (voter && target) {
      detail.push({ voterId, voterName: voter.name, targetId, targetName: target.name });
    }
  });

  io.to(room.code).emit("vote_tally", { tally, detail });
}

function startInitialCountdown(room) {
  room.phase = "starting";
  io.to(room.code).emit("phase_change", { phase: "starting", dayNumber: 0, durationMs: START_COUNTDOWN_MS });
  sendSystemMessage(room, "La partida comienza en unos segundos. Revisa tu rol.");
  showPopup(room, "⏳ La partida comienza en 20 segundos...", "info");

  clearTimeout(room.phaseTimer);
  room.phaseTimer = setTimeout(() => {
    room.dayNumber = 1;
    startVotingPhase(room);
  }, START_COUNTDOWN_MS);
}

function startNightPhase(room) {
  room.phase = "night";
  room.dayNumber += 1;
  room.resetNightState();

  io.to(room.code).emit("phase_change", { phase: "night", dayNumber: room.dayNumber, durationMs: NIGHT_DURATION_MS });
  sendSystemMessage(room, `Cae la noche ${room.dayNumber}. Los roles con accion nocturna deben actuar.`);
  showPopup(room, `🌙 Cae la noche ${room.dayNumber}`, "night");

  const cursedBySiren = room.nightState.sirenCurseActive;
  const cursedByKing = room.nightState.kingCurseActive;
  const kingImmune = room.isKingImmuneAtNight();

  room.alivePlayers().filter((p) => !p.isBot).forEach((player) => {
    const role = player.role;
    const alreadyUsedOnce = role.hasNightActionOnce && room.usedOnceAbilities.has(player.id);

    if ((role.hasNightAction || role.hasNightActionOnce) && !alreadyUsedOnce) {
      if (cursedBySiren && role.team === "good") return;
      if (cursedByKing && role.team === "good") return;

      let targets = room.alivePlayers()
        .filter((p) => p.id !== player.id || ["doctor", "druid"].includes(role.id))
        .map((p) => ({ id: p.id, name: p.name }));

      if (role.id === "necromancer") {
        targets = Object.values(room.deadPlayers)
          .filter((p) => p.role.team === "good")
          .map((p) => ({ id: p.id, name: p.name }));
      }

      if ((role.id === "werewolf" || role.id === "alpha_wolf") && kingImmune) {
        targets = targets.filter((t) => room.players[t.id].role.id !== "king");
      }

      io.to(player.socketId).emit("night_action_request", {
        role: role.id,
        roleName: role.name,
        isOnce: !!role.hasNightActionOnce,
        targets,
        isWolfVote: role.id === "werewolf" || role.id === "alpha_wolf",
      });
    }
  });

  runBotNightActions(room);
  broadcastWolfVoteTally(room);

  room.nightState.sirenCurseActive = false;
  room.nightState.kingCurseActive = false;

  clearTimeout(room.phaseTimer);
  room.phaseTimer = setTimeout(() => resolveNight(room), NIGHT_DURATION_MS);
}

function resolveNight(room) {
  const ns = room.nightState;

  Object.entries(ns.seerResults || {}).forEach(([playerId, result]) => {
    if (room.players[playerId] && room.players[playerId].socketId) io.to(playerId).emit("night_action_result", result);
  });
  Object.entries(ns.mysticResults || {}).forEach(([playerId, result]) => {
    if (room.players[playerId] && room.players[playerId].socketId) io.to(playerId).emit("night_action_result", result);
  });
  Object.entries(ns.bardResults || {}).forEach(([playerId, result]) => {
    if (room.players[playerId] && room.players[playerId].socketId) io.to(playerId).emit("night_action_result", result);
  });

  if (ns.revivedPlayerId) {
    const revived = room.revivePlayer(ns.revivedPlayerId);
    if (revived) {
      sendSystemMessage(room, `Una fuerza misteriosa trae de vuelta a ${revived.name}.`);
      showPopup(room, `✨ ${revived.name} ha vuelto a la vida`, "revive");
    }
  }

  const voteCounts = {};
  Object.values(ns.wolfVotes).forEach((targetId) => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  let victimId = null;
  const entries = Object.entries(voteCounts);
  if (entries.length > 0) {
    const maxVotes = Math.max(...entries.map(([, c]) => c));
    const topTargets = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);
    victimId = topTargets[Math.floor(Math.random() * topTargets.length)];
  }

  if (ns.assassinTargetId) {
    victimId = victimId || ns.assassinTargetId;
  }

  const deaths = [];

  if (victimId && room.players[victimId] && room.players[victimId].alive) {
    const victim = room.players[victimId];

    if (ns.courtesanTarget && ns.courtesanTarget.targetId === victimId) {
      const courtesan = room.players[ns.courtesanTarget.actorId];
      if (courtesan && courtesan.alive) {
        applyDeath(room, courtesan.id, deaths);
      }
    } else if (ns.protectedPlayerIds.has(victimId)) {
      // Protegido por el Doctor: no muere
    } else if (victim.role.passiveShieldOnce && !room.usedShields.has(victimId)) {
      room.usedShields.add(victimId);
      sendSystemMessage(room, `${victim.name} sobrevive al ataque gracias a su armadura.`);
      showPopup(room, `🛡️ ${victim.name} sobrevivio al ataque`, "info");
    } else if (victim.role.id === "lycan" && Object.values(ns.wolfVotes).includes(victimId)) {
      victim.role = require("./roles").ROLES.werewolf;
      if (victim.socketId) io.to(victim.socketId).emit("role_changed", { roleName: "Werewolf", team: "evil" });
      sendSystemMessage(room, `Los lobos atacaron a ${victim.name} en la noche, pero se ha transformado en Werewolf y ahora es parte de la manada.`);
      showPopup(room, `🐺 ${victim.name} se transformo en Werewolf`, "info");
    } else {
      applyDeath(room, victimId, deaths);
    }
  }

  deaths.slice().forEach((deadPlayer) => {
    const partnerId = room.getLoverPartner(deadPlayer.id);
    if (partnerId && room.players[partnerId] && room.players[partnerId].alive) {
      applyDeath(room, partnerId, deaths);
    }

    Object.entries(ns.druidLinks).forEach(([druidId, linkedId]) => {
      if (druidId === deadPlayer.id && room.players[linkedId] && room.players[linkedId].alive) {
        applyDeath(room, linkedId, deaths);
      }
    });

    if (deadPlayer.role.id === "hunter") {
      const shot = deadPlayer.role.onDeathNight ? deadPlayer.role.onDeathNight(room, deadPlayer.id) : null;
      if (shot && room.players[shot.targetId] && room.players[shot.targetId].alive) {
        applyDeath(room, shot.targetId, deaths);
        sendSystemMessage(room, `${deadPlayer.name} (Hunter) disparo antes de morir y elimino a ${shot.targetName}.`);
      }
    }

    if (ns.townCrierWatchId === deadPlayer.id) {
      sendSystemMessage(room, `📢 El Town Crier revela: ${deadPlayer.name} era ${deadPlayer.role.name}.`);
    }
  });

  startDayPhase(room, deaths);
}

function applyDeath(room, playerId, deathsArray) {
  const player = room.players[playerId];
  if (!player || !player.alive) return;
  room.killPlayer(playerId);
  deathsArray.push(player);
}

function startDayPhase(room, deaths) {
  room.phase = "day";
  io.to(room.code).emit("phase_change", { phase: "day", dayNumber: room.dayNumber, durationMs: DAY_DURATION_MS });

  if (deaths.length === 0) {
    sendSystemMessage(room, "Amanece. Nadie murio esta noche. El pueblo puede debatir.");
    showPopup(room, "☀️ Amanece. Nadie murio esta noche", "day");
  } else {
    deaths.forEach((p) => {
      sendSystemMessage(room, `Amanece. ${p.name} fue atacado por los lobos durante la noche. Su rol era: ${p.role.name}.`);
      showPopup(room, `💀 ${p.name} murio de noche (${p.role.name})`, "death");
    });
  }

  broadcastPlayerList(room);

  const winner = room.checkWinCondition();
  if (winner) return endGame(room, winner);

  sendDayActionRequests(room);
  runBotDayActions(room);

  clearTimeout(room.phaseTimer);
  room.phaseTimer = setTimeout(() => startVotingPhase(room), DAY_DURATION_MS);
}

function startVotingPhase(room) {
  room.phase = "voting";
  room.resetVotes();
  room.dayState = room.dayState || {};

  io.to(room.code).emit("phase_change", { phase: "voting", dayNumber: room.dayNumber, durationMs: VOTING_DURATION_MS });
  sendSystemMessage(room, "Comienza la votacion. Elige a quien crees que es un lobo.");
  showPopup(room, "🗳️ Comienza la votacion", "voting");
  broadcastVoteTally(room);

  runBotVotes(room);

  clearTimeout(room.phaseTimer);
  room.phaseTimer = setTimeout(() => resolveVoting(room), VOTING_DURATION_MS);
}

function resolveVoting(room) {
  const voteCounts = {};
  const stolenVotes = room.nightState.stolenVoteIds || new Set();

  Object.entries(room.votes).forEach(([voterId, targetId]) => {
    if (stolenVotes.has(voterId)) return;
    const voter = room.players[voterId];
    const weight = voter && voter.role.dayVoteWeight !== undefined ? voter.role.dayVoteWeight : 1;
    voteCounts[targetId] = (voteCounts[targetId] || 0) + weight;
  });

  let lynchedId = null;
  const entries = Object.entries(voteCounts);
  if (entries.length > 0) {
    const maxVotes = Math.max(...entries.map(([, c]) => c));
    const topTargets = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);
    if (topTargets.length === 1) lynchedId = topTargets[0];
  }

  if (lynchedId && room.dayState.lynchImmuneId === lynchedId) {
    sendSystemMessage(room, "Una fuerza oscura protege al acusado. El linchamiento no tiene efecto.");
    showPopup(room, "🌀 El linchamiento fue bloqueado", "info");
    lynchedId = null;
  }

  if (lynchedId && room.players[lynchedId]) {
    const target = room.players[lynchedId];

    if (target.role.id === "princess" && !room.usedOnceAbilities.has(target.id)) {
      room.usedOnceAbilities.add(target.id);
      sendSystemMessage(room, `${target.name} revela ser la Princess y sobrevive al linchamiento.`);
      showPopup(room, `👑 ${target.name} revela ser la Princess y sobrevive`, "info");
    } else {
      room.killPlayer(lynchedId);
      sendSystemMessage(room, `${target.name} fue linchado por el pueblo. Su rol era: ${target.role.name}.`);
      showPopup(room, `⚖️ ${target.name} fue linchado de dia (${target.role.name})`, "death");

      if (target.role.id === "siren") {
        room.nightState.sirenCurseActive = true;
      }
      if (target.role.id === "king") {
        room.nightState.kingCurseActive = true;
      }

      const partnerId = room.getLoverPartner(lynchedId);
      if (partnerId && room.players[partnerId] && room.players[partnerId].alive) {
        room.killPlayer(partnerId);
        sendSystemMessage(room, `${room.players[partnerId] ? room.players[partnerId].name : "Su pareja"} muere de pena junto a su amante.`);
      }
    }
  } else {
    sendSystemMessage(room, "El pueblo no logra ponerse de acuerdo. Nadie es linchado.");
    showPopup(room, "🤷 Nadie fue linchado", "info");
  }

  broadcastPlayerList(room);

  const winner = room.checkWinCondition();
  if (winner) return endGame(room, winner);

  room.dayState = {};
  startNightPhase(room);
}

function endGame(room, winner) {
  room.phase = "ended";
  clearTimeout(room.phaseTimer);

  const winnerLabels = { good: "El pueblo gana la partida.", evil: "Los lobos ganan la partida.", jester: "El Jester gana la partida." };

  io.to(room.code).emit("game_over", {
    winner,
    roles: room.playerList().map((p) => ({ name: p.name, role: p.role.name, roleId: p.role.id, team: p.role.team })),
  });
  sendSystemMessage(room, winnerLabels[winner] || "La partida ha terminado.");
  showPopup(room, `🏁 ${winnerLabels[winner] || "Partida terminada"}`, "gameover");
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ playerName, avatar }, callback) => {
    const code = generateRoomCode();
    const room = new Room(code, socket.id);
    room.addPlayer(socket.id, playerName || "Jugador", avatar);
    rooms[code] = room;
    socket.join(code);
    callback({ ok: true, code });
    broadcastPlayerList(room);
  });

  socket.on("join_room", ({ code, playerName, avatar }, callback) => {
    const room = rooms[(code || "").toUpperCase()];
    if (!room) return callback({ ok: false, error: "La sala no existe." });
    if (room.phase !== "lobby") return callback({ ok: false, error: "La partida ya comenzo." });
    if (room.playerList().length >= MAX_PLAYERS) return callback({ ok: false, error: "La sala esta llena." });

    room.addPlayer(socket.id, playerName || "Jugador", avatar);
    socket.join(room.code);
    callback({ ok: true, code: room.code });
    broadcastPlayerList(room);
    sendSystemMessage(room, `${playerName || "Un jugador"} se unio a la sala.`);
  });

  socket.on("add_bot", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.hostSocketId) return;
    if (room.phase !== "lobby") return;
    if (room.playerList().length >= MAX_PLAYERS) return;

    const bot = room.addBot();
    broadcastPlayerList(room);
    sendSystemMessage(room, `${bot.name} (bot) se unio a la sala para pruebas.`);
  });

  socket.on("remove_bot", ({ code, botId }) => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.hostSocketId) return;
    if (room.phase !== "lobby") return;
    const bot = room.players[botId];
    if (!bot || !bot.isBot) return;

    room.removePlayer(botId);
    broadcastPlayerList(room);
    sendSystemMessage(room, `${bot.name} (bot) fue eliminado de la sala.`);
  });

  socket.on("start_game", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    if (socket.id !== room.hostSocketId) return;
    if (room.playerList().length < 4) return;

    room.assignRoles();
    room.playerList().filter((p) => !p.isBot).forEach((p) => {
      io.to(p.socketId).emit("role_assigned", {
        role: p.role.id,
        roleName: p.role.name,
        team: p.role.team,
        description: p.role.description,
        hasDayActionOnce: !!p.role.hasDayActionOnce,
      });
    });

    sendSystemMessage(room, "La partida ha comenzado. Revisa tu rol en privado.");

    startInitialCountdown(room);
  });

  socket.on("leave_room", ({ code }) => {
    const room = rooms[code];
    if (!room) return;
    const player = room.players[socket.id];
    if (!player) return;

    room.removePlayer(socket.id);
    socket.leave(code);
    broadcastPlayerList(room);
    sendSystemMessage(room, `${player.name} abandono la sala.`);

    if (room.playerList().filter((p) => !p.isBot).length === 0) {
      clearTimeout(room.phaseTimer);
      delete rooms[code];
    }
  });

  socket.on("night_action", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.phase !== "night") return;
    const player = room.players[socket.id];
    if (!player || !player.alive) return;
    const role = player.role;
    if (!role.hasNightAction && !role.hasNightActionOnce) return;
    if (role.hasNightActionOnce && room.usedOnceAbilities.has(player.id)) return;
    if (room.nightState.disabledPlayerIds.has(player.id)) return;

    const result = role.resolveNightAction ? role.resolveNightAction(room, socket.id, targetId) : null;
    if (!result) return;

    if (role.hasNightActionOnce) room.usedOnceAbilities.add(player.id);

    if (role.id === "seer") room.nightState.seerResults[socket.id] = result;
    if (role.id === "mystic") room.nightState.mysticResults[socket.id] = result;
    if (role.id === "bard") room.nightState.bardResults[socket.id] = result;
    if (role.id === "werewolf" || role.id === "alpha_wolf") broadcastWolfVoteTally(room);
  });

  socket.on("day_action", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.phase !== "day") return;
    const player = room.players[socket.id];
    if (!player || !player.alive) return;
    const role = player.role;
    if (!role.hasDayActionOnce) return;
    if (room.usedOnceAbilities.has(player.id)) return;

    const result = role.resolveDayAction ? role.resolveDayAction(room, socket.id, targetId) : null;
    if (!result) {
      io.to(socket.id).emit("day_action_rejected", { message: "Ese jugador no es un objetivo valido para tu habilidad." });
      return;
    }

    room.usedOnceAbilities.add(player.id);

    if (result.type === "witch_reveal") {
      sendSystemMessage(room, `La Witch revela que ${result.targetName} es ${result.roleName}.`);
      showPopup(room, `🧙 La Witch revela: ${result.targetName} es ${result.roleName}`, "info");
    }
    if (result.type === "wolf_shaman_protect") {
      sendSystemMessage(room, "El Wolf Shaman ha protegido a alguien del linchamiento de hoy.");
    }
  });

  socket.on("day_vote", ({ code, targetId }) => {
    const room = rooms[code];
    if (!room || room.phase !== "voting") return;
    const player = room.players[socket.id];
    if (!player || !player.alive) return;
    if (targetId === socket.id) return;

    registerVote(room, socket.id, targetId);
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

  socket.on("wolf_chat_message", ({ code, text }) => {
    const room = rooms[code];
    if (!room || room.phase !== "night") return;
    const player = room.players[socket.id];
    if (!player || !player.alive || player.role.team !== "evil") return;
    sendWolfChatMessage(room, player.name, text);
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
