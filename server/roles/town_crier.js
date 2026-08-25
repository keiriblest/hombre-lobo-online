// server/roles/town_crier.js
module.exports = {
  id: "town_crier",
  name: "Town Crier",
  team: "good",
  description: "Cada noche elige a un jugador. Si ese jugador muere despues, se revela publicamente su rol de inmediato.",
  hasNightAction: true,
  nightOrder: 25,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (!target) return null;
    game.nightState.townCrierWatchId = targetPlayerId;
    return { type: "town_crier_confirm", targetId: targetPlayerId, targetName: target.name };
  },
};
