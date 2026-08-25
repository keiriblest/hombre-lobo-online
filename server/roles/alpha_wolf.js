// server/roles/alpha_wolf.js
module.exports = {
  id: "alpha_wolf",
  name: "Alpha Wolf",
  team: "evil",
  description: "Lidera a la manada. Vota junto a los demas lobos para elegir victima, pero la Seer lo ve como bueno.",
  hasNightAction: true,
  nightOrder: 40,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.wolfVotes[actingPlayerId] = targetPlayerId;
    return { type: "wolf_vote_registered", targetId: targetPlayerId };
  },
};
