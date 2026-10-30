globalThis.GH_MONSTER_STATS = {
  guard: [
    {
      level: 0,
      normal: {
        health: 5,
        move: 2,
        attack: 2,
        range: 0,
        attributes: [],
      },
      elite: {
        health: 9,
        move: 2,
        attack: 3,
        range: 0,
        attributes: [],
      },
    },
    {
      level: 1,
      normal: {
        health: 6,
        move: 3,
        attack: 2,
        range: 0,
        attributes: [],
      },
      elite: {
        health: 9,
        move: 2,
        attack: 3,
        range: 0,
        attributes: ["%shield% 1"],
      },
    },
    {
      level: 2,
      normal: {
        health: 6,
        move: 3,
        attack: 3,
        range: 0,
        attributes: [],
      },
      elite: {
        health: 10,
        move: 2,
        attack: 4,
        range: 0,
        attributes: ["%shield% 1"],
      },
    },
    {
      level: 3,
      normal: {
        health: 9,
        move: 3,
        attack: 3,
        range: 0,
        attributes: [],
      },
      elite: {
        health: 10,
        move: 3,
        attack: 4,
        range: 0,
        attributes: ["%shield% 2"],
      },
    },
  ],
  archer: [
    {
      level: 0,
      normal: {
        health: 4,
        move: 2,
        attack: 2,
        range: 3,
        attributes: [],
      },
      elite: {
        health: 6,
        move: 2,
        attack: 3,
        range: 3,
        attributes: [],
      },
    },
    {
      level: 1,
      normal: {
        health: 5,
        move: 2,
        attack: 2,
        range: 4,
        attributes: [],
      },
      elite: {
        health: 7,
        move: 2,
        attack: 3,
        range: 5,
        attributes: [],
      },
    },
    {
      level: 2,
      normal: {
        health: 6,
        move: 3,
        attack: 2,
        range: 4,
        attributes: [],
      },
      elite: {
        health: 9,
        move: 3,
        attack: 3,
        range: 5,
        attributes: [],
      },
    },
    {
      level: 3,
      normal: {
        health: 6,
        move: 3,
        attack: 3,
        range: 4,
        attributes: [],
      },
      elite: {
        health: 10,
        move: 3,
        attack: 4,
        range: 5,
        attributes: [],
      },
    },
  ],
  bones: [
    {
      level: 0,
      normal: {
        health: 5,
        move: 2,
        attack: 1,
        range: 0,
        attributes: ["%target% 2"],
      },
      elite: {
        health: 6,
        move: 4,
        attack: 2,
        range: 0,
        attributes: ["%target% 2"],
      },
    },
    {
      level: 1,
      normal: {
        health: 5,
        move: 3,
        attack: 1,
        range: 0,
        attributes: ["%target% 2", "%shield% 1"],
      },
      elite: {
        health: 6,
        move: 4,
        attack: 2,
        range: 0,
        attributes: ["%target% 3", "%shield% 1"],
      },
    },
    {
      level: 2,
      normal: {
        health: 5,
        move: 3,
        attack: 2,
        range: 0,
        attributes: ["%target% 2", "%shield% 1"],
      },
      elite: {
        health: 7,
        move: 4,
        attack: 3,
        range: 0,
        attributes: ["%target% 3", "%shield% 1"],
      },
    },
    {
      level: 3,
      normal: {
        health: 7,
        move: 3,
        attack: 2,
        range: 0,
        attributes: ["%target% 2", "%shield% 1"],
      },
      elite: {
        health: 10,
        move: 4,
        attack: 3,
        range: 0,
        attributes: ["%target% 3", "%shield% 1"],
      },
    },
  ],
};
if (typeof module !== "undefined") module.exports = globalThis.GH_MONSTER_STATS;
