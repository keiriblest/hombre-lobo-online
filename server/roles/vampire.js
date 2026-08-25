// server/roles/vampire.js
module.exports = {
  id: "vampire",
  name: "Vampire",
  team: "evil",
  description: "De noche puede bloquear la habilidad del Doctor. Su voto de dia no cuenta (peso 0). La Seer lo ve al azar.",
  hasNightAction: true,
  nightOrder: 5,
  dayVoteWeight: 0,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (target && target.role.id === "doctor") {
      game.nightState.doctorBlocked = true;
    }
    return { type: "vampire_block", targetId: targetPlayerId };
  },
};
