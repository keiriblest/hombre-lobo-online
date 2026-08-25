// server/roles/thief.js
module.exports = {
  id: "thief",
  name: "Thief",
  team: "good",
  description: "Cada noche puede robar el voto de otro jugador: ese jugador no podra votar en la siguiente votacion diurna.",
  hasNightAction: true,
  nightOrder: 12,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.stolenVoteIds.add(targetPlayerId);
    return { type: "thief_steal", targetId: targetPlayerId };
  },
};
