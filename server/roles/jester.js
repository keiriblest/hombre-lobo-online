// server/roles/jester.js
module.exports = {
  id: "jester",
  name: "Jester",
  team: "good",
  description: "Solo gana la partida si el pueblo lo lincha o los lobos lo matan. La Seer lo ve al azar.",
  hasNightAction: false,
  winCondition: "must_be_eliminated",
};
