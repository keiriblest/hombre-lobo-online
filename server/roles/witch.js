// server/roles/witch.js
module.exports = {
  id: "witch",
  name: "Witch",
  team: "evil",
  description: "Una vez por partida, durante el dia, puede revelar la carta de un jugador bueno frente a todos.",
  hasNightAction: false,
  hasDayActionOnce: true,

  resolveDayAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (!target || target.role.team !== "good") return null;
    return { type: "witch_reveal", targetId: targetPlayerId, targetName: target.name, roleName: target.role.name };
  },
};
