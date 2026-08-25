// client/js/main.js
const socket = io();

let state = {
  code: null,
  playerName: null,
  isHost: false,
  myRole: null,
  currentPlayers: [],
};

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

document.getElementById("btn-create").addEventListener("click", () => {
  const name = document.getElementById("input-name").value.trim();
  if (!name) return showLobbyError("Escribe tu nombre.");
  state.playerName = name;

  socket.emit("create_room", { playerName: name }, (res) => {
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

  socket.emit("join_room", { code, playerName: name }, (res) => {
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
  showScreen("screen-room");
}

document.getElementById("btn-start").addEventListener("click", () => {
  socket.emit("start_game", { code: state.code });
});

socket.on("player_list", (players) => {
  renderPlayerList(document.getElementById("player-list"), players);
  renderPlayerList(document.getElementById("game-player-list"), players);
  state.currentPlayers = players;

  const startBtn = document.getElementById("btn-start");
  if (state.isHost) {
    startBtn.disabled = players.length < 4;
    startBtn.textContent = players.length < 4
      ? `Esperando jugadores (${players.length}/4 min.)`
      : "Iniciar partida";
  }
});

function renderPlayerList(ul, players) {
  ul.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    if (!p.alive) li.classList.add("dead");
    li.innerHTML = `<span>${p.name}${p.id === socket.id ? " (tu)" : ""}</span><span>${p.alive ? "🟢" : "💀"}</span>`;
    ul.appendChild(li);
  });
}

socket.on("role_assigned", (role) => {
  state.myRole = role;
  document.getElementById("role-name").textContent = `${role.roleName} (${role.team === "evil" ? "Malo" : "Bueno"})`;
  document.getElementById("role-description").textContent = role.description;
  document.getElementById("wolf-chat-panel").classList.toggle("hidden", role.team !== "evil");
  showScreen("screen-role");
});

socket.on("role_changed", (role) => {
  state.myRole = role;
  addSystemChatLine(`Tu rol ha cambiado. Ahora eres: ${role.roleName}.`);
});

document.getElementById("btn-continue-role").addEventListener("click", () => {
  showScreen("screen-game");
});

let phaseInterval = null;

socket.on("phase_change", ({ phase, dayNumber, durationMs }) => {
  showScreen("screen-game");
  document.getElementById("day-number").textContent = `Dia ${dayNumber}`;

  const labels = { night: "🌙 Noche", day: "☀️ Debate", voting: "🗳️ Votacion" };
  document.getElementById("phase-label").textContent = labels[phase] || phase;

  document.getElementById("night-panel").classList.toggle("hidden", phase !== "night");
  document.getElementById("voting-panel").classList.toggle("hidden", phase !== "voting");
  document.getElementById("day-action-panel").classList.toggle("hidden", phase !== "day" || !state.myRole || !state.myRole.hasDayActionOnce);

  const wolfPanel = document.getElementById("wolf-chat-panel");
  if (wolfPanel) wolfPanel.classList.toggle("hidden", !(state.myRole && state.myRole.team === "evil" && phase === "night"));

  if (phase !== "night") {
    document.getElementById("night-targets").innerHTML = "";
    document.getElementById("night-wait-msg").classList.add("hidden");
  }
  if (phase === "voting") renderVotingTargets();
  if (phase === "day") renderDayActionTargets();

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

socket.on("night_action_request", ({ role, roleName, targets, isOnce }) => {
  document.getElementById("night-action-title").textContent = isOnce
    ? `${roleName}: elige tu objetivo (habilidad unica, solo puedes usarla una vez)`
    : `${roleName}: elige tu objetivo`;
  const container = document.getElementById("night-targets");
  container.innerHTML = "";
  document.getElementById("night-wait-msg").classList.remove("hidden");

  targets.forEach((t) => {
    const btn = document.createElement("div");
    btn.className = "target-btn";
    btn.textContent = t.name;
    btn.addEventListener("click", () => {
      container.querySelectorAll(".target-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      socket.emit("night_action", { code: state.code, targetId: t.id });
    });
    container.appendChild(btn);
  });
});

socket.on("night_action_result", (result) => {
  if (result.type === "seer_result") {
    addSystemChatLine(`(privado) Investigaste a ${result.targetName}: es del bando ${result.alignment}.`);
  }
  if (result.type === "mystic_reveal") {
    addSystemChatLine(`(privado) El Mystic descubre que ese jugador es: ${result.roleName}.`);
  }
  if (result.type === "bard_exchange") {
    addSystemChatLine(`(privado) Intercambio de informacion: ${result.targetName} es ${result.targetRoleName}.`);
  }
});

function renderVotingTargets() {
  const container = document.getElementById("voting-targets");
  container.innerHTML = "";
  (state.currentPlayers || [])
    .filter((p) => p.alive)
    .forEach((p) => {
      const btn = document.createElement("div");
      btn.className = "target-btn";
      btn.textContent = p.name;
      btn.addEventListener("click", () => {
        container.querySelectorAll(".target-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        socket.emit("day_vote", { code: state.code, targetId: p.id });
      });
      container.appendChild(btn);
    });
}

function renderDayActionTargets() {
  if (!state.myRole || !state.myRole.hasDayActionOnce) return;
  const container = document.getElementById("day-action-targets");
  container.innerHTML = "";
  (state.currentPlayers || [])
    .filter((p) => p.alive && p.id !== socket.id)
    .forEach((p) => {
      const btn = document.createElement("div");
      btn.className = "target-btn";
      btn.textContent = p.name;
      btn.addEventListener("click", () => {
        container.querySelectorAll(".target-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        socket.emit("day_action", { code: state.code, targetId: p.id });
      });
      container.appendChild(btn);
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
  socket.emit("chat_message", { code: state.code, text });
  input.value = "";
}

socket.on("chat_message", (msg) => {
  const log = document.getElementById("chat-log");
  const div = document.createElement("div");
  div.className = "msg" + (msg.author === "Sistema" ? " system" : "");
  div.innerHTML = `<span class="author">${msg.author}:</span> ${msg.text}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
});

function addSystemChatLine(text) {
  const log = document.getElementById("chat-log");
  const div = document.createElement("div");
  div.className = "msg system";
  div.textContent = text;
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
  if (!log) return;
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<span class="author">${msg.author}:</span> ${msg.text}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
});

socket.on("game_over", ({ winner, roles }) => {
  clearInterval(phaseInterval);
  document.getElementById("end-title").textContent =
    winner === "good" ? "🎉 El pueblo ha ganado" : "🐺 Los lobos han ganado";

  const ul = document.getElementById("end-roles");
  ul.innerHTML = "";
  roles.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = `${r.name} - ${r.role}`;
    ul.appendChild(li);
  });

  showScreen("screen-end");
});

document.getElementById("btn-back-lobby").addEventListener("click", () => {
  window.location.reload();
});
