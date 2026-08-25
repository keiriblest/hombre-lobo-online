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
  isLover: false,
  pendingAction: null,
  selectedTargetId: null,
  announcementHistory: [],
};

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

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
    token.dataset.playerId = p.id;

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

    const voteBadge = document.createElement("span");
    voteBadge.className = "player-token-vote-badge hidden";
    voteBadge.dataset.role = "voteBadge";
    avatarWrapper.appendChild(voteBadge);

    const name = document.createElement("div");
    name.className = "player-token-name";
    name.textContent = p.name + (p.id === socket.id ? " (tu)" : "");

    token.appendChild(avatarWrapper);
    token.appendChild(name);
    ring.appendChild(token);

    const isValidTarget = state.pendingAction && p.alive && isValidActionTarget(p.id);
    token.classList.toggle("actionable", !!isValidTarget);

    if (isValidTarget) {
      token.addEventListener("click", () => openActionModal(p));
    }
  });

  updateVoteBadges();
}

function isValidActionTarget(playerId) {
  if (!state.pendingAction) return false;
  if (playerId === socket.id && state.pendingAction.excludeSelf) return false;
  return state.pendingAction.validTargetIds.includes(playerId);
}

function openActionModal(targetPlayer) {
  if (!state.pendingAction) return;
  state.selectedTargetId = targetPlayer.id;

  const avatarEl = document.getElementById("action-modal-avatar");
  avatarEl.innerHTML = targetPlayer.avatar
    ? `<img src="${targetPlayer.avatar}" />`
    : `<span>${targetPlayer.isBot ? "🤖" : "👤"}</span>`;

  document.getElementById("action-modal-text").textContent =
    `${state.pendingAction.label} a ${targetPlayer.name}?`;

  document.getElementById("action-confirm-modal").classList.remove("hidden");
}

document.getElementById("btn-action-cancel").addEventListener("click", closeActionModal);

function closeActionModal() {
  document.getElementById("action-confirm-modal").classList.add("hidden");
  state.selectedTargetId = null;
}

document.getElementById("btn-action-confirm").addEventListener("click", () => {
  if (!state.pendingAction || !state.selectedTargetId) return;

  const { type } = state.pendingAction;
  const targetId = state.selectedTargetId;

  if (type === "vote") {
    socket.emit("day_vote", { code: state.code, targetId });
  } else if (type === "night") {
    socket.emit("night_action", { code: state.code, targetId });
    if (state.pendingAction.isWolfVote) {
      showWolfVoteView();
    }
  } else if (type === "day") {
    socket.emit("day_action", { code: state.code, targetId });
  }

  closeActionModal();
});

function setPendingAction(actionConfig) {
  state.pendingAction = actionConfig;
  renderPlayersRing(state.currentPlayers);
  updateActionBanner();
}

function clearPendingAction() {
  state.pendingAction = null;
  renderPlayersRing(state.currentPlayers);
  updateActionBanner();
}

function updateActionBanner() {
  const banner = document.getElementById("action-banner");
  const textEl = document.getElementById("action-banner-text");
  if (state.pendingAction) {
    textEl.textContent = "👉 " + state.pendingAction.label + ". Toca a un jugador en el tablero.";
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

socket.on("role_assigned", (role) => {
  state.myRole = role;
  state.isLover = !!role.isLover;
  updateRoleChip(role);
  fillRoleCard(role);
  updateChatChannelOptions();

  document.getElementById("btn-close-role-detail").classList.add("hidden");

  showScreen("screen-role");
});

function updateChatChannelOptions() {
  const select = document.getElementById("chat-channel-select");
  const wolfOption = select.querySelector('option[value="wolf"]');
  const loverOption = select.querySelector('option[value="lover"]');

  const isWolf = state.myRole && state.myRole.team === "evil";
  wolfOption.classList.toggle("hidden", !isWolf);
  wolfOption.disabled = !isWolf;
  loverOption.classList.toggle("hidden", !state.isLover);
  loverOption.disabled = !state.isLover;

  select.classList.toggle("hidden", !isWolf && !state.isLover);
}

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

  const loverNote = document.getElementById("role-lover-note");
  if (role.isLover && role.loverPartnerName) {
    loverNote.textContent = `💕 Estas enamorado/a de ${role.loverPartnerName}. Si uno de los dos muere, el otro morira de pena. Si son los ultimos 2 supervivientes, ganan juntos.`;
    loverNote.classList.remove("hidden");
  } else {
    loverNote.classList.add("hidden");
  }

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
  updateChatChannelOptions();
  pushAnnouncement(`Tu rol ha cambiado. Ahora eres: ${role.roleName}.`, "🐺");
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

function pushAnnouncement(text, icon) {
  const currentText = document.getElementById("announcement-text").textContent;
  const currentIcon = document.getElementById("announcement-icon").textContent;

  if (currentText && currentText !== "Bienvenido a la partida.") {
    state.announcementHistory.unshift({ text: currentText, icon: currentIcon });
    state.announcementHistory = state.announcementHistory.slice(0, 4);
  }

  document.getElementById("announcement-text").textContent = text;
  document.getElementById("announcement-icon").textContent = icon || "📢";

  const currentBox = document.getElementById("announcement-current");
  currentBox.classList.remove("pulse");
  requestAnimationFrame(() => currentBox.classList.add("pulse"));

  renderAnnouncementHistory();
}

function renderAnnouncementHistory() {
  const container = document.getElementById("announcement-history");
  container.innerHTML = "";
  state.announcementHistory.forEach((item) => {
    const row = document.createElement("div");
    row.className = "announcement-history-item";
    row.innerHTML = `<span>${item.icon}</span><span>${item.text}</span>`;
    container.appendChild(row);
  });
}

let phaseInterval = null;

socket.on("phase_change", ({ phase, dayNumber, durationMs }) => {
  showScreen("screen-game");
  document.getElementById("day-number").textContent = phase === "starting" ? "Preparando..." : `Dia ${dayNumber}`;

  const labels = { starting: "⏳ Preparando", night: "🌙 Noche", day: "☀️ Debate", voting: "🗳️ Votacion" };
  document.getElementById("phase-label").textContent = labels[phase] || phase;

  document.getElementById("action-confirm-modal").classList.add("hidden");

  if (phase === "voting") {
    const validIds = (state.currentPlayers || [])
      .filter((p) => p.alive && p.id !== socket.id)
      .map((p) => p.id);
    setPendingAction({ type: "vote", label: "Votar por", validTargetIds: validIds, excludeSelf: true });
  } else if (phase !== "night" && phase !== "day") {
    clearPendingAction();
  }

  if (phase === "night" && state.myRole && state.myRole.team === "evil") {
    state.wolfVoteTally = {};
  }

  startPhaseTimer(durationMs);
});

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
  if (!targets || targets.length === 0) {
    clearPendingAction();
    pushAnnouncement(
      role === "necromancer"
        ? "No hay ningun jugador bueno muerto todavia para que el Necromancer lo reviva."
        : `${roleName}: no hay objetivos validos para tu habilidad esta noche.`,
      "🌙"
    );
    return;
  }

  const validIds = targets.map((t) => t.id);
  setPendingAction({
    type: "night",
    label: isOnce ? `${roleName} (habilidad unica): usar en` : `${roleName}: usar habilidad en`,
    validTargetIds: validIds,
    excludeSelf: false,
    isWolfVote: !!isWolfVote,
  });

  if (isWolfVote) {
    showWolfVoteView();
  }
});

function showWolfVoteView() {
  renderWolfVoteTally();
}

socket.on("wolf_vote_tally", ({ tally }) => {
  state.wolfVoteTally = tally || {};
  renderWolfVoteTally();
  updateVoteBadges();
});

function renderWolfVoteTally() {
  if (!state.wolfVoteTally) return;
  const entries = Object.entries(state.wolfVoteTally);
  if (entries.length === 0) return;
  const summary = entries.map(([targetId, count]) => {
    const target = (state.currentPlayers || []).find((p) => p.id === targetId);
    return `${target ? target.name : "?"}: ${count}`;
  }).join(", ");
  pushAnnouncement(`🐺 Voto de los lobos: ${summary}`, "🐺");
}

socket.on("night_action_result", (result) => {
  if (result.type === "seer_result") {
    pushAnnouncement(`(privado) Investigaste a ${result.targetName}: es del bando ${result.alignment}.`, "🔮");
  }
  if (result.type === "mystic_reveal") {
    pushAnnouncement(`(privado) El Mystic descubre que ese jugador es: ${result.roleName}.`, "🧿");
  }
  if (result.type === "bard_exchange") {
    pushAnnouncement(`(privado) Intercambio de informacion: ${result.targetName} es ${result.targetRoleName}.`, "🎵");
  }
});

socket.on("day_action_request", ({ role, roleName, targets }) => {
  if (!targets || targets.length === 0) {
    clearPendingAction();
    pushAnnouncement(`${roleName}: no hay objetivos validos para tu habilidad en este momento.`, "☀️");
    return;
  }

  const validIds = targets.map((t) => t.id);
  setPendingAction({
    type: "day",
    label: `${roleName} (habilidad unica): usar en`,
    validTargetIds: validIds,
    excludeSelf: false,
  });
});

socket.on("day_action_rejected", ({ message }) => {
  pushAnnouncement(message, "⚠️");
});

socket.on("vote_tally", ({ tally }) => {
  state.voteTally = tally || {};
  updateVoteBadges();
});

function updateVoteBadges() {
  document.querySelectorAll(".player-token").forEach((token) => {
    const pid = token.dataset.playerId;
    const badge = token.querySelector('[data-role="voteBadge"]');
    if (!badge) return;
    const count = state.voteTally && state.voteTally[pid];
    if (count) {
      badge.textContent = count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  });
}

document.getElementById("btn-send-chat").addEventListener("click", sendChat);
document.getElementById("chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

function sendChat() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;

  const channel = document.getElementById("chat-channel-select").value;

  if (channel === "wolf") {
    socket.emit("wolf_chat_message", { code: state.code, text });
  } else if (channel === "lover") {
    socket.emit("lover_chat_message", { code: state.code, text });
  } else {
    socket.emit("chat_message", { code: state.code, text });
  }

  input.value = "";
}

socket.on("chat_message", (msg) => {
  const kind = msg.wolfOnly ? "wolf" : (msg.loverOnly ? "lover" : (msg.author === "Sistema" ? "system" : "public"));
  addChatLine(msg.author, msg.text, kind);

  if (kind === "system") {
    pushAnnouncement(msg.text, pickAnnouncementIcon(msg.text));
    return;
  }

  const bubble = document.getElementById("chat-bubble");
  bubble.className = "chat-bubble " + (kind === "wolf" ? "wolf-bubble" : kind === "lover" ? "lover-bubble" : "");
  const prefix = kind === "wolf" ? "🐺 " : kind === "lover" ? "💕 " : "";
  document.getElementById("chat-bubble-author").textContent = prefix + msg.author + ":";
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
  if (text.includes("Amantes") || text.includes("Cupido")) return "💕";
  return "📢";
}

document.getElementById("chat-bubble").addEventListener("click", () => {
  document.getElementById("chat-history-drawer").classList.remove("hidden");
});

document.getElementById("btn-close-chat-history").addEventListener("click", () => {
  document.getElementById("chat-history-drawer").classList.add("hidden");
});

function addChatLine(author, text, kind) {
  const log = document.getElementById("chat-log");
  const div = document.createElement("div");
  div.className = "msg" + (kind === "system" ? " system" : kind === "wolf" ? " wolf-msg" : kind === "lover" ? " lover-msg" : "");
  const prefix = kind === "wolf" ? "🐺 " : kind === "lover" ? "💕 " : "";
  div.innerHTML = kind === "system" ? text : `<span class="author">${prefix}${author}:</span> ${text}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

socket.on("game_over", ({ winner, roles }) => {
  clearInterval(phaseInterval);
  const titles = {
    good: "🎉 El pueblo ha ganado",
    evil: "🐺 Los lobos han ganado",
    jester: "🏏 El Jester ha ganado",
    lovers: "💕 Los Amantes han ganado",
  };
  document.getElementById("end-title").textContent = titles[winner] || "Partida terminada";

  const container = document.getElementById("end-roles-cards");
  container.innerHTML = "";

  roles.forEach((r) => {
    const roleId = r.roleId || null;
    const card = document.createElement("div");
    card.className = "mini-role-card" + (r.team === "evil" ? " card-evil" : " card-good") + (r.isLover ? " card-lover" : "");

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
    label.innerHTML = `<strong>${r.name}</strong>${r.isLover ? " 💕" : ""}<br>${r.role}`;

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
