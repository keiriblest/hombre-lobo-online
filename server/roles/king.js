// server/roles/king.js
module.exports = {
  id: "king",
  name: "King",
  team: "good",
  description: "Inmune de noche mientras vivan el Knight, la Princess o el Jester. Si es linchado, anula habilidades buenas la noche siguiente.",
  hasNightAction: false,

  isImmuneAtNight(game) {
    return game.alivePlayers().some((p) => ["knight", "princess", "jester"].includes(p.role.id) && p.alive);
  },

  onLynch(game, playerId) {
    game.nightState.kingCurseActive = true;
  },
};
