// server/roles/seer.js
module.exports = {
  id: "seer",
  name: "Seer",
  team: "good",
  description: "Cada noche puede investigar a un jugador y descubrir si es del bando de los lobos o del pueblo.",
  hasNightAction: true,
  nightOrder: 20,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (!target) return null;
    let alignment = target.role.team === "evil" ? "malo" : "bueno";
    if (target.role.id === "shapeshifter") alignment = "bueno";
    if (target.role.id === "vampire") alignment = Math.random() < 0.5 ? "bueno" : "malo";
    if (target.role.id === "jester") alignment = Math.random() < 0.5 ? "bueno" : "malo";
    return {
      type: "seer_result",
      targetId: targetPlayerId,
      targetName: target.name,
      alignment,
    };
  },
};
