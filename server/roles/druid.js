// server/roles/druid.js
module.exports = {
  id: "druid",
  name: "Druid",
  team: "good",
  description: "Cada noche puede vincular su vida a la de otro jugador: si el Druid muere, su vinculado tambien muere.",
  hasNightAction: true,
  nightOrder: 15,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.druidLinks[actingPlayerId] = targetPlayerId;
    return { type: "druid_link", targetId: targetPlayerId };
  },
};
