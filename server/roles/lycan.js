// server/roles/lycan.js
module.exports = {
  id: "lycan",
  name: "Lycan",
  team: "good",
  description: "Parece un lobo para la Seer, pero es del pueblo. Si los lobos lo matan de noche, en vez de morir se convierte en lobo.",
  hasNightAction: false,

  onWolfKillInsteadOfDeath(game, playerId) {
    game.players[playerId].role = require("./werewolf");
    return { type: "lycan_turned", playerId };
  },
};
