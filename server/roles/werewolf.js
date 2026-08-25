// server/roles/werewolf.js
module.exports = {
  id: "werewolf",
  name: "Hombre Lobo",
  team: "evil",
  description: "Cada noche, junto a los demas lobos, vota para elegir una victima. Debe pasar desapercibido de dia.",
  hasNightAction: true,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.wolfVotes[actingPlayerId] = targetPlayerId;
    return { type: "wolf_vote_registered", targetId: targetPlayerId };
  },
};
