"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/utils/functionalGroups.ts
var functionalGroups_exports = {};
__export(functionalGroups_exports, {
  FUNCTIONAL_GROUPS: () => FUNCTIONAL_GROUPS,
  FUNCTIONAL_GROUP_CATEGORIES: () => FUNCTIONAL_GROUP_CATEGORIES,
  getFunctionalGroupById: () => getFunctionalGroupById
});
module.exports = __toCommonJS(functionalGroups_exports);
var BL = {
  CC: 1.54,
  // C-C
  CD: 1.34,
  // C=C
  CT: 1.2,
  // C≡C
  CO: 1.43,
  // C-O
  COD: 1.23,
  // C=O
  CN: 1.47,
  // C-N
  CND: 1.29,
  // C=N
  CNT: 1.16,
  // C≡N
  CS: 1.82,
  // C-S
  CSD: 1.56,
  // C=S
  CF: 1.35,
  // C-F
  CCl: 1.77,
  // C-Cl
  CBr: 1.94,
  // C-Br
  CI: 2.14,
  // C-I
  CP: 1.84,
  // C-P
  CH: 1.09,
  // C-H
  OH: 0.96,
  // O-H
  NH: 1.01,
  // N-H
  SH: 1.34,
  // S-H
  PH: 1.44,
  // P-H
  NO: 1.21,
  // N=O (硝基)
  NN: 1.25,
  // N=N
  SO: 1.43,
  // S=O
  SO_S: 1.57,
  // S-O 单键
  PO: 1.5,
  // P-O
  OO: 1.48,
  // O-O
  NX: 1.47,
  // N 空头键参考长度
  OX: 1.43,
  // O 空头键参考长度
  SX: 1.82,
  // S 空头键参考长度
  PX: 1.84
  // P 空头键参考长度
};
var A120 = Math.PI * 2 / 3;
var cos120 = Math.cos(A120);
var sin120 = Math.sin(A120);
var NX = 1.47;
var OX = 1.43;
var SX = 1.82;
var PX = 1.84;
var FUNCTIONAL_GROUPS = [
  // ===== 烃类 =====
  {
    id: "alkene",
    name: "\u70EF\u57FA\uFF08C=C\uFF09",
    category: "\u70C3\u7C7B",
    formula: "-CH=CH\u2082",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      // 连接点（sp2）
      { idx: 1, symbol: "C", x: BL.CD, y: 0, z: 0 },
      // 双键碳（sp2）
      // C1 上的两个H：C1→C0 方向是 -x 方向（180°），sp2 键应间隔 120°，所以 H 在 +60° 和 -60° 方向
      // C-H 键长 1.09
      { idx: 2, symbol: "H", x: BL.CD + BL.CH * 0.5, y: BL.CH * 0.866, z: 0 },
      { idx: 3, symbol: "H", x: BL.CD + BL.CH * 0.5, y: -BL.CH * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
      { atom1Idx: 1, atom2Idx: 3, order: 1 }
    ],
    emptyBonds: [
      // C0（sp2）：双键沿 +x，空头键应在 -x 方向两侧的 120° 平面内
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: BL.CC * 0.866, z: 0 } },
      // 上空头键（60°方向）
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } }
      // 下空头键（-60°方向）
    ],
    connectionPoint: 0
  },
  {
    id: "alkyne",
    name: "\u7094\u57FA\uFF08C\u2261C\uFF09",
    category: "\u70C3\u7C7B",
    formula: "-C\u2261CH",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      // 连接点
      { idx: 1, symbol: "C", x: BL.CT, y: 0, z: 0 },
      // H 在 C1 周围 sp 直线方向（+x 方向）1.09 距离
      { idx: 2, symbol: "H", x: BL.CT + BL.CH, y: 0, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 3 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 }
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -BL.CC, y: 0, z: 0 } }
      // 空头键（sp杂化180°方向）
    ],
    connectionPoint: 0
  },
  {
    id: "phenyl",
    name: "\u82EF\u57FA",
    category: "\u70C3\u7C7B",
    formula: "-C\u2086H\u2085",
    // 苯基：6个C组成正六边形，所有C都是sp2（120°内角）
    // 边长=1.40（苯环C-C键长），C0是连接点，位于六边形的一个顶点
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "C", x: 0.7, y: 1.212, z: 0 },
      { idx: 2, symbol: "C", x: 2.1, y: 1.212, z: 0 },
      { idx: 3, symbol: "C", x: 2.8, y: 0, z: 0 },
      { idx: 4, symbol: "C", x: 2.1, y: -1.212, z: 0 },
      { idx: 5, symbol: "C", x: 0.7, y: -1.212, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      // C0=C1
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
      // C1-C2
      { atom1Idx: 2, atom2Idx: 3, order: 2 },
      // C2=C3
      { atom1Idx: 3, atom2Idx: 4, order: 1 },
      // C3-C4
      { atom1Idx: 4, atom2Idx: 5, order: 2 },
      // C4=C5
      { atom1Idx: 5, atom2Idx: 0, order: 1 }
      // C5-C0
    ],
    emptyBonds: [
      // C0（sp2）：=C1方向+60°（即 (0.7, 1.212) 方向），C5在-60°方向，空头键在180°方向（即正左方）
      { atomIdx: 0, order: 1, position: { x: -1.4, y: 0, z: 0 } }
    ],
    connectionPoint: 0
  },
  // ===== 含氧官能团 =====
  {
    id: "hydroxyl",
    name: "\u7F9F\u57FA\uFF08-OH\uFF09",
    category: "\u542B\u6C27",
    formula: "-OH",
    atoms: [
      { idx: 0, symbol: "O", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "H", x: BL.OH, y: 0, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 }
    ],
    emptyBonds: [
      // O(0)（sp3）：H 在 +x 方向，空头键应在与 H 成 109.5° 角的方向
      { atomIdx: 0, order: 1, position: { x: -OX * 0.333, y: OX * 0.943, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "ether",
    name: "\u919A\u952E\uFF08-O-\uFF09",
    category: "\u542B\u6C27",
    formula: "-O-",
    atoms: [
      { idx: 0, symbol: "O", x: 0, y: 0, z: 0 }
    ],
    bonds: [],
    emptyBonds: [
      // O(0)（sp3）：化合价 2，需要 2 个单键连接外部
      // 两个空头键应成 109.5° 角（sp3 四面体，另 2 个方向是孤对电子）
      // v1 = (0.943, -0.333, 0), v2 = (-0.471, -0.333, 0.816)
      { atomIdx: 0, order: 1, position: { x: OX * 0.943, y: -OX * 0.333, z: 0 } },
      { atomIdx: 0, order: 1, position: { x: -OX * 0.471, y: -OX * 0.333, z: OX * 0.816 } }
    ],
    connectionPoint: 0
  },
  {
    id: "aldehyde",
    name: "\u919B\u57FA\uFF08-CHO\uFF09",
    category: "\u542B\u6C27",
    formula: "-CHO",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "O", x: BL.COD, y: 0, z: 0 },
      // H 在 C0 周围 120° 方向 1.09 距离
      { idx: 2, symbol: "H", x: -BL.CH * 0.5, y: BL.CH * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 }
    ],
    emptyBonds: [
      // C0（sp2）：=O沿+x，H在120°方向，空头键在-120°方向
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "ketone",
    name: "\u7FB0\u57FA\uFF08>C=O\uFF09",
    category: "\u542B\u6C27",
    formula: ">C=O",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "O", x: BL.COD, y: 0, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 }
    ],
    emptyBonds: [
      // C0（sp2）：=O沿+x，两个空头键在 -x 两侧 120° 方向
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: BL.CC * 0.866, z: 0 } },
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "carboxyl",
    name: "\u7FA7\u57FA\uFF08-COOH\uFF09",
    category: "\u542B\u6C27",
    formula: "-COOH",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "O", x: BL.COD, y: 0, z: 0 },
      // =O
      { idx: 2, symbol: "O", x: -BL.CO * 0.5, y: BL.CO * 0.866, z: 0 },
      // -OH (sp2平面内, 120°)
      // H3: O2 是 sp3 109.5°，H 应在 O2→C0 方向 109.5° 处
      // O2→C0 方向 = (0.5, -0.866, 0)，旋转 +109.5°（逆时针）后 = (cos 49.5°, sin 49.5°)
      { idx: 3, symbol: "H", x: -BL.CO * 0.5 + BL.OH * 0.649, y: BL.CO * 0.866 + BL.OH * 0.76, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 }
    ],
    emptyBonds: [
      // C0（sp2）：=O沿+x，-OH在120°方向，空头键在-120°方向
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "ester",
    name: "\u916F\u57FA\uFF08-COO-\uFF09",
    category: "\u542B\u6C27",
    formula: "-COO-",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "O", x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: "O", x: -BL.CO * 0.5, y: BL.CO * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 }
    ],
    emptyBonds: [
      // C0（sp2）：=O沿+x，-O2在120°方向，空头键在-120°方向
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } },
      // O2（sp3）：-C0在-60°方向（相对O2），空头键应在与C0成109.5°角的方向
      // O2→C0 方向 = (0.5, -0.866, 0)，旋转 109.5° 后 = (cos 49.5°, sin 49.5°, 0) = (0.649, 0.760, 0)
      { atomIdx: 2, order: 1, position: { x: -BL.CO * 0.5 + OX * 0.649, y: BL.CO * 0.866 + OX * 0.76, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "acyl_chloride",
    name: "\u9170\u5364\u57FA\uFF08-COCl\uFF09",
    category: "\u542B\u6C27",
    formula: "-COCl",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "O", x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: "Cl", x: -BL.CCl * 0.5, y: BL.CCl * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 }
    ],
    emptyBonds: [
      // C0（sp2）：=O沿+x，-Cl在120°方向，空头键在-120°方向
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "anhydride",
    name: "\u9178\u9150\u57FA\uFF08-COOCO-\uFF09",
    category: "\u542B\u6C27",
    formula: "-COOCO-",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "O", x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: "O", x: -BL.CO * 0.5, y: BL.CO * 0.866, z: 0 },
      // C3: O2 是 sp3，C0→O2 方向极角 120°，O2→C3 方向应与 O2→C0 方向成 109.5° 角
      // O2→C0 极角 -60°（即 (0.5, -0.866)），O2→C3 选极角 -60° - (180-109.5) = -130.5° 方向
      // 即 C3 在 O2 的左下方
      { idx: 3, symbol: "C", x: -BL.CO * 0.5 - BL.CO * 0.983, y: BL.CO * 0.866 - BL.CO * 0.182, z: 0 },
      // O4: C3 是 sp2，C3→O2 极角 10.5°，C3→O4 极角 = 10.5° + 120° = 130.5°
      { idx: 4, symbol: "O", x: -BL.CO * 0.5 - BL.CO * 0.983 - BL.COD * 0.647, y: BL.CO * 0.866 - BL.CO * 0.182 + BL.COD * 0.762, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
      { atom1Idx: 3, atom2Idx: 4, order: 2 }
    ],
    emptyBonds: [
      // C0（sp2）：=O沿+x，-O在120°方向，空头键在-120°方向
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } },
      // C3（sp2）：=O在130.5°方向，-O(2)在10.5°方向，空头键在10.5°-120°=-109.5°方向
      { atomIdx: 3, order: 1, position: { x: -BL.CO * 0.5 - BL.CO * 0.983 - BL.CC * 0.333, y: BL.CO * 0.866 - BL.CO * 0.182 - BL.CC * 0.943, z: 0 } }
    ],
    connectionPoint: 0
  },
  // ===== 含氮官能团 =====
  {
    id: "amino",
    name: "\u6C28\u57FA\uFF08-NH\u2082\uFF09",
    category: "\u542B\u6C2E",
    formula: "-NH\u2082",
    atoms: [
      { idx: 0, symbol: "N", x: 0, y: 0, z: 0 },
      // H1: 0°方向
      { idx: 1, symbol: "H", x: BL.NH, y: 0, z: 0 },
      // H2: 120°方向
      { idx: 2, symbol: "H", x: -BL.NH * 0.5, y: BL.NH * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 }
    ],
    emptyBonds: [
      // N0（sp2）：H1在0°，H2在120°，空头键在-120°方向
      { atomIdx: 0, order: 1, position: { x: -NX * 0.5, y: -NX * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "imino",
    name: "\u4E9A\u6C28\u57FA\uFF08=NH\uFF09",
    category: "\u542B\u6C2E",
    formula: "=NH",
    atoms: [
      { idx: 0, symbol: "N", x: 0, y: 0, z: 0 },
      // 连接点（双键）
      // N 是 sp2 平面（与 C=C 平面一致），H 与 =N 双键方向成 120° 角
      // 空头键（=N 双键）在 +x 方向，H 应在 120° 方向
      { idx: 1, symbol: "H", x: -BL.NH * 0.5, y: BL.NH * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 }
    ],
    // N: 双键到外部(=X) + H = 3，已满价
    // 1 个空头键（双键 order 2，沿 +x 方向，键长 1.29 = C=N 双键）
    emptyBonds: [
      { atomIdx: 0, order: 2, position: { x: BL.CND, y: 0, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "nitro",
    name: "\u785D\u57FA\uFF08-NO\u2082\uFF09",
    category: "\u542B\u6C2E",
    formula: "-NO\u2082",
    atoms: [
      { idx: 0, symbol: "N", x: 0, y: 0, z: 0 },
      // =O1: 0°方向
      { idx: 1, symbol: "O", x: BL.NO, y: 0, z: 0 },
      // =O2: 120°方向
      { idx: 2, symbol: "O", x: -BL.NO * 0.5, y: BL.NO * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 2 }
    ],
    emptyBonds: [
      // N0（sp2）：两个=O在 0° 和 120° 方向，空头键在 -120° 方向
      { atomIdx: 0, order: 1, position: { x: -NX * 0.5, y: -NX * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "cyano",
    name: "\u6C30\u57FA\uFF08-C\u2261N\uFF09",
    category: "\u542B\u6C2E",
    formula: "-C\u2261N",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      // 连接点
      { idx: 1, symbol: "N", x: BL.CNT, y: 0, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 3 }
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -BL.CC, y: 0, z: 0 } }
      // 空头键（sp杂化180°）
    ],
    connectionPoint: 0
  },
  {
    id: "amide",
    name: "\u9170\u80FA\u57FA\uFF08-CONH\u2082\uFF09",
    category: "\u542B\u6C2E",
    formula: "-CONH\u2082",
    atoms: [
      { idx: 0, symbol: "C", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "O", x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: "N", x: -BL.CN * 0.5, y: BL.CN * 0.866, z: 0 },
      // N2 是 sp2，三个键（C0, H3, H4）均匀 120° 分布
      // N2→C0 极角 -60°，H3 极角 60°，H4 极角 180°（相对N2本地坐标系）
      { idx: 3, symbol: "H", x: -BL.CN * 0.5 + BL.NH * 0.5, y: BL.CN * 0.866 + BL.NH * 0.866, z: 0 },
      { idx: 4, symbol: "H", x: -BL.CN * 0.5 - BL.NH, y: BL.CN * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
      { atom1Idx: 2, atom2Idx: 4, order: 1 }
    ],
    emptyBonds: [
      // C0（sp2）：=O沿+x，-N在120°方向，空头键在-120°方向
      { atomIdx: 0, order: 1, position: { x: -BL.CC * 0.5, y: -BL.CC * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "azo",
    name: "\u5076\u6C2E\u57FA\uFF08-N=N-\uFF09",
    category: "\u542B\u6C2E",
    formula: "-N=N-",
    atoms: [
      { idx: 0, symbol: "N", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "N", x: BL.NN, y: 0, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 }
    ],
    emptyBonds: [
      // N0（sp2）：=N1沿+x，空头键在120°方向
      { atomIdx: 0, order: 1, position: { x: -NX * 0.5, y: NX * 0.866, z: 0 } },
      // N1（sp2）：=N0沿-x（相对N1），空头键在N1的+60°方向（即上方向）
      // N0相对N1方向=180°，N1空头键方向 = 180° - 120° = 60° (相对N1本地x轴)
      { atomIdx: 1, order: 1, position: { x: BL.NN + NX * 0.5, y: NX * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "isocyanate",
    name: "\u5F02\u6C30\u9178\u916F\u57FA\uFF08-NCO\uFF09",
    category: "\u542B\u6C2E",
    formula: "-N=C=O",
    atoms: [
      { idx: 0, symbol: "N", x: 0, y: 0, z: 0 },
      { idx: 1, symbol: "C", x: BL.CND, y: 0, z: 0 },
      { idx: 2, symbol: "O", x: BL.CND + BL.COD, y: 0, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 1, atom2Idx: 2, order: 2 }
    ],
    emptyBonds: [
      // N0（sp2）：=C沿+x，空头键在120°方向
      { atomIdx: 0, order: 1, position: { x: -NX * 0.5, y: NX * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  },
  // ===== 含硫官能团 =====
  {
    id: "thiol",
    name: "\u5DEF\u57FA\uFF08-SH\uFF09",
    category: "\u542B\u786B",
    formula: "-SH",
    atoms: [
      { idx: 0, symbol: "S", x: 0, y: 0, z: 0 },
      // 连接点
      { idx: 1, symbol: "H", x: BL.SH, y: 0, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 }
    ],
    emptyBonds: [
      // S(0)（sp3）：H 在 +x 方向，空头键应在与 H 成 109.5° 角的方向
      { atomIdx: 0, order: 1, position: { x: -SX * 0.333, y: SX * 0.943, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "thioether",
    name: "\u786B\u919A\u952E\uFF08-S-\uFF09",
    category: "\u542B\u786B",
    formula: "-S-",
    atoms: [
      { idx: 0, symbol: "S", x: 0, y: 0, z: 0 }
    ],
    bonds: [],
    emptyBonds: [
      // S(0)（sp3）：化合价 2，需要 2 个单键连接外部
      // 两个空头键应成 109.5° 角（sp3 四面体，另 2 个方向是孤对电子）
      { atomIdx: 0, order: 1, position: { x: SX * 0.943, y: -SX * 0.333, z: 0 } },
      { atomIdx: 0, order: 1, position: { x: -SX * 0.471, y: -SX * 0.333, z: SX * 0.816 } }
    ],
    connectionPoint: 0
  },
  {
    id: "sulfonyl",
    name: "\u78FA\u9178\u57FA\uFF08-SO\u2083H\uFF09",
    category: "\u542B\u786B",
    formula: "-SO\u2083H",
    // S 是 sp3 四面体（4个键：=O, =O, -O, 空头键）
    // 4 个键方向用标准四面体几何（v1+v2+v3+v4 互相 109.5°）：
    //   v1 = (0, 1, 0)         → =O1
    //   v2 = (2√2/3, -1/3, 0)  → 空头键
    //   v3 = (-√2/3, -1/3, -√6/3) → =O2
    //   v4 = (-√2/3, -1/3, √6/3)  → -O3
    atoms: [
      { idx: 0, symbol: "S", x: 0, y: 0, z: 0 },
      // =O1 在 v1 方向 (+y)，S=O 键长 1.43
      { idx: 1, symbol: "O", x: 0, y: BL.SO, z: 0 },
      // =O2 在 v3 方向，S=O 键长 1.43
      { idx: 2, symbol: "O", x: -BL.SO * 0.471, y: -BL.SO * 0.333, z: -BL.SO * 0.816 },
      // -O3 在 v4 方向，S-O 单键长 1.57（不是 1.43）
      { idx: 3, symbol: "O", x: -BL.SO_S * 0.471, y: -BL.SO_S * 0.333, z: BL.SO_S * 0.816 },
      // H 在 O3 周围 sp3 109.5° 方向（沿 -y 轴，使 H 远离 S0）
      { idx: 4, symbol: "H", x: -BL.SO_S * 0.471, y: -BL.SO_S * 0.333 - BL.OH, z: BL.SO_S * 0.816 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 2 },
      { atom1Idx: 0, atom2Idx: 3, order: 1 },
      { atom1Idx: 3, atom2Idx: 4, order: 1 }
    ],
    emptyBonds: [
      // S(0) 第4个键在 v2 方向（空头键）
      { atomIdx: 0, order: 1, position: { x: SX * 0.943, y: -SX * 0.333, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "sulfoxide",
    name: "\u4E9A\u781C\u57FA\uFF08>S=O\uFF09",
    category: "\u542B\u786B",
    formula: ">S=O",
    // S 是 sp3 锥形（3 邻居 + 1 对孤对电子），3 个键成 109.5° 分布
    atoms: [
      { idx: 0, symbol: "S", x: 0, y: 0, z: 0 },
      // =O 在 +y 方向（v1）
      { idx: 1, symbol: "O", x: 0, y: BL.SO, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 }
    ],
    emptyBonds: [
      // S(0) 周围 3 个键：=O 在 v1, 空头键1 在 v2, 空头键2 在 v3
      // v2 = (2√2/3, -1/3, 0), v3 = (-√2/3, -1/3, -√6/3)
      { atomIdx: 0, order: 1, position: { x: SX * 0.943, y: -SX * 0.333, z: 0 } },
      { atomIdx: 0, order: 1, position: { x: -SX * 0.471, y: -SX * 0.333, z: -SX * 0.816 } }
    ],
    connectionPoint: 0
  },
  // ===== 含卤素官能团 =====
  {
    id: "fluoro",
    name: "\u6C1F\u4EE3\uFF08-F\uFF09",
    category: "\u542B\u5364\u7D20",
    formula: "-F",
    atoms: [
      { idx: 0, symbol: "F", x: 0, y: 0, z: 0 }
    ],
    bonds: [],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -BL.CF, y: 0, z: 0 } }
      // 空头键（在连接点方向）
    ],
    connectionPoint: 0
  },
  {
    id: "chloro",
    name: "\u6C2F\u4EE3\uFF08-Cl\uFF09",
    category: "\u542B\u5364\u7D20",
    formula: "-Cl",
    atoms: [
      { idx: 0, symbol: "Cl", x: 0, y: 0, z: 0 }
    ],
    bonds: [],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -BL.CCl, y: 0, z: 0 } }
      // 空头键（在连接点方向）
    ],
    connectionPoint: 0
  },
  {
    id: "bromo",
    name: "\u6EB4\u4EE3\uFF08-Br\uFF09",
    category: "\u542B\u5364\u7D20",
    formula: "-Br",
    atoms: [
      { idx: 0, symbol: "Br", x: 0, y: 0, z: 0 }
    ],
    bonds: [],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -BL.CBr, y: 0, z: 0 } }
      // 空头键（在连接点方向）
    ],
    connectionPoint: 0
  },
  {
    id: "iodo",
    name: "\u7898\u4EE3\uFF08-I\uFF09",
    category: "\u542B\u5364\u7D20",
    formula: "-I",
    atoms: [
      { idx: 0, symbol: "I", x: 0, y: 0, z: 0 }
    ],
    bonds: [],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -BL.CI, y: 0, z: 0 } }
      // 空头键（在连接点方向）
    ],
    connectionPoint: 0
  },
  // ===== 含磷官能团 =====
  {
    id: "phosphoester",
    name: "\u78F7\u9178\u916F\u57FA\uFF08-OPO\u2083H\u2082\uFF09",
    category: "\u542B\u78F7",
    formula: "-OPO\u2083H\u2082",
    // P 是 sp3 四面体，4 个键成 109.5° 分布
    // 4 个键方向（相对 P1 看出去）：
    //   v1 = (-1, 0, 0)            → O0
    //   v2 = (1/3, 2√2/3, 0)       → =O
    //   v3 = (1/3, -√2/3, √6/3)    → -OH
    //   v4 = (1/3, -√2/3, -√6/3)   → -OH
    // 每对方向夹角 = 109.5°
    atoms: [
      { idx: 0, symbol: "O", x: 0, y: 0, z: 0 },
      // 连接点
      { idx: 1, symbol: "P", x: BL.PO, y: 0, z: 0 },
      // =O4 在 v2 方向
      { idx: 4, symbol: "O", x: BL.PO + BL.PO * 0.333, y: BL.PO * 0.943, z: 0 },
      // O2(-OH) 在 v3 方向
      { idx: 2, symbol: "O", x: BL.PO + BL.PO * 0.333, y: -BL.PO * 0.471, z: BL.PO * 0.816 },
      // O3(-OH) 在 v4 方向
      { idx: 3, symbol: "O", x: BL.PO + BL.PO * 0.333, y: -BL.PO * 0.471, z: -BL.PO * 0.816 },
      // H5: O2 周围 sp3 109.5°，O2→H 与 O2→P1(= -v3) 方向夹角 109.5°
      // axisDir = P1→O2 = v3, direction · axisDir = +1/3 (cos 70.5°)
      // -v3 · (-v2) = v3·v2 = -0.333, arccos = 109.5° ✓
      // O2→H = -v2 = (-0.333, -0.943, 0)
      { idx: 5, symbol: "H", x: BL.PO + BL.PO * 0.333 - BL.OH * 0.333, y: -BL.PO * 0.471 - BL.OH * 0.943, z: BL.PO * 0.816 },
      // H6: 同理
      { idx: 6, symbol: "H", x: BL.PO + BL.PO * 0.333 - BL.OH * 0.333, y: -BL.PO * 0.471 - BL.OH * 0.943, z: -BL.PO * 0.816 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
      { atom1Idx: 1, atom2Idx: 3, order: 1 },
      { atom1Idx: 1, atom2Idx: 4, order: 2 },
      { atom1Idx: 2, atom2Idx: 5, order: 1 },
      { atom1Idx: 3, atom2Idx: 6, order: 1 }
    ],
    emptyBonds: [
      // O(0)（sp3）：P1 在 +x 方向，空头键与 P1 方向夹角 109.5°
      // v = (-1/3, -2√2/3, 0) = (-0.333, -0.943, 0)
      { atomIdx: 0, order: 1, position: { x: -OX * 0.333, y: -OX * 0.943, z: 0 } }
    ],
    connectionPoint: 0
  },
  {
    id: "phosphine",
    name: "\u81A6\u57FA\uFF08-PH\u2082\uFF09",
    category: "\u542B\u78F7",
    formula: "-PH\u2082",
    // P 是 sp2 平面（3 邻居），3 个键成 120° 分布
    atoms: [
      { idx: 0, symbol: "P", x: 0, y: 0, z: 0 },
      // 连接点
      // H1 在 0° 方向
      { idx: 1, symbol: "H", x: BL.PH, y: 0, z: 0 },
      // H2 在 120° 方向
      { idx: 2, symbol: "H", x: -BL.PH * 0.5, y: BL.PH * 0.866, z: 0 }
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 }
    ],
    emptyBonds: [
      // P(0) 第 3 个键在 240° 方向
      { atomIdx: 0, order: 1, position: { x: -PX * 0.5, y: -PX * 0.866, z: 0 } }
    ],
    connectionPoint: 0
  }
];
var FUNCTIONAL_GROUP_CATEGORIES = ["\u70C3\u7C7B", "\u542B\u6C27", "\u542B\u6C2E", "\u542B\u786B", "\u542B\u5364\u7D20", "\u542B\u78F7"];
function getFunctionalGroupById(id) {
  return FUNCTIONAL_GROUPS.find((g) => g.id === id);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FUNCTIONAL_GROUPS,
  FUNCTIONAL_GROUP_CATEGORIES,
  getFunctionalGroupById
});
