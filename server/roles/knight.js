// server/roles/knight.js
module.exports = {
  id: "knight",
  name: "Knight",
  team: "good",
  description: "Sobrevive automaticamente al primer ataque nocturno que reciba, una sola vez en la partida.",
  hasNightAction: false,
  passiveShieldOnce: true,
};
