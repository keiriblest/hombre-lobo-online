// server/roles/assassin.js
module.exports = {
  id: "assassin",
  name: "Assassin",
  team: "good",
  description: "Una vez por partida, de noche, puede eliminar a cualquier jugador sin importar su rol.",
  hasNightAction: true,
  hasNightActionOnce: true,
  nightOrder: 60,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.assassinTargetId = targetPlayerId;
    return { type: "assassin_target", targetId: targetPlayerId };
  },
};
