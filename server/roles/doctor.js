// server/roles/doctor.js
module.exports = {
  id: "doctor",
  name: "Doctor",
  team: "good",
  description: "Cada noche elige a un jugador (puede ser el mismo) para protegerlo de un ataque de los lobos.",
  hasNightAction: true,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    game.nightState.protectedPlayerId = targetPlayerId;
    return { type: "doctor_confirm", targetId: targetPlayerId };
  },
};
