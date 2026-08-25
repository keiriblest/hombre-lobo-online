// server/roles/hunter.js
module.exports = {
  id: "hunter",
  name: "Hunter",
  team: "good",
  description: "Si muere de noche, tiene 75% de probabilidad de disparar y matar a un jugador malo al azar.",
  hasNightAction: false,

  onDeathNight(game, deadPlayerId) {
    if (Math.random() >= 0.75) return null;
    const evilAlive = game.alivePlayers().filter((p) => p.role.team === "evil" && p.id !== deadPlayerId);
    if (evilAlive.length === 0) return null;
    const victim = evilAlive[Math.floor(Math.random() * evilAlive.length)];
    return { type: "hunter_shot", targetId: victim.id, targetName: victim.name };
  },
};
