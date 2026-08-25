// client/js/roleAssets.js
// Mapa central de assets visuales por rol. Si la imagen no carga (404), se usa el
// emoji y color de fallback definidos aqui, para que la interfaz nunca se rompa.
//
// Para agregar las imagenes reales: coloca los archivos en client/images/roles/
// con el nombre exacto "<role_id>.webp" (ej. werewolf.webp, alpha_wolf.webp, etc.)
// Si tus imagenes tienen otra extension, cambia IMAGE_EXTENSION mas abajo.

const IMAGE_EXTENSION = "webp";
const IMAGE_BASE_PATH = "images/roles";

const ROLE_ASSETS = {
  villager:     { emoji: "🧑‍🌾", color: "#3a5a40" },
  seer:         { emoji: "🔮", color: "#4361ee" },
  doctor:       { emoji: "⚕️", color: "#2a9d8f" },
  werewolf:     { emoji: "🐺", color: "#7a1f2b" },
  alpha_wolf:   { emoji: "🐺", color: "#5c0f1a" },
  vampire:      { emoji: "🧛", color: "#4a0e2b" },
  witch:        { emoji: "🧙", color: "#3d1e6d" },
  siren:        { emoji: "🧜‍♀️", color: "#0a5c6e" },
  shapeshifter: { emoji: "👻", color: "#2d2d44" },
  nightmare:    { emoji: "💀", color: "#1a1a2e" },
  wolf_shaman:  { emoji: "🪶", color: "#4a3319" },
  knight:       { emoji: "🛡️", color: "#4a4a6a" },
  princess:     { emoji: "👑", color: "#c9184a" },
  hunter:       { emoji: "🏹", color: "#4a3319" },
  necromancer:  { emoji: "☠️", color: "#2c003e" },
  king:         { emoji: "👑", color: "#a17d1f" },
  jester:       { emoji: "🃏", color: "#7209b7" },
  lycan:        { emoji: "🐕", color: "#6a4a3a" },
  mayor:        { emoji: "🏛️", color: "#3a5a40" },
  assassin:     { emoji: "🗡️", color: "#212121" },
  town_crier:   { emoji: "📣", color: "#e07a5f" },
  lover:        { emoji: "💕", color: "#c9184a" },
  druid:        { emoji: "🌿", color: "#3a5a40" },
  mystic:       { emoji: "🯿", color: "#3d1e6d" },
  thief:        { emoji: "🥷", color: "#4a4a4a" },
  courtesan:    { emoji: "🎭", color: "#8a2846" },
  bard:         { emoji: "🎵", color: "#e07a5f" },
};

function getRoleImageUrl(roleId) {
  return `${IMAGE_BASE_PATH}/${roleId}.${IMAGE_EXTENSION}`;
}

function getRoleAsset(roleId) {
  return ROLE_ASSETS[roleId] || { emoji: "❓", color: "#333" };
}

function applyRoleCardVisual(imgEl, fallbackEl, emojiEl, roleId) {
  const asset = getRoleAsset(roleId);
  imgEl.src = getRoleImageUrl(roleId);
  imgEl.classList.remove("hidden");
  fallbackEl.classList.add("hidden");
  fallbackEl.style.background = asset.color;

  imgEl.onerror = () => {
    imgEl.classList.add("hidden");
    fallbackEl.classList.remove("hidden");
    emojiEl.textContent = asset.emoji;
  };
}
