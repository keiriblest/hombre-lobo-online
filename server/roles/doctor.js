// server/roles/doctor.js
module.exports = {
  id: "doctor",
  name: "Doctor",
  team: "good",
  description: "Cada noche elige a un jugador (puede ser el mismo) para protegerlo de un ataque de los lobos.",
  hasNightAction: true,
  nightOrder: 30,

  resolveNightAction(game, actingPlayerId, targetPlayerId) {
    if (game.nightState.doctorBlocked) {
      return { type: "doctor_blocked" };
    }
    game.nightState.protectedPlayerIds.add(targetPlayerId);
    return { type: "doctor_confirm", targetId: targetPlayerId };
  },
};
