// server/roles/mystic.js
module.exports = {
  id: "mystic",
  name: "Mystic",
  team: "good",
  description: "Cada noche puede señalar a un jugador inactivo (AFK) y descubrir su rol para ayudar a que la partida avance.",
  hasNightAction: true,
  nightOrder: 10,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (!target) return null;
    return { type: "mystic_reveal", targetId: targetPlayerId, roleName: target.role.name };
  },
};
