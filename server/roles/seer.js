// server/roles/seer.js
module.exports = {
  id: "seer",
  name: "Vidente",
  team: "good",
  description: "Cada noche puede investigar a un jugador y descubrir si es del bando de los lobos o del pueblo.",
  hasNightAction: true,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (!target) return null;
    return {
      type: "seer_result",
      targetId: targetPlayerId,
      targetName: target.name,
      alignment: target.role.team === "evil" ? "malo" : "bueno",
    };
  },
};
