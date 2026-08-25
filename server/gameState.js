// server/gameState.js
const { ROLES, EVIL_ROLE_IDS, GOOD_ROLE_IDS } = require("./roles");

function buildRolePool(nPlayers, evilRatio = 0.3) {
  const nEvil = Math.max(1, Math.round(nPlayers * evilRatio));
  const nGood = nPlayers - nEvil;

  const evilPool = shuffle([...EVIL_ROLE_IDS]);
  const chosenEvil = evilPool.slice(0, Math.min(nEvil, evilPool.length));
  while (chosenEvil.length < nEvil) chosenEvil.push("werewolf");

  let chosenGood = [];
  const goodPoolNoLovers = GOOD_ROLE_IDS.filter((id) => id !== "lover");
  const shuffledGood = shuffle([...goodPoolNoLovers]);

  if (nGood >= 2 && Math.random() < 0.6) {
    chosenGood.push("lover", "lover");
    chosenGood = chosenGood.concat(shuffledGood.slice(0, Math.max(0, nGood - 2)));
  } else {
    chosenGood = shuffledGood.slice(0, nGood);
  }

  while (chosenGood.length < nGood) chosenGood.push("villager");
  chosenGood = chosenGood.slice(0, nGood);

  const pool = shuffle(chosenEvil.concat(chosenGood));
  return pool;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const BOT_NAMES = [
  "Bot Ana", "Bot Luis", "Bot Marta", "Bot Diego", "Bot Sara",
  "Bot Pablo", "Bot Elena", "Bot Hugo", "Bot Nora", "Bot Iker",
];

class Room {
  constructor(code, hostSocketId) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.players = {};
    this.deadPlayers = {};
    this.phase = "lobby";
    this.dayNumber = 0;
    this.nightState = {};
    this.dayState = {};
    this.votes = {};
    this.chatLog = [];
    this.phaseTimer = null;
    this.lovePairs = [];
    this.usedOnceAbilities = new Set();
    this.usedShields = new Set();
    this.jesterEliminated = false;
    this.botCounter = 0;
  }

  addPlayer(socketId, name, avatar) {
    this.players[socketId] = {
      id: socketId,
      name,
      avatar: avatar || null,
      role: null,
      alive: true,
      socketId,
      isBot: false,
    };
  }

  addBot() {
    this.botCounter += 1;
    const botId = `bot_${this.code}_${this.botCounter}_${Date.now()}`;
    const name = BOT_NAMES[(this.botCounter - 1) % BOT_NAMES.length] + (this.botCounter > BOT_NAMES.length ? ` ${this.botCounter}` : "");
    this.players[botId] = {
      id: botId,
      name,
      avatar: null,
      role: null,
      alive: true,
      socketId: null,
      isBot: true,
    };
    return this.players[botId];
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

  botsAlive() {
    return this.alivePlayers().filter((p) => p.isBot);
  }

  assignRoles() {
    const ids = Object.keys(this.players);
    const pool = buildRolePool(ids.length);
    ids.forEach((id, idx) => {
      const roleId = pool[idx];
      this.players[id].role = ROLES[roleId];
    });

    const loverIds = ids.filter((id) => this.players[id].role.id === "lover");
    if (loverIds.length === 2) {
      this.lovePairs.push(loverIds);
    }
  }

  resetNightState() {
    this.nightState = {
      wolfVotes: {},
      protectedPlayerIds: new Set(),
      disabledPlayerIds: new Set(),
      stolenVoteIds: new Set(),
      druidLinks: {},
      doctorBlocked: false,
      sirenCurseActive: this.nightState ? this.nightState.sirenCurseActive : false,
      kingCurseActive: this.nightState ? this.nightState.kingCurseActive : false,
      seerResults: {},
      mysticResults: {},
      bardResults: {},
      townCrierWatchId: null,
      assassinTargetId: null,
      courtesanTarget: null,
      revivedPlayerId: null,
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

  isKingImmuneAtNight() {
    const king = this.alivePlayers().find((p) => p.role.id === "king");
    if (!king) return false;
    return king.role.isImmuneAtNight ? king.role.isImmuneAtNight(this) : false;
  }

  checkWinCondition() {
    if (this.jesterEliminated) return "jester";

    const wolves = this.wolvesAlive().length;
    const goodExcludingJester = this.goodAlive().filter((p) => p.role.id !== "jester").length;
    if (wolves === 0) return "good";
    if (wolves >= goodExcludingJester) return "evil";
    return null;
  }

  getLoverPartner(playerId) {
    for (const pair of this.lovePairs) {
      if (pair.includes(playerId)) {
        return pair.find((id) => id !== playerId);
      }
    }
    return null;
  }

  killPlayer(playerId) {
    const player = this.players[playerId];
    if (!player || !player.alive) return;
    player.alive = false;
    this.deadPlayers[playerId] = player;
    if (player.role.id === "jester") this.jesterEliminated = true;
  }

  revivePlayer(playerId) {
    const player = this.deadPlayers[playerId];
    if (!player) return null;
    player.alive = true;
    delete this.deadPlayers[playerId];
    if (player.role.id === "jester") this.jesterEliminated = false;
    return player;
  }
}

module.exports = { Room, buildRolePool };
