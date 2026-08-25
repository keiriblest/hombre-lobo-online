// client/js/main.js
const socket = io();

const STORAGE_KEY = "hombreLoboProfile";

let state = {
  code: null,
  playerName: null,
  avatar: null,
  isHost: false,
  myRole: null,
  currentPlayers: [],
  voteTally: {},
  wolfVoteTally: {},
  currentCenterView: "announcement",
};

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

let popupTimeout = null;

socket.on("show_popup", ({ text, type }) => {
  const overlay = document.getElementById("popup-overlay");
  const box = document.getElementById("popup-box");
  document.getElementById("popup-text").textContent = text;

  box.className = "popup-box popup-" + (type || "info");
  overlay.classList.remove("hidden");

  clearTimeout(popupTimeout);
  popupTimeout = setTimeout(() => {
    overlay.classList.add("hidden");
  }, 3000);
});

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const profile = JSON.parse(raw);
    if (profile.name) document.getElementById("input-name").value = profile.name;
    if (profile.avatar) {
      state.avatar = profile.avatar;
      document.getElementById("avatar-preview").src = profile.avatar;
      document.getElementById("avatar-preview").classList.add("visible");
    }
  } catch (e) {
    console.warn("No se pudo cargar el perfil guardado", e);
  }
}

function saveProfile(name, avatar) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, avatar: avatar || null }));
  } catch (e) {
    console.warn("No se pudo guardar el perfil (localStorage lleno o bloqueado)", e);
  }
}

document.getElementById("avatar-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 1.5 * 1024 * 1024) {
    showLobbyError("La imagen es muy grande. Usa una foto de menos de 1.5 MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    resizeImage(reader.result, 128, (resizedDataUrl) => {
      state.avatar = resizedDataUrl;
      document.getElementById("avatar-preview").src = resizedDataUrl;
      document.getElementById("avatar-preview").classList.add("visible");
      showLobbyError("");
    });
  };
  reader.readAsDataURL(file);
});

function resizeImage(dataUrl, maxSize, callback) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    let { width, height } = img;
    if (width > height) {
      if (width > maxSize) { height *= maxSize / width; width = maxSize; }
    } else {
      if (height > maxSize) { width *= maxSize / height; height = maxSize; }
    }
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    callback(canvas.toDataURL("image/jpeg", 0.8));
  };
  img.src = dataUrl;
}

loadProfile();

document.getElementById("btn-create").addEventListener("click", () => {
  const name = document.getElementById("input-name").value.trim();
  if (!name) return showLobbyError("Escribe tu nombre.");
  state.playerName = name;
  saveProfile(name, state.avatar);

  socket.emit("create_room", { playerName: name, avatar: state.avatar }, (res) => {
    if (!res.ok) return showLobbyError(res.error || "Error al crear la sala.");
    state.code = res.code;
    state.isHost = true;
    enterRoomScreen();
  });
});

document.getElementById("btn-join").addEventListener("click", () => {
  const name = document.getElementById("input-name").value.trim();
  const code = document.getElementById("input-code").value.trim().toUpperCase();
  if (!name) return showLobbyError("Escribe tu nombre.");
  if (!code) return showLobbyError("Escribe el codigo de sala.");
  state.playerName = name;
  saveProfile(name, state.avatar);

  socket.emit("join_room", { code, playerName: name, avatar: state.avatar }, (res) => {
    if (!res.ok) return showLobbyError(res.error || "Error al unirse.");
    state.code = res.code;
    state.isHost = false;
    enterRoomScreen();
  });
});

function showLobbyError(msg) {
  document.getElementById("lobby-error").textContent = msg;
}

function enterRoomScreen() {
  document.getElementById("room-code-label").textContent = state.code;
  document.getElementById("btn-start").classList.toggle("hidden", !state.isHost);
  document.getElementById("bot-controls").classList.toggle("hidden", !state.isHost);
  showScreen("screen-room");
}

document.getElementById("btn-start").addEventListener("click", () => {
  socket.emit("start_game", { code: state.code });
});

document.getElementById("btn-add-bot").addEventListener("click", () => {
  socket.emit("add_bot", { code: state.code });
});

function leaveRoom() {
  socket.emit("leave_room", { code: state.code });
  window.location.reload();
}

document.getElementById("btn-leave-room").addEventListener("click", leaveRoom);

socket.on("player_list", (players) => {
  renderPlayerList(document.getElementById("player-list"), players, true);
  renderPlayersRing(players);
  state.currentPlayers = players;

  const startBtn = document.getElementById("btn-start");
  if (state.isHost) {
    startBtn.disabled = players.length < 4;
    startBtn.textContent = players.length < 4
      ? `Esperando jugadores (${players.length}/4 min.)`
      : "Iniciar partida";
  }
});

function renderPlayerList(ul, players, showRemoveBot) {
  ul.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    if (!p.alive) li.classList.add("dead");

    const left = document.createElement("span");
    left.className = "player-row";
    const avatarHtml = p.avatar
      ? `<img src="${p.avatar}" class="player-avatar" />`
      : `<span class="player-avatar player-avatar-placeholder">${p.isBot ? "🤖" : "👤"}</span>`;
    left.innerHTML = `${avatarHtml}<span>${p.name}${p.id === socket.id ? " (tu)" : ""}${p.isBot ? " (bot)" : ""}</span>`;

    const right = document.createElement("span");
    right.textContent = p.alive ? "🟢" : "💀";

    li.appendChild(left);

    if (showRemoveBot && p.isBot && state.isHost) {
      const removeBtn = document.createElement("button");
      removeBtn.textContent = "Quitar";
      removeBtn.className = "remove-bot-btn";
      removeBtn.addEventListener("click", () => {
        socket.emit("remove_bot", { code: state.code, botId: p.id });
      });
      li.appendChild(removeBtn);
    } else {
      li.appendChild(right);
    }

    ul.appendChild(li);
  });
}

function renderPlayersRing(players) {
  const ring = document.getElementById("players-ring");
  if (!ring) return;
  ring.innerHTML = "";

  players.forEach((p) => {
    const token = document.createElement("div");
    token.className = "player-token" + (!p.alive ? " dead" : "") + (p.id === socket.id ? " me" : "");

    const avatarWrapper = document.createElement("div");
    avatarWrapper.className = "player-token-avatar-wrapper";
    if (p.avatar) {
      const img = document.createElement("img");
      img.src = p.avatar;
      avatarWrapper.appendChild(img);
    } else {
      avatarWrapper.textContent = p.isBot ? "🤖" : "👤";
    }

    const status = document.createElement("span");
    status.className = "player-token-status";
    status.textContent = p.alive ? "🟢" : "💀";
    avatarWrapper.appendChild(status);

    const name = document.createElement("div");
    name.className = "player-token-name";
    name.textContent = p.name + (p.id === socket.id ? " (tu)" : "");

    token.appendChild(avatarWrapper);
    token.appendChild(name);
    ring.appendChild(token);
  });
}

socket.on("role_assigned", (role) => {
  state.myRole = role;
  updateRoleChip(role);
  fillRoleCard(role);

  document.getElementById("wolf-chat-bar").classList.toggle("hidden", role.team !== "evil");
  document.getElementById("btn-close-role-detail").classList.add("hidden");

  showScreen("screen-role");
});

function updateRoleChip(role) {
  const imgEl = document.getElementById("my-role-chip-img");
  const fallbackEl = document.getElementById("my-role-chip-fallback");
  const emojiEl = document.getElementById("my-role-chip-emoji");
  applyRoleCardVisual(imgEl, fallbackEl, emojiEl, role.role);
}

function fillRoleCard(role) {
  document.getElementById("role-card-name").textContent = role.roleName;
  document.getElementById("role-card-team").textContent = role.team === "evil" ? "Bando: Malo" : "Bando: Bueno";
  document.getElementById("role-description").textContent = role.description;

  const imgEl = document.getElementById("role-card-img");
  const fallbackEl = document.getElementById("role-card-fallback");
  const emojiEl = document.getElementById("role-card-emoji");
  applyRoleCardVisual(imgEl, fallbackEl, emojiEl, role.role);

  const cardEl = document.getElementById("role-card");
  cardEl.classList.toggle("card-evil", role.team === "evil");
  cardEl.classList.toggle("card-good", role.team !== "evil");
}

document.getElementById("my-role-chip").addEventListener("click", () => {
  if (!state.myRole) return;
  fillRoleCard(state.myRole);
  document.getElementById("btn-close-role-detail").classList.remove("hidden");
  showScreen("screen-role");
});

document.getElementById("btn-close-role-detail").addEventListener("click", () => {
  showScreen("screen-game");
});

socket.on("role_changed", (role) => {
  state.myRole = role;
  updateRoleChip(role);
  document.getElementById("wolf-chat-bar").classList.toggle("hidden", role.team !== "evil");
  setAnnouncement(`Tu rol ha cambiado. Ahora eres: ${role.roleName}.`, "🐺");
});

document.getElementById("btn-menu-toggle").addEventListener("click", () => {
  document.getElementById("menu-dropdown").classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  const wrapper = document.querySelector(".menu-wrapper");
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById("menu-dropdown").classList.add("hidden");
  }
});

document.getElementById("menu-item-rules").addEventListener("click", () => {
  document.getElementById("menu-dropdown").classList.add("hidden");
  document.getElementById("rules-drawer").classList.remove("hidden");
});

document.getElementById("menu-item-leave").addEventListener("click", () => {
  leaveRoom();
});

document.getElementById("btn-close-rules-drawer").addEventListener("click", () => {
  document.getElementById("rules-drawer").classList.add("hidden");
});

function setAnnouncement(text, icon) {
  document.getElementById("announcement-text").textContent = text;
  document.getElementById("announcement-icon").textContent = icon || "📢";

  if (state.currentCenterView === "announcement" || state.currentCenterView === null) {
    hideAllCenterPanels();
    document.getElementById("center-announcement").classList.remove("hidden");
    state.currentCenterView = "announcement";
  }
}

let phaseInterval = null;

socket.on("phase_change", ({ phase, dayNumber, durationMs }) => {
  showScreen("screen-game");
  document.getElementById("day-number").textContent = phase === "starting" ? "Preparando..." : `Dia ${dayNumber}`;

  const labels = { starting: "⏳ Preparando", night: "🌙 Noche", day: "☀️ Debate", voting: "🗳️ Votacion" };
  document.getElementById("phase-label").textContent = labels[phase] || phase;

  hideAllCenterPanels();

  const wolfBar = document.getElementById("wolf-chat-bar");
  if (wolfBar) wolfBar.classList.toggle("hidden", !(state.myRole && state.myRole.team === "evil"));

  if (phase === "night") {
    document.getElementById("night-targets").innerHTML = "";
    document.getElementById("night-wait-msg").classList.remove("hidden");
    document.getElementById("night-panel").classList.remove("hidden");
    state.currentCenterView = "night";
    if (state.myRole && state.myRole.team === "evil") {
      state.wolfVoteTally = {};
      renderWolfVoteTally();
    }
  } else if (phase === "voting") {
    state.voteTally = {};
    document.getElementById("voting-panel").classList.remove("hidden");
    state.currentCenterView = "voting";
    renderVotingTargets();
  } else {
    document.getElementById("center-announcement").classList.remove("hidden");
    state.currentCenterView = "announcement";
  }

  startPhaseTimer(durationMs);
});

function hideAllCenterPanels() {
  ["center-announcement", "night-panel", "wolf-vote-panel", "day-action-panel", "voting-panel"].forEach((id) => {
    document.getElementById(id).classList.add("hidden");
  });
}

function startPhaseTimer(durationMs) {
  clearInterval(phaseInterval);
  let remaining = Math.floor(durationMs / 1000);
  const label = document.getElementById("phase-timer");
  label.textContent = `${remaining}s`;
  phaseInterval = setInterval(() => {
    remaining -= 1;
    label.textContent = remaining > 0 ? `${remaining}s` : "...";
    if (remaining <= 0) clearInterval(phaseInterval);
  }, 1000);
}

socket.on("night_action_request", ({ role, roleName, targets, isOnce, isWolfVote }) => {
  hideAllCenterPanels();
  document.getElementById("night-action-title").textContent = isOnce
    ? `${roleName}: elige tu objetivo (habilidad unica, solo puedes usarla una vez)`
    : `${roleName}: elige tu objetivo`;
  const container = document.getElementById("night-targets");
  container.innerHTML = "";
  document.getElementById("night-wait-msg").classList.remove("hidden");
  document.getElementById("night-panel").classList.remove("hidden");
  state.currentCenterView = "night";

  targets.forEach((t) => {
    const btn = document.createElement("div");
    btn.className = "target-btn";
    btn.textContent = t.name;
    btn.addEventListener("click", () => {
      container.querySelectorAll(".target-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      socket.emit("night_action", { code: state.code, targetId: t.id });

      if (isWolfVote) {
        showWolfVoteView();
      }
    });
    container.appendChild(btn);
  });
});

function showWolfVoteView() {
  hideAllCenterPanels();
  document.getElementById("wolf-vote-panel").classList.remove("hidden");
  state.currentCenterView = "night";
  renderWolfVoteTally();
}

socket.on("wolf_vote_tally", ({ tally }) => {
  state.wolfVoteTally = tally || {};
  renderWolfVoteTally();
});

function renderWolfVoteTally() {
  const container = document.getElementById("wolf-vote-tally");
  if (!container) return;
  container.innerHTML = "";

  const entries = Object.entries(state.wolfVoteTally);
  if (entries.length === 0) {
    container.innerHTML = '<p class="hint">Nadie ha votado todavia.</p>';
    return;
  }

  entries.forEach(([targetId, count]) => {
    const target = (state.currentPlayers || []).find((p) => p.id === targetId);
    const row = document.createElement("div");
    row.className = "wolf-vote-row";
    row.innerHTML = `<span>${target ? target.name : "?"}</span><span>${count} voto(s)</span>`;
    container.appendChild(row);
  });
}

socket.on("night_action_result", (result) => {
  if (result.type === "seer_result") {
    setAnnouncement(`(privado) Investigaste a ${result.targetName}: es del bando ${result.alignment}.`, "🔮");
  }
  if (result.type === "mystic_reveal") {
    setAnnouncement(`(privado) El Mystic descubre que ese jugador es: ${result.roleName}.`, "🧿");
  }
  if (result.type === "bard_exchange") {
    setAnnouncement(`(privado) Intercambio de informacion: ${result.targetName} es ${result.targetRoleName}.`, "🎵");
  }
});

socket.on("day_action_request", ({ role, roleName, targets }) => {
  hideAllCenterPanels();
  document.getElementById("day-action-panel").classList.remove("hidden");
  document.getElementById("day-action-title").textContent = `${roleName}: elige tu objetivo (habilidad unica)`;
  state.currentCenterView = "day-action";

  const msgEl = document.getElementById("day-action-msg");
  msgEl.classList.add("hidden");

  const container = document.getElementById("day-action-targets");
  container.innerHTML = "";

  if (targets.length === 0) {
    msgEl.textContent = "No hay objetivos validos para tu habilidad en este momento.";
    msgEl.classList.remove("hidden");
    return;
  }

  targets.forEach((t) => {
    const btn = document.createElement("div");
    btn.className = "target-btn";
    btn.textContent = t.name;
    btn.addEventListener("click", () => {
      container.querySelectorAll(".target-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      socket.emit("day_action", { code: state.code, targetId: t.id });
    });
    container.appendChild(btn);
  });
});

socket.on("day_action_rejected", ({ message }) => {
  const msgEl = document.getElementById("day-action-msg");
  msgEl.textContent = message;
  msgEl.classList.remove("hidden");
});

function renderVotingTargets() {
  const container = document.getElementById("voting-targets");
  container.innerHTML = "";
  (state.currentPlayers || [])
    .filter((p) => p.alive && p.id !== socket.id)
    .forEach((p) => {
      const btn = document.createElement("div");
      btn.className = "target-btn vote-target";
      btn.dataset.playerId = p.id;

      const countBadge = document.createElement("span");
      countBadge.className = "vote-count-badge";
      countBadge.textContent = state.voteTally[p.id] || 0;

      const label = document.createElement("span");
      label.textContent = p.name;

      btn.appendChild(label);
      btn.appendChild(countBadge);

      btn.addEventListener("click", () => {
        container.querySelectorAll(".target-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        socket.emit("day_vote", { code: state.code, targetId: p.id });
      });
      container.appendChild(btn);
    });
}

socket.on("vote_tally", ({ tally }) => {
  state.voteTally = tally || {};
  document.querySelectorAll(".vote-target").forEach((btn) => {
    const pid = btn.dataset.playerId;
    const badge = btn.querySelector(".vote-count-badge");
    if (badge) badge.textContent = state.voteTally[pid] || 0;
  });
});

document.getElementById("btn-send-chat").addEventListener("click", sendChat);
document.getElementById("chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

function sendChat() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  socket.emit("chat_message", { code: state.code, text });
  input.value = "";
}

socket.on("chat_message", (msg) => {
  addSystemChatLine(msg.author, msg.text, msg.author === "Sistema");

  if (msg.author === "Sistema") {
    setAnnouncement(msg.text, pickAnnouncementIcon(msg.text));
    return;
  }

  const bubble = document.getElementById("chat-bubble");
  document.getElementById("chat-bubble-author").textContent = msg.author + ":";
  document.getElementById("chat-bubble-text").textContent = msg.text;
  bubble.classList.remove("hidden");
});

function pickAnnouncementIcon(text) {
  if (text.includes("linchado")) return "⚖️";
  if (text.includes("murio") || text.includes("muerto")) return "💀";
  if (text.includes("noche")) return "🌙";
  if (text.includes("Amanece")) return "☀️";
  if (text.includes("votacion") || text.includes("vota")) return "🗳️";
  if (text.includes("gana")) return "🏁";
  return "📢";
}

document.getElementById("chat-bubble").addEventListener("click", () => {
  document.getElementById("chat-history-drawer").classList.remove("hidden");
});

document.getElementById("btn-close-chat-history").addEventListener("click", () => {
  document.getElementById("chat-history-drawer").classList.add("hidden");
});

function addSystemChatLine(author, text, isSystem) {
  const log = document.getElementById("chat-log");
  const div = document.createElement("div");
  div.className = "msg" + (isSystem ? " system" : "");
  div.innerHTML = isSystem ? text : `<span class="author">${author}:</span> ${text}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

const wolfChatBtn = document.getElementById("btn-send-wolf-chat");
if (wolfChatBtn) {
  wolfChatBtn.addEventListener("click", sendWolfChat);
  document.getElementById("wolf-chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendWolfChat();
  });
}

function sendWolfChat() {
  const input = document.getElementById("wolf-chat-input");
  const text = input.value.trim();
  if (!text) return;
  socket.emit("wolf_chat_message", { code: state.code, text });
  input.value = "";
}

socket.on("wolf_chat_message", (msg) => {
  const log = document.getElementById("wolf-chat-log");
  if (log) {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<span class="author">${msg.author}:</span> ${msg.text}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  const bubble = document.getElementById("wolf-chat-bubble");
  if (bubble) {
    document.getElementById("wolf-chat-bubble-author").textContent = msg.author + ":";
    document.getElementById("wolf-chat-bubble-text").textContent = msg.text;
    bubble.classList.remove("hidden");
  }
});

document.getElementById("wolf-chat-bubble").addEventListener("click", () => {
  document.getElementById("wolf-chat-history-drawer").classList.remove("hidden");
});

document.getElementById("btn-close-wolf-chat-history").addEventListener("click", () => {
  document.getElementById("wolf-chat-history-drawer").classList.add("hidden");
});

socket.on("game_over", ({ winner, roles }) => {
  clearInterval(phaseInterval);
  const titles = { good: "🎉 El pueblo ha ganado", evil: "🐺 Los lobos han ganado", jester: "🏏 El Jester ha ganado" };
  document.getElementById("end-title").textContent = titles[winner] || "Partida terminada";

  const container = document.getElementById("end-roles-cards");
  container.innerHTML = "";

  roles.forEach((r) => {
    const roleId = r.roleId || null;
    const card = document.createElement("div");
    card.className = "mini-role-card" + (r.team === "evil" ? " card-evil" : " card-good");

    const img = document.createElement("img");
    img.className = "mini-role-card-img";
    const fallback = document.createElement("div");
    fallback.className = "mini-role-card-fallback hidden";
    const emojiSpan = document.createElement("span");
    fallback.appendChild(emojiSpan);

    if (roleId) {
      applyRoleCardVisual(img, fallback, emojiSpan, roleId);
    } else {
      img.classList.add("hidden");
      fallback.classList.remove("hidden");
      emojiSpan.textContent = "❓";
    }

    const label = document.createElement("div");
    label.className = "mini-role-card-label";
    label.innerHTML = `<strong>${r.name}</strong><br>${r.role}`;

    card.appendChild(img);
    card.appendChild(fallback);
    card.appendChild(label);
    container.appendChild(card);
  });

  showScreen("screen-end");
});

document.getElementById("btn-back-lobby").addEventListener("click", () => {
  window.location.reload();
});
