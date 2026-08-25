// server/roles/mayor.js
module.exports = {
  id: "mayor",
  name: "Mayor",
  team: "good",
  description: "Su voto durante la votacion diurna cuenta doble.",
  hasNightAction: false,
  dayVoteWeight: 2,
};
