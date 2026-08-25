// server/roles/necromancer.js
module.exports = {
  id: "necromancer",
  name: "Necromancer",
  team: "good",
  description: "Una vez por partida puede revivir a un jugador bueno que haya muerto.",
  hasNightAction: true,
  hasNightActionOnce: true,
  nightOrder: 50,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    const target = game.deadPlayers ? game.deadPlayers[targetPlayerId] : null;
    if (!target || target.role.team !== "good") return null;
    game.nightState.revivedPlayerId = targetPlayerId;
    return { type: "necromancer_revive", targetId: targetPlayerId };
  },
};
