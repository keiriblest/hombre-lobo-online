// server/roles/siren.js
module.exports = {
  id: "siren",
  name: "Siren",
  team: "evil",
  description: "Si es linchada de dia, anula las habilidades de todos los roles buenos la noche siguiente.",
  hasNightAction: false,

  onLynch(game, playerId) {
    game.nightState.sirenCurseActive = true;
  },
};
