// server/roles/bard.js
module.exports = {
  id: "bard",
  name: "Bard",
  team: "good",
  description: "Cada noche elige a un jugador para intercambiar informacion: ambos descubren el rol del otro.",
  hasNightAction: true,
  nightOrder: 8,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (!target) return null;
    return {
      type: "bard_exchange",
      targetId: targetPlayerId,
      targetName: target.name,
      targetRoleName: target.role.name,
    };
  },
};
