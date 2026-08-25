// server/roles/index.js
const villager = require("./villager");
const seer = require("./seer");
const doctor = require("./doctor");
const werewolf = require("./werewolf");

const ROLES = {
  villager,
  seer,
  doctor,
  werewolf,
};

module.exports = ROLES;
