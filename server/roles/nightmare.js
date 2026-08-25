// server/roles/nightmare.js
module.exports = {
  id: "nightmare",
  name: "Nightmare",
  team: "evil",
  description: "Cada noche puede sumir a un jugador en un sueño profundo, anulando su habilidad esa noche.",
  hasNightAction: true,
  nightOrder: 1,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.disabledPlayerIds.add(targetPlayerId);
    return { type: "nightmare_sleep", targetId: targetPlayerId };
  },
};
