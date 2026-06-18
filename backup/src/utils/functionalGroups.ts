/**
 * 官能团数据定义
 * 每个官能团包含：名称、分类、原子列表（相对坐标）、化学键列表、连接点
 * 连接点(connectionPoint)表示该官能团与外部分子连接的原子索引
 * 所有坐标以连接点原子为原点(0,0,0)
 */

export interface FunctionalGroupAtom {
  idx: number;
  symbol: string;
  x: number; // Å，相对于连接点
  y: number;
  z: number;
}

export interface FunctionalGroupBond {
  atom1Idx: number;
  atom2Idx: number;
  order: number;
}

export interface FunctionalGroup {
  id: string;
  name: string;
  category: string;        // 分类：烃类、含氧、含氮、含硫、含卤素、含磷
  formula: string;         // 化学式
  atoms: FunctionalGroupAtom[];
  bonds: FunctionalGroupBond[];
  connectionPoint: number; // 连接外部分子的原子索引
}

// 常用键长(Å)
const BL = {
  CC: 1.54,    // C-C
  CD: 1.34,    // C=C
  CT: 1.20,    // C≡C
  CO: 1.43,    // C-O
  COD: 1.23,   // C=O
  CN: 1.47,    // C-N
  CND: 1.29,   // C=N
  CNT: 1.16,   // C≡N
  CS: 1.82,    // C-S
  CSD: 1.56,   // C=S
  CF: 1.35,    // C-F
  CCl: 1.77,   // C-Cl
  CBr: 1.94,   // C-Br
  CI: 2.14,    // C-I
  CP: 1.84,    // C-P
  OH: 0.96,    // O-H
  NH: 1.01,    // N-H
  SH: 1.34,    // S-H
  NO: 1.21,    // N=O (硝基)
  NN: 1.25,    // N=N
  SO: 1.43,    // S=O
  PO: 1.50,    // P=O
  PH: 1.44,    // P-H
  OO: 1.48,    // O-O
};

// 120°方向向量（sp2）
const A120 = Math.PI * 2 / 3;
const cos120 = Math.cos(A120);
const sin120 = Math.sin(A120);

export const FUNCTIONAL_GROUPS: FunctionalGroup[] = [
  // ===== 烃类 =====
  {
    id: 'alkene',
    name: '烯基（C=C）',
    category: '烃类',
    formula: '-CH=CH₂',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },           // 连接点
      { idx: 1, symbol: 'C', x: BL.CD, y: 0, z: 0 },       // 双键碳
      { idx: 2, symbol: 'H', x: BL.CD + BL.CD * cos120, y: BL.CD * sin120, z: 0 },
      { idx: 3, symbol: 'H', x: BL.CD + BL.CD * cos120, y: -BL.CD * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
      { atom1Idx: 1, atom2Idx: 3, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'alkyne',
    name: '炔基（C≡C）',
    category: '烃类',
    formula: '-C≡CH',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'C', x: BL.CT, y: 0, z: 0 },
      { idx: 2, symbol: 'H', x: BL.CT + BL.CT * 0.6, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 3 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'phenyl',
    name: '苯基',
    category: '烃类',
    formula: '-C₆H₅',
    atoms: (() => {
      const r = 1.40; // 苯环C-C键长
      const atoms: FunctionalGroupAtom[] = [];
      // 连接点在原点
      atoms.push({ idx: 0, symbol: 'C', x: 0, y: 0, z: 0 });
      // 其余5个碳沿正六边形排列
      for (let i = 1; i <= 5; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        atoms.push({
          idx: i,
          symbol: 'C',
          x: parseFloat((r * Math.sin(angle)).toFixed(4)),
          y: parseFloat((-r * (1 - Math.cos(angle))).toFixed(4)),
          z: 0,
        });
      }
      return atoms;
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 2 },
      { atom1Idx: 3, atom2Idx: 4, order: 1 },
      { atom1Idx: 4, atom2Idx: 5, order: 2 },
      { atom1Idx: 5, atom2Idx: 0, order: 1 },
    ],
    connectionPoint: 0,
  },

  // ===== 含氧官能团 =====
  {
    id: 'hydroxyl',
    name: '羟基（-OH）',
    category: '含氧',
    formula: '-OH',
    atoms: [
      { idx: 0, symbol: 'O', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', x: BL.OH, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'ether',
    name: '醚键（-O-）',
    category: '含氧',
    formula: '-O-',
    atoms: [
      { idx: 0, symbol: 'O', x: 0, y: 0, z: 0 },
    ],
    bonds: [],
    connectionPoint: 0,
  },
  {
    id: 'aldehyde',
    name: '醛基（-CHO）',
    category: '含氧',
    formula: '-CHO',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: 'H', x: -BL.CD * cos120, y: BL.CD * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'ketone',
    name: '羰基（>C=O）',
    category: '含氧',
    formula: '>C=O',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.COD, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'carboxyl',
    name: '羧基（-COOH）',
    category: '含氧',
    formula: '-COOH',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.COD, y: 0, z: 0 },           // =O
      { idx: 2, symbol: 'O', x: BL.CO * cos120, y: -BL.CO * sin120, z: 0 }, // -OH
      { idx: 3, symbol: 'H', x: BL.CO * cos120 + BL.OH * cos120, y: -BL.CO * sin120 - BL.OH * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'ester',
    name: '酯基（-COO-）',
    category: '含氧',
    formula: '-COO-',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: 'O', x: BL.CO * cos120, y: -BL.CO * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'acyl_chloride',
    name: '酰卤基（-COCl）',
    category: '含氧',
    formula: '-COCl',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: 'Cl', x: BL.CCl * cos120, y: -BL.CCl * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'anhydride',
    name: '酸酐基（-COOCO-）',
    category: '含氧',
    formula: '-COOCO-',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: 'O', x: BL.CO * cos120, y: -BL.CO * sin120, z: 0 },
      { idx: 3, symbol: 'C', x: BL.CO * cos120 + BL.CO, y: -BL.CO * sin120, z: 0 },
      { idx: 4, symbol: 'O', x: BL.CO * cos120 + BL.CO + BL.COD * cos120, y: -BL.CO * sin120 - BL.COD * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
      { atom1Idx: 3, atom2Idx: 4, order: 2 },
    ],
    connectionPoint: 0,
  },

  // ===== 含氮官能团 =====
  {
    id: 'amino',
    name: '氨基（-NH₂）',
    category: '含氮',
    formula: '-NH₂',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', x: BL.NH, y: 0, z: 0 },
      { idx: 2, symbol: 'H', x: BL.NH * cos120, y: BL.NH * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'imino',
    name: '亚氨基（=NH）',
    category: '含氮',
    formula: '=NH',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', x: BL.NH, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'nitro',
    name: '硝基（-NO₂）',
    category: '含氮',
    formula: '-NO₂',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.NO, y: 0, z: 0 },
      { idx: 2, symbol: 'O', x: BL.NO * cos120, y: -BL.NO * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 2 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'cyano',
    name: '氰基（-C≡N）',
    category: '含氮',
    formula: '-C≡N',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'N', x: BL.CNT, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 3 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'amide',
    name: '酰胺基（-CONH₂）',
    category: '含氮',
    formula: '-CONH₂',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.COD, y: 0, z: 0 },
      { idx: 2, symbol: 'N', x: BL.CN * cos120, y: -BL.CN * sin120, z: 0 },
      { idx: 3, symbol: 'H', x: BL.CN * cos120 + BL.NH, y: -BL.CN * sin120, z: 0 },
      { idx: 4, symbol: 'H', x: BL.CN * cos120 + BL.NH * cos120, y: -BL.CN * sin120 - BL.NH * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
      { atom1Idx: 2, atom2Idx: 4, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'azo',
    name: '偶氮基（-N=N-）',
    category: '含氮',
    formula: '-N=N-',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'N', x: BL.NN, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'isocyanate',
    name: '异氰酸酯基（-NCO）',
    category: '含氮',
    formula: '-N=C=O',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'C', x: BL.CND, y: 0, z: 0 },
      { idx: 2, symbol: 'O', x: BL.CND + BL.COD, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 1, atom2Idx: 2, order: 2 },
    ],
    connectionPoint: 0,
  },

  // ===== 含硫官能团 =====
  {
    id: 'thiol',
    name: '巯基（-SH）',
    category: '含硫',
    formula: '-SH',
    atoms: [
      { idx: 0, symbol: 'S', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', x: BL.SH, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'thioether',
    name: '硫醚键（-S-）',
    category: '含硫',
    formula: '-S-',
    atoms: [
      { idx: 0, symbol: 'S', x: 0, y: 0, z: 0 },
    ],
    bonds: [],
    connectionPoint: 0,
  },
  {
    id: 'sulfonyl',
    name: '磺酸基（-SO₃H）',
    category: '含硫',
    formula: '-SO₃H',
    atoms: [
      { idx: 0, symbol: 'S', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.SO, y: 0, z: 0 },
      { idx: 2, symbol: 'O', x: BL.SO * cos120, y: BL.SO * sin120, z: 0 },
      { idx: 3, symbol: 'O', x: BL.SO * cos120, y: -BL.SO * sin120, z: 0 },
      { idx: 4, symbol: 'H', x: BL.SO * cos120 + BL.OH, y: -BL.SO * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 2 },
      { atom1Idx: 0, atom2Idx: 3, order: 1 },
      { atom1Idx: 3, atom2Idx: 4, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'sulfoxide',
    name: '亚砜基（>S=O）',
    category: '含硫',
    formula: '>S=O',
    atoms: [
      { idx: 0, symbol: 'S', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', x: BL.SO, y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
    ],
    connectionPoint: 0,
  },

  // ===== 含卤素官能团 =====
  {
    id: 'fluoro',
    name: '氟代（-F）',
    category: '含卤素',
    formula: '-F',
    atoms: [
      { idx: 0, symbol: 'F', x: 0, y: 0, z: 0 },
    ],
    bonds: [],
    connectionPoint: 0,
  },
  {
    id: 'chloro',
    name: '氯代（-Cl）',
    category: '含卤素',
    formula: '-Cl',
    atoms: [
      { idx: 0, symbol: 'Cl', x: 0, y: 0, z: 0 },
    ],
    bonds: [],
    connectionPoint: 0,
  },
  {
    id: 'bromo',
    name: '溴代（-Br）',
    category: '含卤素',
    formula: '-Br',
    atoms: [
      { idx: 0, symbol: 'Br', x: 0, y: 0, z: 0 },
    ],
    bonds: [],
    connectionPoint: 0,
  },
  {
    id: 'iodo',
    name: '碘代（-I）',
    category: '含卤素',
    formula: '-I',
    atoms: [
      { idx: 0, symbol: 'I', x: 0, y: 0, z: 0 },
    ],
    bonds: [],
    connectionPoint: 0,
  },

  // ===== 含磷官能团 =====
  {
    id: 'phosphoester',
    name: '磷酸酯基（-OPO₃H₂）',
    category: '含磷',
    formula: '-OPO₃H₂',
    atoms: [
      { idx: 0, symbol: 'O', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'P', x: BL.PO, y: 0, z: 0 },
      { idx: 2, symbol: 'O', x: BL.PO + BL.PO * cos120, y: BL.PO * sin120, z: 0 },
      { idx: 3, symbol: 'O', x: BL.PO + BL.PO * cos120, y: -BL.PO * sin120, z: 0 },
      { idx: 4, symbol: 'O', x: BL.PO + BL.PO, y: 0, z: 0 },
      { idx: 5, symbol: 'H', x: BL.PO + BL.PO * cos120 + BL.OH, y: BL.PO * sin120, z: 0 },
      { idx: 6, symbol: 'H', x: BL.PO + BL.PO * cos120 + BL.OH, y: -BL.PO * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
      { atom1Idx: 1, atom2Idx: 3, order: 1 },
      { atom1Idx: 1, atom2Idx: 4, order: 2 },
      { atom1Idx: 2, atom2Idx: 5, order: 1 },
      { atom1Idx: 3, atom2Idx: 6, order: 1 },
    ],
    connectionPoint: 0,
  },
  {
    id: 'phosphine',
    name: '膦基（-PH₂）',
    category: '含磷',
    formula: '-PH₂',
    atoms: [
      { idx: 0, symbol: 'P', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', x: BL.PH, y: 0, z: 0 },
      { idx: 2, symbol: 'H', x: BL.PH * cos120, y: BL.PH * sin120, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    connectionPoint: 0,
  },
];

/** 官能团分类顺序 */
export const FUNCTIONAL_GROUP_CATEGORIES = ['烃类', '含氧', '含氮', '含硫', '含卤素', '含磷'];

/** 根据id查找官能团 */
export function getFunctionalGroupById(id: string): FunctionalGroup | undefined {
  return FUNCTIONAL_GROUPS.find(g => g.id === id);
}
