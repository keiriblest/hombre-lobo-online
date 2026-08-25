// server/roles/index.js
// Registro central de los 27 roles del juego.
const villager = require("./villager");
const seer = require("./seer");
const doctor = require("./doctor");
const werewolf = require("./werewolf");
const alpha_wolf = require("./alpha_wolf");
const vampire = require("./vampire");
const witch = require("./witch");
const siren = require("./siren");
const shapeshifter = require("./shapeshifter");
const nightmare = require("./nightmare");
const wolf_shaman = require("./wolf_shaman");
const knight = require("./knight");
const princess = require("./princess");
const hunter = require("./hunter");
const necromancer = require("./necromancer");
const king = require("./king");
const jester = require("./jester");
const lycan = require("./lycan");
const mayor = require("./mayor");
const assassin = require("./assassin");
const town_crier = require("./town_crier");
const lover = require("./lover");
const druid = require("./druid");
const mystic = require("./mystic");
const thief = require("./thief");
const courtesan = require("./courtesan");
const bard = require("./bard");

const ROLES = {
  villager, seer, doctor, werewolf,
  alpha_wolf, vampire, witch, siren, shapeshifter, nightmare, wolf_shaman,
  knight, princess, hunter, necromancer, king, jester, lycan, mayor,
  assassin, town_crier, lover, druid, mystic, thief, courtesan, bard,
};

const EVIL_ROLE_IDS = [
  "werewolf", "werewolf", "alpha_wolf", "vampire", "witch",
  "siren", "shapeshifter", "nightmare", "wolf_shaman",
];

const GOOD_ROLE_IDS = [
  "seer", "doctor", "knight", "princess", "hunter", "necromancer",
  "king", "jester", "lycan", "mayor", "assassin", "town_crier",
  "lover", "lover", "druid", "mystic", "thief", "courtesan", "bard",
];

module.exports = { ROLES, EVIL_ROLE_IDS, GOOD_ROLE_IDS };
