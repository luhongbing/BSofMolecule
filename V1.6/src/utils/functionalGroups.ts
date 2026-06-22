/**
 * 官能团数据定义
 * 所有坐标以官能团的连接原子为原点 (0,0,0)
 * 键长使用标准键长（与 molecularConstraints.ts 一致）
 * 键角根据杂化类型（sp=180°, sp2=120°, sp3=109.5°）
 */

export interface FunctionalGroupAtom {
  idx: number;
  symbol: string;
  x: number;
  y: number;
  z: number;
}

export interface FunctionalGroupBond {
  atom1Idx: number;
  atom2Idx: number;
  order: number;
}

export interface EmptyBond {
  atomIdx: number;
  order: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

export interface FunctionalGroup {
  id: string;
  name: string;
  category: string;
  formula: string;
  atoms: FunctionalGroupAtom[];
  bonds: FunctionalGroupBond[];
  emptyBonds?: EmptyBond[];
  connectionPoint: number;
}

// ============ 标准键长 (Å) ============
const BL: Record<string, Record<number, number>> = {
  'C-C': { 1: 1.54, 2: 1.34, 3: 1.20 },
  'C-H': { 1: 1.09 },
  'C-O': { 1: 1.43, 2: 1.22 },
  'O-H': { 1: 0.96 },
  'C-N': { 1: 1.47, 2: 1.29, 3: 1.16 },
  'N-H': { 1: 1.01 },
  'C-Cl': { 1: 1.77 },
  'C-Br': { 1: 1.94 },
  'C-I': { 1: 2.14 },
  'C-F': { 1: 1.35 },
  'C-S': { 1: 1.82, 2: 1.60 },
  'N-N': { 1: 1.45, 2: 1.25 },
  'N-O': { 1: 1.41, 2: 1.22 },
  'S-O': { 1: 1.57, 2: 1.43 },
  'S-H': { 1: 1.34 },
  'P-O': { 1: 1.54, 2: 1.50 },
  'P-H': { 1: 1.44 },
  'O-O': { 1: 1.48 },
};

function getBL(s1: string, s2: string, order: number = 1): number {
  const k1 = `${s1}-${s2}`, k2 = `${s2}-${s1}`;
  const t = BL[k1] || BL[k2];
  if (t && t[order]) return t[order];
  if (t && t[1]) return t[1];
  return 1.5;
}

// ============ 方向向量 ============
// sp2 平面三方向（以原点原子为中心，C1 或主取代基在 +x 方向）
const D120_A = { x:  1.0,   y:  0.0,          z: 0 }; // 0°  (主方向)
const D120_B = { x: -0.5,   y:  0.86602540378, z: 0 }; // 120°
const D120_C = { x: -0.5,   y: -0.86602540378, z: 0 }; // 240°

// 镜像 sp2 方向（第二原子，向 -x 方向有回键）
const MIR_B = { x: 0.5, y:  0.86602540378, z: 0 }; // 从第二原子看：60°
const MIR_C = { x: 0.5, y: -0.86602540378, z: 0 }; // 从第二原子看：-60°

// sp3 四面体方向（四方向，两两 109.5°）
const TET1 = { x:  0.57735026919, y:  0.57735026919, z:  0.57735026919 }; // (1,1,1)/√3
const TET2 = { x:  0.57735026919, y: -0.57735026919, z: -0.57735026919 }; // (1,-1,-1)/√3
const TET3 = { x: -0.57735026919, y:  0.57735026919, z: -0.57735026919 }; // (-1,1,-1)/√3
const TET4 = { x: -0.57735026919, y: -0.57735026919, z:  0.57735026919 }; // (-1,-1,1)/√3

// 反向四面体方向（回键在 TET1 方向的原子，外伸键用这些方向）
const NTET2 = { x: -TET2.x, y: -TET2.y, z: -TET2.z };
const NTET3 = { x: -TET3.x, y: -TET3.y, z: -TET3.z };
const NTET4 = { x: -TET4.x, y: -TET4.y, z: -TET4.z };

// 空头键长度（连接到外部 C 原子）
const EB_LEN: Record<string, number> = {
  'C': BL['C-C'][1],   // 1.54
  'O': BL['C-O'][1],   // 1.43
  'N': BL['C-N'][1],   // 1.47
  'S': BL['C-S'][1],   // 1.82
  'P': 1.84,
  'F': BL['C-F'][1],   // 1.35
  'Cl': BL['C-Cl'][1], // 1.77
  'Br': BL['C-Br'][1], // 1.94
  'I': BL['C-I'][1],   // 2.14
};

function pos(dir: { x: number; y: number; z: number }, len: number,
             origin: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }) {
  return { x: origin.x + dir.x * len, y: origin.y + dir.y * len, z: origin.z + dir.z * len };
}

// ============ 官能团定义 ============
export const FUNCTIONAL_GROUPS: FunctionalGroup[] = [

  // ====== 烃类 ======

  // 烯基: -CH=CH2, C0 在原点 (sp2), 双键沿 +x 到 C1
  {
    id: 'alkene',
    name: '烯基（-CH=CH₂）',
    category: '烃类',
    formula: '-CH=CH₂',
    atoms: (() => {
      const C0 = { x: 0, y: 0, z: 0 };
      const C1 = pos(D120_A, BL['C-C'][2], C0); // (1.34, 0, 0)
      // C0 的其他键: H 在 120° (D120_B), 空头键在 240° (D120_C)
      const H0 = pos(D120_B, BL['C-H'][1], C0);
      // C1 的其他键: 从 C1 看，回键到 C0 是 -x 方向, 所以 H 用镜像方向
      const H1 = pos(MIR_B, BL['C-H'][1], C1);  // (0.5, 0.866) 从 C1
      const H2 = pos(MIR_C, BL['C-H'][1], C1);  // (0.5, -0.866) 从 C1
      return [
        { idx: 0, symbol: 'C', ...C0 },
        { idx: 1, symbol: 'C', ...C1 },
        { idx: 2, symbol: 'H', ...H0 },
        { idx: 3, symbol: 'H', ...H1 },
        { idx: 4, symbol: 'H', ...H2 },
      ];
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 1, atom2Idx: 3, order: 1 },
      { atom1Idx: 1, atom2Idx: 4, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_C, EB_LEN['C']) },
    ],
    connectionPoint: 0,
  },

  // 炔基: -C≡CH (sp 直线)
  {
    id: 'alkyne',
    name: '炔基（-C≡CH）',
    category: '烃类',
    formula: '-C≡CH',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'C', x: BL['C-C'][3], y: 0, z: 0 },
      { idx: 2, symbol: 'H', x: BL['C-C'][3] + BL['C-H'][1], y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 3 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -EB_LEN['C'], y: 0, z: 0 } },
    ],
    connectionPoint: 0,
  },

  // 苯基: 苯环简化结构 (C6H5-)
  {
    id: 'phenyl',
    name: '苯基（-C₆H₅）',
    category: '烃类',
    formula: '-C₆H₅',
    atoms: (() => {
      // 正六边形：中心沿 (0.5, 0.866) 方向距离 C0 为 1.40Å
      // C0 在原点 (0,0,0), C1 在 (1.40, 0, 0)
      // 环心在 (0.70, 1.212, 0) — 距 C0 1.40Å, 与 C0-C1 成 60°
      // 各 C 从环心以 60° 间隔分布
      const R = 1.40; // 外接圆半径 = C-C 键长
      const cx = R / 2;       // 0.70
      const cy = R * Math.sqrt(3) / 2; // 1.212
      const atoms: FunctionalGroupAtom[] = [];
      // C0: 从环心方向 240°
      // C1: 从环心方向 300°
      // C2: 从环心方向 0°/360°
      // C3: 从环心方向 60°
      // C4: 从环心方向 120°
      // C5: 从环心方向 180°
      const angles = [240, 300, 0, 60, 120, 180];
      for (let i = 0; i < 6; i++) {
        const rad = angles[i] * Math.PI / 180;
        const x = cx + R * Math.cos(rad);
        const y = cy + R * Math.sin(rad);
        atoms.push({ idx: i, symbol: 'C', x, y, z: 0 });
      }
      // 5 个 H: C1-C5 各一个，沿环外方向 (从环心向外延长)
      const H_len = R + BL['C-H'][1];
      for (let i = 1; i <= 5; i++) {
        const rad = angles[i] * Math.PI / 180;
        const x = cx + H_len * Math.cos(rad);
        const y = cy + H_len * Math.sin(rad);
        atoms.push({ idx: 5 + i, symbol: 'H', x, y, z: 0 });
      }
      return atoms;
    })(),
    bonds: (() => {
      const bonds: FunctionalGroupBond[] = [];
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        // 交替单双键：C0-C1 双, C1-C2 单, C2-C3 双, ...
        bonds.push({ atom1Idx: i, atom2Idx: j, order: i % 2 === 0 ? 2 : 1 });
      }
      for (let i = 1; i <= 5; i++) {
        bonds.push({ atom1Idx: i, atom2Idx: 5 + i, order: 1 });
      }
      return bonds;
    })(),
    emptyBonds: [
      // C0 的空头键: 沿环外 (240° 方向向外延伸)
      { atomIdx: 0, order: 1, position: pos(D120_C, EB_LEN['C']) },
    ],
    connectionPoint: 0,
  },

  // ====== 含氧官能团 ======

  // 羟基: -OH, O 在原点 (sp3)
  {
    id: 'hydroxyl',
    name: '羟基（-OH）',
    category: '含氧',
    formula: '-OH',
    atoms: [
      { idx: 0, symbol: 'O', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', ...pos(TET1, BL['O-H'][1]) },
    ],
    bonds: [{ atom1Idx: 0, atom2Idx: 1, order: 1 }],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(TET2, EB_LEN['O']) },
    ],
    connectionPoint: 0,
  },

  // 醚键: -O-
  {
    id: 'ether',
    name: '醚键（-O-）',
    category: '含氧',
    formula: '-O-',
    atoms: [{ idx: 0, symbol: 'O', x: 0, y: 0, z: 0 }],
    bonds: [],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(TET1, EB_LEN['O']) },
      { atomIdx: 0, order: 1, position: pos(TET2, EB_LEN['O']) },
    ],
    connectionPoint: 0,
  },

  // 醛基: -CHO
  {
    id: 'aldehyde',
    name: '醛基（-CHO）',
    category: '含氧',
    formula: '-CHO',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', ...pos(D120_A, BL['C-O'][2]) },  // =O 在 +x
      { idx: 2, symbol: 'H', ...pos(D120_B, BL['C-H'][1]) },    // H 在 120°
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_C, EB_LEN['C']) }, // 240°
    ],
    connectionPoint: 0,
  },

  // 酮羰基: >C=O
  {
    id: 'ketone',
    name: '羰基（>C=O）',
    category: '含氧',
    formula: '>C=O',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', ...pos(D120_A, BL['C-O'][2]) }, // =O 在 +x
    ],
    bonds: [{ atom1Idx: 0, atom2Idx: 1, order: 2 }],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_B, EB_LEN['C']) },
      { atomIdx: 0, order: 1, position: pos(D120_C, EB_LEN['C']) },
    ],
    connectionPoint: 0,
  },

  // 羧基: -COOH, C0 (sp2) 在原点, =O 在 +x, -O- 在 240°, 空头键在 120°
  {
    id: 'carboxyl',
    name: '羧基（-COOH）',
    category: '含氧',
    formula: '-COOH',
    atoms: (() => {
      const C0 = { x: 0, y: 0, z: 0 };
      const O1 = pos(D120_A, BL['C-O'][2], C0);           // =O: (1.22, 0, 0)
      const O2 = pos(D120_C, BL['C-O'][1], C0);            // -O-: (-0.715, -1.238, 0)
      // 从 O2 看，回键到 C0 方向 = (0.5, 0.866, 0) = D120_B
      // O2 是 sp3, 需 O-H 方向与回键成 109.5°（带 z 分量出平面）
      // cos(109.5°) = -1/3. 设置方向 (a, b, c) 满足 0.5a + 0.866b = -1/3
      // 令 a = 0, b = -0.385, c = sqrt(1 - 0.148) = 0.923
      const OH_DIR = { x: 0, y: -0.3849, z: 0.923 };
      const H = pos(OH_DIR, BL['O-H'][1], O2);
      return [
        { idx: 0, symbol: 'C', ...C0 },
        { idx: 1, symbol: 'O', ...O1 },
        { idx: 2, symbol: 'O', ...O2 },
        { idx: 3, symbol: 'H', ...H },
      ];
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_B, EB_LEN['C']) }, // 120°
    ],
    connectionPoint: 0,
  },

  // 酯基: -COO-, sp2 C0 + =O + -O- (sp3 桥连)
  {
    id: 'ester',
    name: '酯基（-COO-）',
    category: '含氧',
    formula: '-COO-',
    atoms: (() => {
      const C0 = { x: 0, y: 0, z: 0 };
      const O1 = pos(D120_A, BL['C-O'][2], C0);           // =O
      const O2 = pos(D120_C, BL['C-O'][1], C0);            // 桥连 O (-0.715, -1.238, 0)
      return [
        { idx: 0, symbol: 'C', ...C0 },
        { idx: 1, symbol: 'O', ...O1 },
        { idx: 2, symbol: 'O', ...O2 },
      ];
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_B, EB_LEN['C']) },
      // O2 空头键 (sp3 方向, 与回键 C0 成 109.5°): 同羧基 OH_DIR
      { atomIdx: 2, order: 1, position: pos({ x: 0, y: -0.3849, z: 0.923 },
                                             EB_LEN['O'],
                                             pos(D120_C, BL['C-O'][1])) },
    ],
    connectionPoint: 0,
  },

  // 酰卤基: -COCl
  {
    id: 'acyl_chloride',
    name: '酰卤基（-COCl）',
    category: '含氧',
    formula: '-COCl',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', ...pos(D120_A, BL['C-O'][2]) },
      { idx: 2, symbol: 'Cl', ...pos(D120_C, BL['C-Cl'][1]) },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_B, EB_LEN['C']) },
    ],
    connectionPoint: 0,
  },

  // 酸酐: -CO-O-CO-
  {
    id: 'anhydride',
    name: '酸酐基（-COOCO-）',
    category: '含氧',
    formula: '-COOCO-',
    atoms: (() => {
      const C0 = { x: 0, y: 0, z: 0 };
      const O1 = pos(D120_A, BL['C-O'][2], C0);            // C0 的 =O
      const Obridge = pos(D120_C, BL['C-O'][1], C0);        // 桥连 O (-0.715, -1.238, 0)
      // 从 Obridge 到 C3: sp3 方向（与回键 C0 成 109.5°）
      // 回键方向从 Obridge 到 C0 = (0.5, 0.866, 0)
      // C3 方向: (0, -0.385, 0.923) - 与酯/羧基相同方向
      const OBRIDGE_OUT = { x: 0, y: -0.3849, z: 0.923 };
      const C3 = pos(OBRIDGE_OUT, BL['C-O'][1], Obridge);
      // 现在 C3 是 sp2: 回键到 Obridge 方向 = -OBRIDGE_OUT
      // C3 需要 =O 和空头键，三方向成 120°
      // 简化：让 C3 的平面包含 z 轴和 Obridge-C3 线
      // C3 的三个 sp2 方向（局部坐标）:
      //   d_back = -OBRIDGE_OUT (到 Obridge)
      //   d_O = 与 d_back 成 120° 的方向
      //   d_empty = 与 d_back 成 120° 的另一方向
      // 使用与 Obridge 在同一"平面"旋转的方法:
      // d_back = (0, 0.385, -0.923). 让 =O 在 +x 大致方向:
      // 用 Gram-Schmidt 构造垂直于 d_back 的向量。选 (1,0,0), 投影后正交化:
      // v_perp = (1,0,0) - dot((1,0,0), d_back)*d_back = (1,0,0) - 0 = (1,0,0) [since d_back.x=0]
      // 所以在 C3 的平面：d_back=(0, 0.385, -0.923) 和 x 轴方向
      // sp2 三方向: d_back, -0.5*d_back ± 0.866*(1,0,0)
      const d_back = { x: -OBRIDGE_OUT.x, y: -OBRIDGE_OUT.y, z: -OBRIDGE_OUT.z }; // (0, 0.385, -0.923)
      // d_O = -0.5*d_back + 0.866*(1,0,0) = (0.866, -0.1925, 0.4615)
      const d_O = { x: 0.8660254, y: -0.5 * d_back.y, z: -0.5 * d_back.z };
      // d_empty = -0.5*d_back - 0.866*(1,0,0) = (-0.866, -0.1925, 0.4615)
      const d_emp = { x: -0.8660254, y: -0.5 * d_back.y, z: -0.5 * d_back.z };
      // 验证 d_O 与 d_back 夹角: dot = 0.866*0 + (-0.5*0.385)*0.385 + (-0.5*-0.923)*-0.923
      // = 0 - 0.5*0.148 - 0.5*0.852 = -0.5*(0.148+0.852) = -0.5. Angle = 120° ✓
      const O4 = pos(d_O, BL['C-O'][2], C3);
      return [
        { idx: 0, symbol: 'C', ...C0 },
        { idx: 1, symbol: 'O', ...O1 },
        { idx: 2, symbol: 'O', ...Obridge },
        { idx: 3, symbol: 'C', ...C3 },
        { idx: 4, symbol: 'O', ...O4 },
      ];
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
      { atom1Idx: 3, atom2Idx: 4, order: 2 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_B, EB_LEN['C']) },
      // C3 的空头键: d_emp = (-0.866, -0.1925, 0.4615) [120° 与 d_back 和 d_O]
      // d_back = (0, 0.3849, -0.923), d_O = (0.866, -0.1925, 0.4615)
      { atomIdx: 3, order: 1, position: pos(
        { x: -0.8660254, y: -0.19245, z: 0.4615 },
        EB_LEN['C'],
        pos({ x: 0, y: -0.3849, z: 0.923 }, BL['C-O'][1], pos(D120_C, BL['C-O'][1]))
      ) },
    ],
    connectionPoint: 0,
  },

  // ====== 含氮官能团 ======

  // 氨基: -NH2
  {
    id: 'amino',
    name: '氨基（-NH₂）',
    category: '含氮',
    formula: '-NH₂',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', ...pos(TET1, BL['N-H'][1]) },
      { idx: 2, symbol: 'H', ...pos(TET2, BL['N-H'][1]) },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(TET3, EB_LEN['N']) },
    ],
    connectionPoint: 0,
  },

  // 亚氨基: =NH
  {
    id: 'imino',
    name: '亚氨基（=NH）',
    category: '含氮',
    formula: '=NH',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', ...pos(D120_B, BL['N-H'][1]) },
    ],
    bonds: [{ atom1Idx: 0, atom2Idx: 1, order: 1 }],
    emptyBonds: [
      { atomIdx: 0, order: 2, position: pos(D120_A, BL['C-N'][2]) },
    ],
    connectionPoint: 0,
  },

  // 硝基: -NO2 (N 为 sp2 平面三角)
  {
    id: 'nitro',
    name: '硝基（-NO₂）',
    category: '含氮',
    formula: '-NO₂',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', ...pos(D120_B, BL['N-O'][2]) },
      { idx: 2, symbol: 'O', ...pos(D120_C, BL['N-O'][2]) },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 2 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_A, EB_LEN['N']) },
    ],
    connectionPoint: 0,
  },

  // 氰基: -C≡N
  {
    id: 'cyano',
    name: '氰基（-C≡N）',
    category: '含氮',
    formula: '-C≡N',
    atoms: [
      { idx: 0, symbol: 'C', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'N', x: BL['C-N'][3], y: 0, z: 0 },
    ],
    bonds: [{ atom1Idx: 0, atom2Idx: 1, order: 3 }],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -EB_LEN['C'], y: 0, z: 0 } },
    ],
    connectionPoint: 0,
  },

  // 酰胺: -CONH2
  {
    id: 'amide',
    name: '酰胺基（-CONH₂）',
    category: '含氮',
    formula: '-CONH₂',
    atoms: (() => {
      const C0 = { x: 0, y: 0, z: 0 };
      const O1 = pos(D120_A, BL['C-O'][2], C0);           // =O (+x)
      const N2 = pos(D120_C, BL['C-N'][1], C0);            // N at 240°: (-0.735, -1.273, 0)
      // N2 为 sp2 平面三角: 回键方向到 C0 从 N2 = (0.5, 0.866, 0) = D120_B
      // N2 的其他两个 sp2 方向（与回键成 120°，在包含 z 的平面）
      // 回键 dir = (0.5, 0.866, 0). 垂直向量 (0.866, -0.5, 0) 归一化后 (0.866, -0.5, 0)
      // 三 sp2 方向: d_back = D120_B, d_H1, d_H2
      // d_H1 = -0.5*D120_B + 0.866*(0.866, -0.5, 0) = (-0.25, -0.433, 0) + (0.75, -0.433, 0) = (0.5, -0.866, 0)
      // d_H2 = -0.5*D120_B - 0.866*(0.866, -0.5, 0) = (-0.25, -0.433, 0) + (-0.75, 0.433, 0) = (-1, 0, 0)
      const NH_DIR1 = { x: 0.5, y: -0.8660254, z: 0 };
      const NH_DIR2 = { x: -1.0, y: 0, z: 0 };
      // 验证角度: dot(D120_B, NH_DIR1) = 0.5*0.5 + 0.866*(-0.866) = 0.25 - 0.75 = -0.5 → 120° ✓
      // dot(D120_B, NH_DIR2) = 0.5*(-1) + 0.866*0 = -0.5 → 120° ✓
      // dot(NH_DIR1, NH_DIR2) = 0.5*(-1) + (-0.866)*0 = -0.5 → 120° ✓
      const H3 = pos(NH_DIR1, BL['N-H'][1], N2);
      const H4 = pos(NH_DIR2, BL['N-H'][1], N2);
      return [
        { idx: 0, symbol: 'C', ...C0 },
        { idx: 1, symbol: 'O', ...O1 },
        { idx: 2, symbol: 'N', ...N2 },
        { idx: 3, symbol: 'H', ...H3 },
        { idx: 4, symbol: 'H', ...H4 },
      ];
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
      { atom1Idx: 2, atom2Idx: 3, order: 1 },
      { atom1Idx: 2, atom2Idx: 4, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(D120_B, EB_LEN['C']) },
    ],
    connectionPoint: 0,
  },

  // 偶氮: -N=N-
  {
    id: 'azo',
    name: '偶氮基（-N=N-）',
    category: '含氮',
    formula: '-N=N-',
    atoms: (() => {
      const N0 = { x: 0, y: 0, z: 0 };
      const N1 = pos(D120_A, BL['N-N'][2], N0);  // (1.25, 0, 0)
      return [
        { idx: 0, symbol: 'N', ...N0 },
        { idx: 1, symbol: 'N', ...N1 },
      ];
    })(),
    bonds: [{ atom1Idx: 0, atom2Idx: 1, order: 2 }],
    emptyBonds: [
      // N0 的空头键: 120° (D120_B)
      { atomIdx: 0, order: 1, position: pos(D120_B, EB_LEN['N']) },
      // N1 的空头键: 从 N1 看，回键在 -x, 所以用镜像方向 MIR_B (0.5, 0.866)
      { atomIdx: 1, order: 1, position: pos(MIR_B, EB_LEN['N'], { x: BL['N-N'][2], y: 0, z: 0 }) },
    ],
    connectionPoint: 0,
  },

  // 异氰酸酯: -N=C=O (累积双键, sp 直线型)
  {
    id: 'isocyanate',
    name: '异氰酸酯基（-NCO）',
    category: '含氮',
    formula: '-N=C=O',
    atoms: [
      { idx: 0, symbol: 'N', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'C', x: BL['C-N'][2], y: 0, z: 0 },
      { idx: 2, symbol: 'O', x: BL['C-N'][2] + BL['C-O'][2], y: 0, z: 0 },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 1, atom2Idx: 2, order: 2 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: { x: -EB_LEN['N'], y: 0, z: 0 } },
    ],
    connectionPoint: 0,
  },

  // ====== 含硫官能团 ======

  // 巯基: -SH
  {
    id: 'thiol',
    name: '巯基（-SH）',
    category: '含硫',
    formula: '-SH',
    atoms: [
      { idx: 0, symbol: 'S', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', ...pos(TET1, BL['S-H'][1]) },
    ],
    bonds: [{ atom1Idx: 0, atom2Idx: 1, order: 1 }],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(TET2, EB_LEN['S']) },
    ],
    connectionPoint: 0,
  },

  // 硫醚: -S-
  {
    id: 'thioether',
    name: '硫醚键（-S-）',
    category: '含硫',
    formula: '-S-',
    atoms: [{ idx: 0, symbol: 'S', x: 0, y: 0, z: 0 }],
    bonds: [],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(TET1, EB_LEN['S']) },
      { atomIdx: 0, order: 1, position: pos(TET2, EB_LEN['S']) },
    ],
    connectionPoint: 0,
  },

  // 磺酸基: -SO3H, S 在原点（四面体: 1×空头键 + 2×=O + 1×-OH）
  {
    id: 'sulfonyl',
    name: '磺酸基（-SO₃H）',
    category: '含硫',
    formula: '-SO₃H',
    atoms: (() => {
      const S0 = { x: 0, y: 0, z: 0 };
      // S 的四个四面体方向: TET1, TET2, TET3, TET4
      const O1 = pos(TET1, BL['S-O'][2], S0);   // =O #1
      const O2 = pos(TET2, BL['S-O'][2], S0);   // =O #2
      const O3 = pos(TET3, BL['S-O'][1], S0);   // -OH (单键)
      // O3 上的 H: 从 O3 看，回键到 S 是 -TET3, O-H 应与回键成 109.5°
      // 选择方向: 同羧基思路，与 -TET3 成 109.5°，选一个带不同分量的方向
      // 方向 (-TET3) = (0.577, -0.577, 0.577). 用 TET1 方向作为 O-H 方向:
      // dot(-TET3, TET1) = 0.577*0.577 + (-0.577)*0.577 + 0.577*0.577 = 0.333-0.333+0.333 = 0.333
      // angle = 70.5°. Wrong.
      // 正确: O-H 方向应该是 -TET3 的"四面体伙伴"之一。
      // 四个四面体方向 TET1-4 之间互成 109.5°。但 O3 的位置在 TET3 方向从 S,
      // 所以从 O3 看 S 是 -TET3 方向。O-H 应在 -TET3 的伙伴方向，即 -TET1, -TET2, -TET4.
      // 实际上，O 原子是 sp3: O-S 是一个方向，O-H 是另一方向（109.5°），孤对占另外两个。
      // 从 O3 看: 回键 dir = -TET3 = (0.577, -0.577, 0.577)
      // 选 -TET1 = (-0.577, -0.577, -0.577) 作为 O-H 方向. dot(-TET3, -TET1) = dot(TET3, TET1) = -1/3
      // angle = 109.5° ✓
      const OH_DIR = { x: -TET1.x, y: -TET1.y, z: -TET1.z };
      const H = pos(OH_DIR, BL['O-H'][1], O3);
      return [
        { idx: 0, symbol: 'S', ...S0 },
        { idx: 1, symbol: 'O', ...O1 },
        { idx: 2, symbol: 'O', ...O2 },
        { idx: 3, symbol: 'O', ...O3 },
        { idx: 4, symbol: 'H', ...H },
      ];
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 2 },
      { atom1Idx: 0, atom2Idx: 2, order: 2 },
      { atom1Idx: 0, atom2Idx: 3, order: 1 },
      { atom1Idx: 3, atom2Idx: 4, order: 1 },
    ],
    emptyBonds: [
      // S 的空头键: 第四四面体方向 TET4
      { atomIdx: 0, order: 1, position: pos(TET4, EB_LEN['S']) },
    ],
    connectionPoint: 0,
  },

  // 亚砜: >S=O
  {
    id: 'sulfoxide',
    name: '亚砜基（>S=O）',
    category: '含硫',
    formula: '>S=O',
    atoms: [
      { idx: 0, symbol: 'S', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'O', ...pos(TET1, BL['S-O'][2]) }, // =O 在 TET1 方向
    ],
    bonds: [{ atom1Idx: 0, atom2Idx: 1, order: 2 }],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(TET2, EB_LEN['S']) },
      { atomIdx: 0, order: 1, position: pos(TET3, EB_LEN['S']) },
    ],
    connectionPoint: 0,
  },

  // ====== 含卤素 ======
  {
    id: 'fluoro', name: '氟代（-F）', category: '含卤素', formula: '-F',
    atoms: [{ idx: 0, symbol: 'F', x: 0, y: 0, z: 0 }], bonds: [],
    emptyBonds: [{ atomIdx: 0, order: 1, position: { x: -EB_LEN['F'], y: 0, z: 0 } }],
    connectionPoint: 0,
  },
  {
    id: 'chloro', name: '氯代（-Cl）', category: '含卤素', formula: '-Cl',
    atoms: [{ idx: 0, symbol: 'Cl', x: 0, y: 0, z: 0 }], bonds: [],
    emptyBonds: [{ atomIdx: 0, order: 1, position: { x: -EB_LEN['Cl'], y: 0, z: 0 } }],
    connectionPoint: 0,
  },
  {
    id: 'bromo', name: '溴代（-Br）', category: '含卤素', formula: '-Br',
    atoms: [{ idx: 0, symbol: 'Br', x: 0, y: 0, z: 0 }], bonds: [],
    emptyBonds: [{ atomIdx: 0, order: 1, position: { x: -EB_LEN['Br'], y: 0, z: 0 } }],
    connectionPoint: 0,
  },
  {
    id: 'iodo', name: '碘代（-I）', category: '含卤素', formula: '-I',
    atoms: [{ idx: 0, symbol: 'I', x: 0, y: 0, z: 0 }], bonds: [],
    emptyBonds: [{ atomIdx: 0, order: 1, position: { x: -EB_LEN['I'], y: 0, z: 0 } }],
    connectionPoint: 0,
  },

  // ====== 含磷 ======

  // 磷酸酯: -OPO3H2
  {
    id: 'phosphoester',
    name: '磷酸酯基（-OPO₃H₂）',
    category: '含磷',
    formula: '-OPO₃H₂',
    atoms: (() => {
      const O0 = { x: 0, y: 0, z: 0 };
      // P1: sp3 四面体。O0 在 TET1 方向（作为从 O0 到 P1 方向）
      // 从 O0 到 P1: 方向 TET1, 长度 BL['C-O'][1] (1.43)
      const P1 = pos(TET1, BL['C-O'][1], O0);  // (0.825, 0.825, 0.825)
      // 从 P1 看, 回键到 O0 的方向 = -TET1. 其他三个四面体方向: -TET2, -TET3, -TET4
      // (因为 {-TET1, -TET2, -TET3, -TET4} 也是正四面体)
      const Odouble = pos(NTET2, BL['P-O'][2], P1);  // =O
      const Ooh1 = pos(NTET3, BL['P-O'][1], P1);      // -OH #1
      const Ooh2 = pos(NTET4, BL['P-O'][1], P1);      // -OH #2
      // H on Ooh1: 从 Ooh1 看, 回键到 P1 = -(-TET3) = TET3. O-H 方向与 TET3 成 109.5°
      // 用 TET1 方向: dot(TET3, TET1) = -1/3 → 109.5° ✓
      const H1 = pos(TET1, BL['O-H'][1], Ooh1);
      const H2 = pos(TET1, BL['O-H'][1], Ooh2);
      return [
        { idx: 0, symbol: 'O', ...O0 },
        { idx: 1, symbol: 'P', ...P1 },
        { idx: 2, symbol: 'O', ...Ooh1 },
        { idx: 3, symbol: 'O', ...Ooh2 },
        { idx: 4, symbol: 'O', ...Odouble },
        { idx: 5, symbol: 'H', ...H1 },
        { idx: 6, symbol: 'H', ...H2 },
      ];
    })(),
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 1, atom2Idx: 2, order: 1 },
      { atom1Idx: 1, atom2Idx: 3, order: 1 },
      { atom1Idx: 1, atom2Idx: 4, order: 2 },
      { atom1Idx: 2, atom2Idx: 5, order: 1 },
      { atom1Idx: 3, atom2Idx: 6, order: 1 },
    ],
    emptyBonds: [
      // O0 的空头键: sp3 其他方向（与回键-P 成 109.5°）
      // 从 O0 看, 回键方向 = TET1 (指向 P1). 其他四面体方向: TET2, TET3, TET4
      { atomIdx: 0, order: 1, position: pos(TET2, EB_LEN['O']) },
    ],
    connectionPoint: 0,
  },

  // 膦基: -PH2
  {
    id: 'phosphine',
    name: '膦基（-PH₂）',
    category: '含磷',
    formula: '-PH₂',
    atoms: [
      { idx: 0, symbol: 'P', x: 0, y: 0, z: 0 },
      { idx: 1, symbol: 'H', ...pos(TET1, BL['P-H'][1]) },
      { idx: 2, symbol: 'H', ...pos(TET2, BL['P-H'][1]) },
    ],
    bonds: [
      { atom1Idx: 0, atom2Idx: 1, order: 1 },
      { atom1Idx: 0, atom2Idx: 2, order: 1 },
    ],
    emptyBonds: [
      { atomIdx: 0, order: 1, position: pos(TET3, EB_LEN['P']) },
    ],
    connectionPoint: 0,
  },
];

/** 官能团分类顺序 */
export const FUNCTIONAL_GROUP_CATEGORIES = ['烃类', '含氧', '含氮', '含硫', '含卤素', '含磷'];

/** 根据 id 查找官能团 */
export function getFunctionalGroupById(id: string): FunctionalGroup | undefined {
  return FUNCTIONAL_GROUPS.find(g => g.id === id);
}
