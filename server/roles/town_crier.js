// server/roles/town_crier.js
module.exports = {
  id: "town_crier",
  name: "Town Crier",
  team: "good",
  description: "Cada noche elige a un jugador. Si ese jugador muere despues, se revela publicamente su rol de inmediato.",
  hasNightAction: true,
  nightOrder: 25,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.townCrierWatchId = targetPlayerId;
    return { type: "town_crier_confirm", targetId: targetPlayerId };
  },
};
