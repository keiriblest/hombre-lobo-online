// server/roles/courtesan.js
module.exports = {
  id: "courtesan",
  name: "Courtesan",
  team: "good",
  description: "Cada noche tienta a un jugador. Si esa persona era el objetivo de los lobos, la Courtesan muere en su lugar.",
  hasNightAction: true,
  nightOrder: 18,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.courtesanTarget = { actorId: actingPlayerId, targetId: targetPlayerId };
    return { type: "courtesan_tempt", targetId: targetPlayerId };
  },
};
