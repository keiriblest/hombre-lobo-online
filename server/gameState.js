// server/gameState.js
const ROLES = require("./roles");

function buildRolePool(nPlayers) {
  const nWolves = Math.max(1, Math.floor(nPlayers / 4));
  const pool = [];

  for (let i = 0; i < nWolves; i++) pool.push("werewolf");
  if (nPlayers >= 3) pool.push("seer");
  if (nPlayers >= 4) pool.push("doctor");

  while (pool.length < nPlayers) pool.push("villager");

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, nPlayers);
}

class Room {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.players = {};
    this.phase = "lobby";
    this.dayNumber = 0;
    this.nightState = {};
    this.votes = {};
    this.chatLog = [];
    this.phaseTimer = null;
  }

  addPlayer(socketId, name) {
    this.players[socketId] = {
      id: socketId,
      name,
      role: null,
      alive: true,
      socketId,
    };
  }

  removePlayer(socketId) {
    delete this.players[socketId];
  }

  playerList() {
    return Object.values(this.players);
  }

  alivePlayers() {
    return this.playerList().filter((p) => p.alive);
  }

  assignRoles() {
    const ids = Object.keys(this.players);
    const pool = buildRolePool(ids.length);
    ids.forEach((id, idx) => {
      const roleId = pool[idx];
      this.players[id].role = ROLES[roleId];
    });
  }

  resetNightState() {
    this.nightState = {
      wolfVotes: {},
      protectedPlayerId: null,
      seerResults: {},
      deaths: [],
    };
  }

  resetVotes() {
    this.votes = {};
  }

  wolvesAlive() {
    return this.alivePlayers().filter((p) => p.role.team === "evil");
  }

  goodAlive() {
    return this.alivePlayers().filter((p) => p.role.team === "good");
  }

  checkWinCondition() {
    const wolves = this.wolvesAlive().length;
    const good = this.goodAlive().length;
    if (wolves === 0) return "good";
    if (wolves >= good) return "evil";
    return null;
  }
}

module.exports = { Room, buildRolePool };
