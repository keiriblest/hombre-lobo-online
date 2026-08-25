// server/roles/wolf_shaman.js
module.exports = {
  id: "wolf_shaman",
  name: "Wolf Shaman",
  team: "evil",
  description: "Una vez por partida puede proteger a un jugador malo de ser linchado durante la votacion del dia.",
  hasNightAction: false,
  hasDayActionOnce: true,

  resolveDayAction(game, actingPlayerId, targetPlayerId) {
    const target = game.players[targetPlayerId];
    if (!target || target.role.team !== "evil") return null;
    game.dayState = game.dayState || {};
    game.dayState.lynchImmuneId = targetPlayerId;
    return { type: "wolf_shaman_protect", targetId: targetPlayerId };
  },
};
