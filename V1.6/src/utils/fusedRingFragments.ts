/**
 * 稠环碎片库 - 预定义高频使用的稠环骨架
 * 所有碎片只含重原子（无H），共面在XY平面，刚性结构
 * H原子在渲染阶段由 smilesParser 自动补齐
 */

// ============ 数据结构 ============

export interface FusedRingAtom {
  idx: number;
  symbol: string;       // 大写：C, N, O, S
  isAromatic: boolean;
  x: number;            // Å
  y: number;            // Å
  z: number;            // Å（稠环共面，z=0）
  charge: number;
}

export interface FusedRingBond {
  atom1Idx: number;
  atom2Idx: number;
  order: number;        // 1.5 = 芳香键，1=单键，2=双键
}

export interface FusedRingFragment {
  name: string;
  smilesPattern: string;
  atoms: FusedRingAtom[];
  bonds: FusedRingBond[];
  topology: Array<{ idx: number; neighbors: number[] }>;
}

// ============ 辅助函数 ============

/**
 * 生成正六边形环的原子坐标
 */
function generateHexagon(cx: number, cy: number, radius: number): { x: number, y: number }[] {
  const positions: { x: number, y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 2 - i * Math.PI / 3; // 从正上方顺时针
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    });
  }
  return positions;
}

/**
 * 生成正五边形环的原子坐标
 */
function generatePentagon(cx: number, cy: number, radius: number): { x: number, y: number }[] {
  const positions: { x: number, y: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI / 2 - i * 2 * Math.PI / 5;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    });
  }
  return positions;
}

/**
 * 基于六边形的共享边，计算五边形稠环的3个新顶点坐标
 * @param A 共享边端点1（六边形顶点）
 * @param B 共享边端点2（六边形顶点）
 * @param hexCenter 六边形中心（用于确定"外侧"方向）
 * @returns 3个新顶点，顺序为：从A顺时针到B [A的邻居, 中间顶点, B的邻居]
 */
function generatePentagonFromSharedEdge(
  A: { x: number, y: number },
  B: { x: number, y: number },
  hexCenter: { x: number, y: number }
): { x: number, y: number }[] {
  // 共享边中点
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  // 从六边形中心到边中点的方向（即"外侧"方向）
  const outDir = { x: mid.x - hexCenter.x, y: mid.y - hexCenter.y };
  const outLen = Math.sqrt(outDir.x ** 2 + outDir.y ** 2);
  outDir.x /= outLen;
  outDir.y /= outLen;
  // 五边形边心距（apothem）
  const apothem = R / (2 * Math.tan(Math.PI / 5));
  // 五边形中心
  const pentCenter = {
    x: mid.x + outDir.x * apothem,
    y: mid.y + outDir.y * apothem
  };
  // 五边形外接圆半径
  const circumradius = R / (2 * Math.sin(Math.PI / 5));
  // A相对于五边形中心的角度
  const angleA = Math.atan2(A.y - pentCenter.y, A.x - pentCenter.x);
  // 从A顺时针（角度递减），3个新顶点
  const result: { x: number, y: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const angle = angleA - i * 2 * Math.PI / 5;
    result.push({
      x: parseFloat((pentCenter.x + circumradius * Math.cos(angle)).toFixed(6)),
      y: parseFloat((pentCenter.y + circumradius * Math.sin(angle)).toFixed(6))
    });
  }
  return result;
}

const R = 1.40; // 标准芳香键长 Å
const SQRT3 = Math.sqrt(3);

// 将原子符号归一化，用于碎片匹配
// 'Se'/'SE' -> 'SE', 其他保持原样大写
function normalizeAtomSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  if (s === 'SE') return 'SE';
  return s;
}

// ============ 碎片定义 ============

// ------------------------------
// 1. 萘 (Naphthalene) - 2个苯环稠合
// ------------------------------
const naphthalene: FusedRingFragment = {
  name: '萘',
  smilesPattern: 'c1ccc2ccccc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const right = generateHexagon(cx2, cy, R);
    // 右六边形中：right[5]=frag1(共享), right[4]=frag2(共享)
    // 非共享原子：right[0], right[1], right[2], right[3] → frag 6, 7, 8, 9
    for (let i = 0; i < 4; i++) {
      const idx = i + 6;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
  ],
};

// ------------------------------
// 2. 蒽 (Anthracene) - 3个苯环线性稠合
// 14个C原子: ring0=0-5, ring1=1,6,7,8,9,2, ring2=6,10,11,12,13,7
// ring0和ring1共享边1-2 (ring0的vertex1-2 ↔ ring1的vertex5-0)
// ring1和ring2共享边1-2 (ring1的vertex1-2 ↔ ring2的vertex5-0)
// SMILES: c1ccc2cc3ccccc3cc2c1
// ------------------------------
const anthracene: FusedRingFragment = {
  name: '蒽',
  smilesPattern: 'c1ccc2cc3ccccc3cc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cx3 = cx2 + R * SQRT3;
    const cy = 0;
    const ring0 = generateHexagon(cx1, cy, R);
    const ring1 = generateHexagon(cx2, cy, R);
    const ring2 = generateHexagon(cx3, cy, R);
    
    // ring0: 6个原子 (0-5)
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring0[i].x.toFixed(6)), y: parseFloat(ring0[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // ring1: 4个新原子 (6-9)
    // ring0的vertex1(右上)=ring1的vertex5(左上), ring0的vertex2(右下)=ring1的vertex4(左下)
    // ring1的非共享顶点: 0(上),1(右上),2(右下),3(下) -> atoms 6,7,8,9
    for (const i of [0, 1, 2, 3]) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(ring1[i].x.toFixed(6)), y: parseFloat(ring1[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // ring2: 4个新原子 (10-13)
    // ring1的vertex1(右上)=ring2的vertex5(左上), ring1的vertex2(右下)=ring2的vertex4(左下)
    // ring2的非共享顶点: 0(上),1(右上),2(右下),3(下) -> atoms 10,11,12,13
    for (const i of [0, 1, 2, 3]) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(ring2[i].x.toFixed(6)), y: parseFloat(ring2[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    return atoms;
  })(),
  bonds: [
    // ring0 (0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    
    // ring1: 共享原子1,2 + 新原子6,7,8,9
    // ring1: 1-6-7-8-9-2-1
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    
    // ring2: 共享原子7,8 + 新原子10,11,12,13
    // ring2: 7-10-11-12-13-8-7
    { atom1Idx: 7, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 8, order: 1.5 },
  ],
  topology: [
    // ring0
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    
    // ring1
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8, 10] },
    { idx: 8, neighbors: [7, 9, 13] },
    { idx: 9, neighbors: [8, 2] },
    
    // ring2
    { idx: 10, neighbors: [7, 11] },
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 13] },
    { idx: 13, neighbors: [12, 8] },
  ],
};

// ------------------------------
// 3. 菲 (Phenanthrene) - 3个苯环角状稠合
// 14个C原子: 上环0-5, 中环3-4-6-7-8-13, 下环8-9-10-11-12-13
// 上环和中环共享边3-4, 中环和下环共享边8-13
// 角状稠合：三环中心形成120°角
// SMILES: c1ccc2c(c1)ccc3ccccc23
// ------------------------------
const phenanthrene: FusedRingFragment = {
  name: '菲',
  smilesPattern: 'c1ccc2c(c1)ccc3ccccc23',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 上环中心: (0, 0)
    const ring0 = generateHexagon(0, 0, R);
    // atom 0=v0, 1=v1, 2=v2, 3=v3, 4=v4, 5=v5
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring0[i].x.toFixed(6)), y: parseFloat(ring0[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 中环中心: (-R*SQRT3/2, -R*1.5)
    // 与上环共享边3-4: ring0[3]=(0,-R), ring0[4]=(-R*SQRT3/2,-R/2)
    // 在中环中: ring0[3]对应middle[1], ring0[4]对应middle[0]
    const cx2 = -R * SQRT3 / 2;
    const cy2 = -R * 1.5;
    const middle = generateHexagon(cx2, cy2, R);
    // 中环顶点映射: v0=atom4, v1=atom3, v2=atom13, v3=atom8, v4=atom7, v5=atom6
    // 新原子: 6=middle[5], 7=middle[4], 8=middle[3], 13=middle[2]
    atoms.push({ idx: 6, symbol: 'C', isAromatic: true, x: parseFloat(middle[5].x.toFixed(6)), y: parseFloat(middle[5].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: parseFloat(middle[4].x.toFixed(6)), y: parseFloat(middle[4].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: parseFloat(middle[3].x.toFixed(6)), y: parseFloat(middle[3].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 13, symbol: 'C', isAromatic: true, x: parseFloat(middle[2].x.toFixed(6)), y: parseFloat(middle[2].y.toFixed(6)), z: 0, charge: 0 });
    // 下环中心: (0, -R*3)
    // 与中环共享边8-13: middle[3]=atom8, middle[2]=atom13
    // 在下环中: middle[3]对应bottom[5], middle[2]对应bottom[0]
    const cx3 = 0;
    const cy3 = -R * 3;
    const bottom = generateHexagon(cx3, cy3, R);
    // 下环顶点映射: v0=atom13, v1=atom12, v2=atom11, v3=atom10, v4=atom9, v5=atom8
    // 新原子: 9=bottom[4], 10=bottom[3], 11=bottom[2], 12=bottom[1]
    atoms.push({ idx: 9, symbol: 'C', isAromatic: true, x: parseFloat(bottom[4].x.toFixed(6)), y: parseFloat(bottom[4].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 10, symbol: 'C', isAromatic: true, x: parseFloat(bottom[3].x.toFixed(6)), y: parseFloat(bottom[3].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 11, symbol: 'C', isAromatic: true, x: parseFloat(bottom[2].x.toFixed(6)), y: parseFloat(bottom[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 12, symbol: 'C', isAromatic: true, x: parseFloat(bottom[1].x.toFixed(6)), y: parseFloat(bottom[1].y.toFixed(6)), z: 0, charge: 0 });
    return atoms.sort((a, b) => a.idx - b.idx);
  })(),
  bonds: [
    // 上环 (0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 中环: 3-4-6-7-8-13 (共享原子3和4)
    { atom1Idx: 4, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 3, order: 1.5 },
    // 下环: 8-9-10-11-12-13 (共享原子8和13)
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4, 13] },
    { idx: 4, neighbors: [3, 5, 6] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [4, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9, 13] },
    { idx: 9, neighbors: [8, 10] },
    { idx: 10, neighbors: [9, 11] },
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 13] },
    { idx: 13, neighbors: [3, 8, 12] },
  ],
};

// ------------------------------
// 4. 吲哚 (Indole) - 苯并吡咯
// ------------------------------
const indole: FusedRingFragment = {
  name: '吲哚',
  smilesPattern: 'c1ccc2c(c1)[nH]cc2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });
    // 右环：吡咯（5元环，含N）
    // 共享原子3和4，顺时针: A(3) → C(8) → C(7) → N(6) → B(4)
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    atoms.push({ idx: 6, symbol: 'N', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 3, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4, 8] },
    { idx: 4, neighbors: [3, 5, 6] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [4, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 3] },
  ],
};

// ------------------------------
// 5. 喹啉 (Quinoline) - 苯并吡啶
// ------------------------------
const quinoline: FusedRingFragment = {
  name: '喹啉',
  smilesPattern: 'c1ccc2nc-cccc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    const right = generateHexagon(cx2, cy, R);
    // 右六边形中：right[5]和right[4]是共享原子
    // 非共享原子：right[0], right[1], right[2], right[3]
    for (let i = 0; i < 4; i++) {
      const idx = 6 + i;
      atoms.push({ idx, symbol: i === 0 ? 'N' : 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
  ],
};

// ------------------------------
// 6. 苯并咪唑 (Benzimidazole)
// ------------------------------
const benzimidazole: FusedRingFragment = {
  name: '苯并咪唑',
  smilesPattern: 'c1ccc2c(c1)[nH]c[nH]c2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });
    // 右环：咪唑（5元环，含2个N）
    // 共享原子3和4，顺时针: A(3) → N(8) → C(7) → N(6) → B(4)
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    atoms.push({ idx: 6, symbol: 'N', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'N', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 3, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4, 8] },
    { idx: 4, neighbors: [3, 5, 6] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [4, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 3] },
  ],
};

// ------------------------------
// 7. 芘 (Pyrene) - 4个苯环稠合（正方形排列）
// 4个六边形中心:
//   ring0: (-R*√3/2, -R*√3/2)
//   ring1: (R*√3/2, -R*√3/2)
//   ring2: (-R*√3/2, R*√3/2)
//   ring3: (R*√3/2, R*√3/2)
// 相邻六边形中心距 R*√3, 共享边
// 每个ring添加的顶点:
//   ring0: vertices 0,1,2,3,4,5 (6个)
//   ring1: shares edge 5-0 with ring0, adds vertices 1,2,3,4 (4个)
//   ring2: shares edge 3-4 with ring0, adds vertices 0,1,2,5 (4个)
//   ring3: shares edge 3-4 with ring1 AND edge 5-0 with ring2, adds vertices 1,2 (2个)
// 总计: 6+4+4+2 = 16个C原子
// ------------------------------
const pyrene: FusedRingFragment = {
  name: '芘',
  smilesPattern: 'c1cc2ccc3cccc4ccc(c1)c2c34',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const offset = R * SQRT3 / 2;
    const cy_offset = -offset; // ring0, ring1 的 y 坐标

    // ring0: 中心在 (-offset, cy_offset), 添加全部6个顶点
    const ring0 = generateHexagon(-offset, cy_offset, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring0[i].x.toFixed(6)), y: parseFloat(ring0[i].y.toFixed(6)), z: 0, charge: 0 });
    }

    // ring1: 中心在 (offset, cy_offset), shares edge 5-0 with ring0, adds vertices 1,2,3,4
    const ring1 = generateHexagon(offset, cy_offset, R);
    // ring1 与 ring0 共享 edge 5-0, 所以 ring1 的顶点 5,0 与 ring0 的顶点 5,0 重合
    // ring1 添加顶点 1,2,3,4 → atoms 6,7,8,9
    for (let i = 1; i <= 4; i++) {
      const idx = 6 + (i - 1);
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring1[i].x.toFixed(6)), y: parseFloat(ring1[i].y.toFixed(6)), z: 0, charge: 0 });
    }

    // ring2: 中心在 (-offset, -cy_offset), shares edge 3-4 with ring0, adds vertices 0,1,2,5
    const ring2 = generateHexagon(-offset, -cy_offset, R);
    // ring2 与 ring0 共享 edge 3-4, 所以 ring2 的顶点 3,4 与 ring0 的顶点 3,4 重合
    // ring2 添加顶点 0,1,2,5 → atoms 10,11,12,13
    const ring2AddVerts = [0, 1, 2, 5];
    for (let i = 0; i < ring2AddVerts.length; i++) {
      const vIdx = ring2AddVerts[i];
      const idx = 10 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring2[vIdx].x.toFixed(6)), y: parseFloat(ring2[vIdx].y.toFixed(6)), z: 0, charge: 0 });
    }

    // ring3: 中心在 (offset, -cy_offset), shares edge 3-4 with ring1 AND edge 5-0 with ring2, adds vertices 1,2
    const ring3 = generateHexagon(offset, -cy_offset, R);
    // ring3 与 ring1 共享 edge 3-4, 与 ring2 共享 edge 5-0
    // ring3 添加顶点 1,2 → atoms 14,15
    for (let i = 1; i <= 2; i++) {
      const idx = 14 + (i - 1);
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring3[i].x.toFixed(6)), y: parseFloat(ring3[i].y.toFixed(6)), z: 0, charge: 0 });
    }

    return atoms;
  })(),
  bonds: [
    // ring0 hexagon (atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // ring1 hexagon (atoms 0,5 shared with ring0; 6,7,8,9 new)
    // ring1 edges: 0-1, 1-2, 2-3, 3-4, 4-5 (4-5 is shared edge)
    // atoms: 0(shared), 5(shared), 6(new), 7(new), 8(new), 9(new)
    { atom1Idx: 0, atom2Idx: 6, order: 1.5 }, // ring0.vertex0 to ring1.vertex1
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 5, order: 1.5 }, // ring1.vertex4 to ring0.vertex5
    // ring2 hexagon (atoms 3,4 shared with ring0; 10,11,12,13 new)
    // ring2 shares edge 3-4 with ring0
    { atom1Idx: 10, atom2Idx: 3, order: 1.5 }, // ring2.vertex0 to ring0.vertex3
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 4, order: 1.5 }, // ring2.vertex2 to ring0.vertex4
    // ring3 hexagon (atoms 1,2 shared with both ring1 and ring2; 14,15 new)
    // ring3 shares edge 3-4 with ring1 and edge 5-0 with ring2
    { atom1Idx: 14, atom2Idx: 2, order: 1.5 }, // ring3.vertex1 to ring1.vertex3
    { atom1Idx: 14, atom2Idx: 15, order: 1.5 },
    { atom1Idx: 15, atom2Idx: 1, order: 1.5 }, // ring3.vertex2 to ring2.vertex5
  ],
  topology: [
    // ring0 (atoms 0-5)
    { idx: 0, neighbors: [5, 1, 6] },   // connected to ring0[5], ring0[1], ring1[0]
    { idx: 1, neighbors: [0, 2, 15] },  // connected to ring0[0], ring0[2], ring3[2]
    { idx: 2, neighbors: [1, 3, 14] },  // connected to ring0[1], ring0[3], ring3[1]
    { idx: 3, neighbors: [2, 4, 10] },  // connected to ring0[2], ring0[4], ring2[0]
    { idx: 4, neighbors: [3, 5, 12] },  // connected to ring0[3], ring0[5], ring2[2]
    { idx: 5, neighbors: [4, 0, 9] },   // connected to ring0[4], ring0[0], ring1[4]
    // ring1 (atoms 6-9): vertex 0,1,2,3,4,5 where 0,5 are shared with ring0
    // new vertices: 1,2,3,4 -> atoms 6,7,8,9
    { idx: 6, neighbors: [0, 7] },      // ring1 vertex 1
    { idx: 7, neighbors: [6, 8] },      // ring1 vertex 2
    { idx: 8, neighbors: [7, 9, 14] },  // ring1 vertex 3 (also connected to ring3 vertex 1)
    { idx: 9, neighbors: [8, 5, 15] },  // ring1 vertex 4 (also connected to ring3 vertex 2)
    // ring2 (atoms 10-13): vertex 0,1,2,3,4,5 where 3,4 are shared with ring0
    // new vertices: 0,1,2,5 -> atoms 10,11,12,13
    { idx: 10, neighbors: [3, 11, 15] }, // ring2 vertex 0 (also connected to ring3 vertex 2)
    { idx: 11, neighbors: [10, 12] },   // ring2 vertex 1
    { idx: 12, neighbors: [11, 4, 13] }, // ring2 vertex 2
    { idx: 13, neighbors: [12, 10] },    // ring2 vertex 5 (connected to ring2 vertex 2 and ring2 vertex 0 via ring3)
    // ring3 (atoms 14-15): vertex 0,1,2,3,4,5 where:
    //   3,4 from ring1 (atoms 8,9)
    //   5,0 from ring2 (atoms 13,10)
    //   1,2 new -> atoms 14,15
    { idx: 14, neighbors: [8, 15] },    // ring3 vertex 1
    { idx: 15, neighbors: [9, 14, 10] }, // ring3 vertex 2
  ],
};

// ------------------------------
// 8. 嘌呤 (Purine) - 嘧啶并咪唑
// ------------------------------
const purine: FusedRingFragment = {
  name: '嘌呤',
  smilesPattern: 'c1nc[nH]c2nc1c[nH]c2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const hexCx = 0;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) {
      const symbol = i === 0 || i === 3 ? 'N' : 'C';
      atoms.push({ idx: i, symbol, isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 右环：咪唑（5元环，含N）
    // 共享原子2和3，顺时针: A(2) → C(6) → N(7) → C(8) → B(3)
    const pentVerts = generatePentagonFromSharedEdge(hex[2], hex[3], { x: hexCx, y: hexCy });
    atoms.push({ idx: 6, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'N', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 3, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3, 6] },
    { idx: 3, neighbors: [2, 4, 8] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [2, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 3] },
  ],
};

// ------------------------------
// 9. 芴 (Fluorene) - 两个苯环通过五元环连接
// 芴的原子数：13个C
// SMILES: c1ccc2c(c1)-c3ccccc3-c2
// 结构:
//   左苯环: atoms 0-5
//   右苯环: atoms 6-11
//   五元环: left[5], C(12), C(13), C(14), right[0]
// 五元环中心在两苯环之间，使用共享边对齐生成
// ------------------------------
const fluorene: FusedRingFragment = {
  name: '芴',
  smilesPattern: 'c1ccc2c(c1)-c3ccccc3-c2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 萘骨架: 两个苯环共享边
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    const right = generateHexagon(cx2, cy, R);
    
    // 左苯环: 0-5 (6个C)
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // 右苯环: 共享原子1,2 + 新原子6,7,8,9
    for (const i of [0, 3, 4, 5]) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // 五元环(sp3碳桥): left[5]和right[0]之间插入两个sp3碳
    const midX = (left[5].x + right[0].x) / 2;
    const midY = (left[5].y + right[0].y) / 2;
    const outDirX = midX - cx1;
    const outDirY = midY - 0;
    const outLen = Math.sqrt(outDirX * outDirX + outDirY * outDirY);
    const normX = outDirX / outLen;
    const normY = outDirY / outLen;
    const apothem = R * 0.5;
    const pentCenterX = midX + normX * apothem;
    const pentCenterY = midY + normY * apothem;
    const pent = generatePentagon(pentCenterX, pentCenterY, R * 0.5);
    
    atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: false, x: parseFloat(pent[0].x.toFixed(6)), y: parseFloat(pent[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: false, x: parseFloat(pent[1].x.toFixed(6)), y: parseFloat(pent[1].y.toFixed(6)), z: 0, charge: 0 });
    
    return atoms;
  })(),
  bonds: [
    // 左苯环 (0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环 (1,6,7,8,9,2)
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    // 五元环: 5-10-11-6-7-5
    { atom1Idx: 5, atom2Idx: 10, order: 1 },
    { atom1Idx: 10, atom2Idx: 11, order: 1 },
    { atom1Idx: 11, atom2Idx: 6, order: 1 },
    { atom1Idx: 6, atom2Idx: 7, order: 1 },
    { atom1Idx: 7, atom2Idx: 5, order: 1 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0, 10, 7] },
    { idx: 6, neighbors: [1, 9, 10] },
    { idx: 7, neighbors: [6, 8, 5] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
    { idx: 10, neighbors: [5, 11] },
    { idx: 11, neighbors: [10, 6] },
  ],
};

// ------------------------------
// 10. 二苯并呋喃 (Dibenzofuran) - 两个苯环通过呋喃环连接
// 二苯并呋喃的原子数：12个C + 1个O = 13个原子
// SMILES: c1ccc2c(c1)oc3ccccc32
// 结构:
//   左苯环: atoms 0-5
//   呋喃环: left[5], O(12), C(13), C(14), right[0]
//   右苯环: atoms 6-11
// 五元环使用共享边生成，确保与苯环对齐
// ------------------------------
const dibenzofuran: FusedRingFragment = {
  name: '二苯并呋喃',
  smilesPattern: 'c1ccc2c(c1)oc3ccccc32',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左苯环中心: (-R*√3*0.75, 0)
    const cx1 = -R * SQRT3 * 0.75;
    // 右苯环中心: (R*√3*0.75, 0)
    const cx2 = R * SQRT3 * 0.75;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    const right = generateHexagon(cx2, cy, R);
    for (let i = 0; i < 6; i++) {
      const idx = 6 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 呋喃环使用共享边生成
    // 呋喃环: left[5], O(12), C(13), C(14), right[0]
    const pentVerts = generatePentagonFromSharedEdge(left[5], right[0], { x: cx1, y: cy });
    // pentVerts = [left[5]的邻居(O), 中间(C), right[0]的邻居(C)]
    atoms.push({ idx: 12, symbol: 'O', isAromatic: false, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 13, symbol: 'C', isAromatic: false, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 14, symbol: 'C', isAromatic: false, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左苯环 (atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环 (atoms 6-11)
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 6, order: 1.5 },
    // 呋喃环: left[5]-12(O)-13-14-right[0]
    { atom1Idx: 5, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 6, order: 1.5 },
  ],
  topology: [
    // 左苯环
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0, 12] },
    // 右苯环
    { idx: 6, neighbors: [11, 7, 14] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 10] },
    { idx: 10, neighbors: [9, 11] },
    { idx: 11, neighbors: [10, 6] },
    // 呋喃环
    { idx: 12, neighbors: [5, 13] },
    { idx: 13, neighbors: [12, 14] },
    { idx: 14, neighbors: [13, 6] },
  ],
};

// ------------------------------
// 11. 苯并恶唑 (Benzoxazole) - 苯环与恶唑稠合
// 拓扑: 左环(0-5)为苯环, 右环(3,8,7,6,4)为恶唑(含O和N)
// 共享边: 3-4
// 顺时针从A(3)到B(4): A → O(8) → C(7) → N(6) → B
// ------------------------------
const benzoxazole: FusedRingFragment = {
  name: '苯并恶唑',
  smilesPattern: 'c1ccc2c(c1)ocn2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：苯环（6元环）
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });
    
    // 右环：恶唑（5元环，含N和O）
    // 共享原子3和4的位置来自左环
    // 使用精确的五边形计算，确保与六边形共享边对齐
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    // pentVerts顺序: [A的邻居(O), 中间(C), B的邻居(N)]
    // A=frag3 → O(frag8), B=frag4 → N(frag6)
    atoms.push({ idx: 6, symbol: 'N', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'O', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左环(苯环)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右环(恶唑): 3-8(O)-7(C)-6(N)-4
    { atom1Idx: 3, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 4, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },       // 2度 C
    { idx: 1, neighbors: [0, 2] },        // 2度 C
    { idx: 2, neighbors: [1, 3] },        // 2度 C
    { idx: 3, neighbors: [2, 4, 8] },     // 3度 C (shared, 连O)
    { idx: 4, neighbors: [3, 5, 6] },     // 3度 C (shared, 连N)
    { idx: 5, neighbors: [4, 0] },        // 2度 C
    { idx: 6, neighbors: [4, 7] },        // 2度 N
    { idx: 7, neighbors: [6, 8] },        // 2度 C
    { idx: 8, neighbors: [7, 3] },        // 2度 O
  ],
};

// ------------------------------
// 12. 苯并噻唑 (Benzothiazole) - 苯环与噻唑稠合
// 噻唑是含N和S的五元杂环
// 9个原子: 7C + 1N + 1S
// 拓扑: 左环(0-5)为苯环, 右环(3,8,7,6,4)为噻唑(含S和N)
// 共享边: 3-4
// 顺时针从A(3)到B(4): A → S(8) → C(7) → N(6) → B
// ------------------------------
const benzothiazole: FusedRingFragment = {
  name: '苯并噻唑',
  smilesPattern: 'c1ccc2c(c1)scc2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：苯环（6元环）
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });

    // 右环：噻唑（5元环，含S和N）
    // 共享原子3和4
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    // pentVerts顺序: [A的邻居(S), 中间(C), B的邻居(N)]
    atoms.push({ idx: 6, symbol: 'N', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'S', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左环(苯环)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右环(噻唑): 3-S(8)-C(7)-N(6)-4
    { atom1Idx: 3, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 4, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },       // 2度 C
    { idx: 1, neighbors: [0, 2] },       // 2度 C
    { idx: 2, neighbors: [1, 3] },       // 2度 C
    { idx: 3, neighbors: [2, 4, 8] },   // 3度 C (shared, 连S)
    { idx: 4, neighbors: [3, 5, 6] },   // 3度 C (shared, 连N)
    { idx: 5, neighbors: [4, 0] },       // 2度 C
    { idx: 6, neighbors: [4, 7] },      // 2度 N
    { idx: 7, neighbors: [6, 8] },      // 2度 C
    { idx: 8, neighbors: [7, 3] },      // 2度 S
  ],
};

// ------------------------------
// 13. 异喹啉 (Isoquinoline) - 苯并吡啶，N在1位
// 10个原子: 9C + 1N
// 结构类似萘，但右侧环是吡啶环，N位于不同于喹啉的位置
// ------------------------------
const isoquinoline: FusedRingFragment = {
  name: '异喹啉',
  smilesPattern: 'c1ccc2ccncc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左苯环
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    const right = generateHexagon(cx2, cy, R);
    // 右六边形中：right[5]和right[4]是共享原子(1和2)
    // 异喹啉的N在right[0]位置
    for (let i = 0; i < 4; i++) {
      const idx = 6 + i;
      atoms.push({ idx, symbol: i === 0 ? 'N' : 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    // 左苯环
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 稠合边: 1-2
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [1, 7] },      // N
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
  ],
};

// ------------------------------
// 14. 苯并呋喃 (Benzofuran) - 苯环并呋喃
// 9个原子: 8C + 1O
// 呋喃是含O的五元杂环
// ------------------------------
const benzofuran: FusedRingFragment = {
  name: '苯并呋喃',
  smilesPattern: 'c1ccc2c(c1)occ2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：苯环（6元环）
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });

    // 右环：呋喃（5元环，含O）
    // 共享原子3和4
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    // pentVerts顺序: [A的邻居(O), 中间(C), B的邻居(C)]
    atoms.push({ idx: 6, symbol: 'O', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左环(苯环)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右环(呋喃): 3-O(6)-C(7)-C(8)-4
    { atom1Idx: 3, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 4, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },       // 2度 C
    { idx: 1, neighbors: [0, 2] },       // 2度 C
    { idx: 2, neighbors: [1, 3] },       // 2度 C
    { idx: 3, neighbors: [2, 4, 6] },   // 3度 C (shared, 连O)
    { idx: 4, neighbors: [3, 5, 8] },   // 3度 C (shared, 连C)
    { idx: 5, neighbors: [4, 0] },       // 2度 C
    { idx: 6, neighbors: [3, 7] },      // 2度 O
    { idx: 7, neighbors: [6, 8] },      // 2度 C
    { idx: 8, neighbors: [7, 4] },      // 2度 C
  ],
};

// ------------------------------
// 15. 苯并噻喃 (Benzothiophene) - 苯环并噻喃
// 9个原子: 8C + 1S
// 噻喃是含S的五元杂环
// ------------------------------
const benzothiophene: FusedRingFragment = {
  name: '苯并噻喃',
  smilesPattern: 'c1ccc2c(c1)scc2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：苯环（6元环）
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });

    // 右环：噻喃（5元环，含S）
    // 共享原子3和4
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    // pentVerts顺序: [A的邻居(S), 中间(C), B的邻居(C)]
    atoms.push({ idx: 6, symbol: 'S', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左环(苯环)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右环(噻喃): 3-S(6)-C(7)-C(8)-4
    { atom1Idx: 3, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 4, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },       // 2度 C
    { idx: 1, neighbors: [0, 2] },       // 2度 C
    { idx: 2, neighbors: [1, 3] },       // 2度 C
    { idx: 3, neighbors: [2, 4, 6] },   // 3度 C (shared, 连S)
    { idx: 4, neighbors: [3, 5, 8] },   // 3度 C (shared, 连C)
    { idx: 5, neighbors: [4, 0] },       // 2度 C
    { idx: 6, neighbors: [3, 7] },      // 2度 S
    { idx: 7, neighbors: [6, 8] },      // 2度 C
    { idx: 8, neighbors: [7, 4] },      // 2度 C
  ],
};

// ------------------------------
// 16. 咔唑 (Carbazole) - 两个苯环并吡咯
// 13个原子: 12C + 1N
// 结构: 左苯环 + 中间吡咯环(五元，含N-H) + 右苯环
// 五元环使用共享边生成，确保与苯环对齐
// ------------------------------
const carbazole: FusedRingFragment = {
  name: '咔唑',
  smilesPattern: 'c1ccc2c(c1)[nH]c3ccccc23',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左苯环中心: (-R*√3*0.75, 0)
    const cx1 = -R * SQRT3 * 0.75;
    // 右苯环中心: (R*√3*0.75, 0)
    const cx2 = R * SQRT3 * 0.75;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    const right = generateHexagon(cx2, cy, R);
    for (let i = 0; i < 6; i++) {
      const idx = 9 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 吡咯环使用共享边生成
    // 吡咯环: left[5], C(6), C(7), N(8), right[0]
    const pentVerts = generatePentagonFromSharedEdge(left[5], right[0], { x: cx1, y: cy });
    // pentVerts = [left[5]的邻居(C), 中间(C), right[0]的邻居(N)]
    atoms.push({ idx: 6, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'N', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左苯环 (atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环 (atoms 9-14)
    { atom1Idx: 9, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 9, order: 1.5 },
    // 五元环(吡咯): left[5]-6-7-8(N)-right[0]
    { atom1Idx: 5, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
  ],
  topology: [
    // 左苯环
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0, 6] },
    // 五元环(吡咯)
    { idx: 6, neighbors: [5, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },       // N连接C和右苯环
    // 右苯环
    { idx: 9, neighbors: [8, 10, 14] },
    { idx: 10, neighbors: [9, 11] },
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 13] },
    { idx: 13, neighbors: [12, 14] },
    { idx: 14, neighbors: [13, 9] },
  ],
};

// ------------------------------
// 17. 吖啶 (Acridine) - 三个六元环直线稠合，中间环为吡啶
// 13个原子: 12C + 1N
// SMILES: c1ccc2c(c1)nc3ccccc23
// 结构: 左苯环(0-5) + 中吡啶环(1,6,7,8,9,2) + 右苯环(6,10,11,12,13,7)
// 稠合关系:
//   - 左环(0-5) 与 中环(1,6,7,8,9,2) 共享边 1-2 (左环顶点1-2 对应 中环顶点5-4)
//   - 中环(1,6,7,8,9,2) 与 右环(6,10,11,12,13,7) 共享边 1-2 (中环顶点1-2 对应 右环顶点5-4)
// 注意: N位于中环顶点1位置（与左环共享边的对面）
// ------------------------------
const acridine: FusedRingFragment = {
  name: '吖啶',
  smilesPattern: 'c1ccc2c(c1)nc3ccccc23',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 三个六元环直线稠合，中心距 R*SQRT3
    // 左环中心: -R*SQRT3
    // 中环中心: 0
    // 右环中心: R*SQRT3
    const cx0 = -R * SQRT3;
    const cx1 = 0;
    const cx2 = R * SQRT3;
    const cy = 0;
    
    // 左环 (0-5): 6个C
    const ring0 = generateHexagon(cx0, cy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring0[i].x.toFixed(6)), y: parseFloat(ring0[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // 中环 (1,6,7,8,9,2): 4个C + 1个N
    // 左环的顶点1和2 对应 中环的顶点5和4
    // N位于中环顶点1位置 (ring1[1])
    const ring1 = generateHexagon(cx1, cy, R);
    // ring1[0] = 左环顶点1, ring1[1] = 左环顶点2 (共享边)
    // 但根据稠合关系，应该是 ring1[5] = 左环顶点1, ring1[4] = 左环顶点2
    // 所以中环 atoms: 5(左1), 1(左2), 6,7,8,9
    // N在 atom1 (中环顶点1)，即 ring1[1] 的位置
    // 中环: atom1=左2(N), atom6=ring1[0], atom7=ring1[1], atom8=ring1[2], atom9=ring1[3]
    // 这样中环的原子顺序是: 1(共享), 6, 7, 8, 9, 5(共享)
    atoms.push({ idx: 6, symbol: 'N', isAromatic: true, x: parseFloat(ring1[0].x.toFixed(6)), y: parseFloat(ring1[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: parseFloat(ring1[1].x.toFixed(6)), y: parseFloat(ring1[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: parseFloat(ring1[2].x.toFixed(6)), y: parseFloat(ring1[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 9, symbol: 'C', isAromatic: true, x: parseFloat(ring1[3].x.toFixed(6)), y: parseFloat(ring1[3].y.toFixed(6)), z: 0, charge: 0 });
    
    // 右环 (6,10,11,12,13,7): 4个新C
    // 中环的顶点1和2 对应 右环的顶点5和4
    // 右环: atom6(中1), 10, 11, 12, 13, atom7(中2)
    const ring2 = generateHexagon(cx2, cy, R);
    // ring2[0] = 中环顶点1, ring2[1] = 中环顶点2 (共享边)
    // 右环新原子: ring2[0], ring2[1], ring2[2], ring2[3] -> atoms 10, 11, 12, 13
    for (let i = 0; i < 4; i++) {
      const idx = 10 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring2[i].x.toFixed(6)), y: parseFloat(ring2[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    // 左环 (atoms 0-5): 0-1-2-3-4-5-0
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 稠合边 左环-中环: 左顶点1-2 对应 中顶点5-4
    // 左环顶点1=atom1, 左环顶点2=atom2
    // 中环顶点5=atom5, 中环顶点4=atom9
    { atom1Idx: 1, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 9, order: 1.5 },
    // 中环 (atoms 5,6,7,8,9,1): 5-6-7-8-9-1-5 (N at 6)
    { atom1Idx: 5, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 1, order: 1.5 },
    // 稠合边 中环-右环: 中顶点1-2 对应 右顶点5-4
    // 中环顶点1=atom6, 中环顶点2=atom7
    // 右环顶点5=atom10, 右环顶点4=atom13
    { atom1Idx: 6, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 13, order: 1.5 },
    // 右环 (atoms 10,11,12,13,7,6): 10-11-12-13-7-6-10
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 6, order: 1.5 },
  ],
  topology: [
    // 左环 (0-5)
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 5] },     // 与中环稠合 (atom5)
    { idx: 2, neighbors: [1, 3, 9] },     // 与中环稠合 (atom9)
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0, 6] },     // 与中环稠合 (atom6)
    // 中环 (6,7,8,9): N at 6, 共享顶点 5,1 对应左环, 6,7 对应右环
    { idx: 6, neighbors: [5, 7, 10] },     // N, 与左环、右环稠合
    { idx: 7, neighbors: [6, 8, 13] },     // 与右环稠合 (atom13)
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },        // 与左环稠合 (atom2)
    // 右环 (10,11,12,13)
    { idx: 10, neighbors: [6, 11] },      // 与中环稠合 (atom6)
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 13] },
    { idx: 13, neighbors: [12, 7] },      // 与中环稠合 (atom7)
  ],
};

// ------------------------------
// 18. 二苯并噻吩 (Dibenzothiophene) - 两个苯环通过噻吩环连接
// 原子: 12C + 1S = 13个
// SMILES: c1ccc2c(c1)sc3ccccc3c2
// 结构:
//   左苯环: atoms 0-5
//   右苯环: atoms 6-11
//   噻吩环: left[5], S(12), C(13), C(14), right[0]
// 五元环使用共享边生成，确保与苯环对齐
// ------------------------------
const dibenzothiophene: FusedRingFragment = {
  name: '二苯并噻吩',
  smilesPattern: 'c1ccc2c(c1)sc3ccccc3c2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左苯环中心: (-R*√3*0.75, 0)
    const cx1 = -R * SQRT3 * 0.75;
    // 右苯环中心: (R*√3*0.75, 0)
    const cx2 = R * SQRT3 * 0.75;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    const right = generateHexagon(cx2, cy, R);
    for (let i = 0; i < 6; i++) {
      const idx = 6 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 噻吩环使用共享边生成
    // 噻吩环: left[5], S(12), C(13), C(14), right[0]
    const pentVerts = generatePentagonFromSharedEdge(left[5], right[0], { x: cx1, y: cy });
    // pentVerts = [left[5]的邻居(S), 中间(C), right[0]的邻居(C)]
    atoms.push({ idx: 12, symbol: 'S', isAromatic: false, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 13, symbol: 'C', isAromatic: false, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 14, symbol: 'C', isAromatic: false, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左苯环 (atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环 (atoms 6-11)
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 6, order: 1.5 },
    // 噻吩环: left[5]-12(S)-13-14-right[0]
    { atom1Idx: 5, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 6, order: 1.5 },
  ],
  topology: [
    // 左苯环
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0, 12] },
    // 右苯环
    { idx: 6, neighbors: [11, 7, 14] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 10] },
    { idx: 10, neighbors: [9, 11] },
    { idx: 11, neighbors: [10, 6] },
    // 噻吩环
    { idx: 12, neighbors: [5, 13] },
    { idx: 13, neighbors: [12, 14] },
    { idx: 14, neighbors: [13, 6] },
  ],
};

// ------------------------------
// 18. β-咔啉 (beta-Carboline) - 吲哚并吡啶
// 13个原子: 11C + 2N
// SMILES: c1ccc2c(c1)[nH]c3cnccc23
// 结构: 苯环(0-5) + 吲哚环(1,2,8,9,10) + 吡啶环(3,4,11,12,13,14,10)
// 稠合关系:
//   - 苯环 与 吲哚环 共享边 1-2 (hex[1]-hex[2])
//   - 苯环 与 吡啶环 共享边 3-4 (hex[3]-hex[4])
//   - 吲哚环 与 吡啶环 共享顶点 10
// 苯环: 6C
// 吲哚环(吡咯部分): 3C+1N
// 吡啶环: 4C+1N
// 总计独特原子: 6C + (3C+1N) + (4C+1N) - 共享 = 11C+2N = 13
// ------------------------------
const betaCarboline: FusedRingFragment = {
  name: 'β-咔啉',
  smilesPattern: 'c1ccc2c(c1)[nH]c3cnccc23',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 苯环 (0-5): 6个C, 中心在 (-R*SQRT3/2, 0)
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // 吲哚环 (五元): atom1(共享), atom2(共享), atom8(C), atom9(C), atom10(N)
    // 五边形从苯环的边1-2生成，位于苯环左侧
    const pentVerts = generatePentagonFromSharedEdge(hex[1], hex[2], { x: hexCx, y: hexCy });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 9, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 10, symbol: 'N', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    
    // 吡啶环 (六元): atom3(共享), atom4(共享), atom11(N), atom12(C), atom13(C), atom14(C)
    // 吡啶环位于苯环下方
    const pyridineCx = hexCx + R * SQRT3 / 2;
    const pyridineCy = -R * 1.5;
    const pyridine = generateHexagon(pyridineCx, pyridineCy, R);
    // pyridine[5] = hex[3], pyridine[4] = hex[4] (苯环共享边3-4)
    // pyridine[0] 与吲哚环共享 atom10
    // pyridine[1] = N, pyridine[2] = C, pyridine[3] = C
    atoms.push({ idx: 11, symbol: 'N', isAromatic: true, x: parseFloat(pyridine[1].x.toFixed(6)), y: parseFloat(pyridine[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 12, symbol: 'C', isAromatic: true, x: parseFloat(pyridine[2].x.toFixed(6)), y: parseFloat(pyridine[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 13, symbol: 'C', isAromatic: true, x: parseFloat(pyridine[3].x.toFixed(6)), y: parseFloat(pyridine[3].y.toFixed(6)), z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 苯环 (atoms 0-5): 0-1-2-3-4-5-0
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 稠合边 苯环-吲哚环: 苯顶点1-2 对应 吲哚顶点1-2
    { atom1Idx: 1, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 9, order: 1.5 },
    // 吲哚环 (atoms 1,2,8,9,10): 1-8-9-10-2-1
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 2, order: 1.5 },
    // 稠合边 苯环-吡啶环: 苯顶点3-4 对应 吡啶顶点5-4
    { atom1Idx: 3, atom2Idx: 11, order: 1.5 },  // 苯顶点3 - 吡啶顶点5 (atom11)
    { atom1Idx: 4, atom2Idx: 13, order: 1.5 },  // 苯顶点4 - 吡啶顶点4
    // 稠合边 吲哚环-吡啶环: 共享顶点10
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },  // 吲哚N - 吡啶N
    // 吡啶环 (atoms 11,12,13,4,3,10): 11-12-13-4-3-10-11
    // 路径: atom11(pyridine[1]) -> atom12(pyridine[2]) -> atom13(pyridine[3]) -> atom4(hex[4]) -> atom3(hex[3]) -> atom10(pyridine[0]) -> atom11
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 10, order: 1.5 },
  ],
  topology: [
    // 苯环 (0-5)
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 8] },      // 与吲哚环稠合
    { idx: 2, neighbors: [1, 3, 9, 10] },  // 与苯环、吲哚环、吡啶环稠合
    { idx: 3, neighbors: [2, 4, 13, 10] }, // 与苯环、吡啶环稠合
    { idx: 4, neighbors: [3, 5, 13] },     // 与苯环、吡啶环稠合
    { idx: 5, neighbors: [4, 0] },
    // 吲哚环 (8,9,10)
    { idx: 8, neighbors: [1, 9] },
    { idx: 9, neighbors: [8, 10] },
    { idx: 10, neighbors: [9, 2, 11, 3] }, // N, 与吲哚环、苯环、吡啶环稠合
    // 吡啶环 (11,12,13)
    { idx: 11, neighbors: [10, 12, 3] },  // N, 与吲哚环、吡啶环、苯环稠合
    { idx: 12, neighbors: [11, 13] },
    { idx: 13, neighbors: [12, 4, 3] },   // C, 与吡啶环、苯环稠合
  ],
};

// ------------------------------
// 14. 蝶啶 (Pteridine) - 嘧啶并吡嗪
// 原子: 6C + 4N = 10个
// SMILES: c1ncnc2nccnc12
// 结构: 两个6元环稠合，均含N
// ------------------------------
const pteridine: FusedRingFragment = {
  name: '蝶啶',
  smilesPattern: 'c1ncnc2nccnc12',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：嘧啶（6元环，含2个N）
    const cx1 = -R * SQRT3 / 2;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    // 嘧啶: N在位置1,3 (六边形顶点1和3)
    atoms.push({ idx: 0, symbol: 'C', isAromatic: true, x: parseFloat(left[0].x.toFixed(6)), y: parseFloat(left[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 1, symbol: 'N', isAromatic: true, x: parseFloat(left[1].x.toFixed(6)), y: parseFloat(left[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 2, symbol: 'C', isAromatic: true, x: parseFloat(left[2].x.toFixed(6)), y: parseFloat(left[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 3, symbol: 'N', isAromatic: true, x: parseFloat(left[3].x.toFixed(6)), y: parseFloat(left[3].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 4, symbol: 'C', isAromatic: true, x: parseFloat(left[4].x.toFixed(6)), y: parseFloat(left[4].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 5, symbol: 'C', isAromatic: true, x: parseFloat(left[5].x.toFixed(6)), y: parseFloat(left[5].y.toFixed(6)), z: 0, charge: 0 });
    
    // 右环：吡嗪（6元环，含2个N）
    // 共享左环的顶点1和2，右六边形中right[5]=左1, right[4]=左2
    // 吡嗪: N在位置2,3 (六边形顶点2和3，即right[2]和right[3])
    const cx2 = cx1 + R * SQRT3;
    const right = generateHexagon(cx2, cy, R);
    atoms.push({ idx: 6, symbol: 'C', isAromatic: true, x: parseFloat(right[0].x.toFixed(6)), y: parseFloat(right[0].y.toFixed(6)), z: 0, charge: 0 }); // right[0] = C
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: parseFloat(right[1].x.toFixed(6)), y: parseFloat(right[1].y.toFixed(6)), z: 0, charge: 0 }); // right[1] = C
    atoms.push({ idx: 8, symbol: 'N', isAromatic: true, x: parseFloat(right[2].x.toFixed(6)), y: parseFloat(right[2].y.toFixed(6)), z: 0, charge: 0 }); // right[2] = N
    atoms.push({ idx: 9, symbol: 'C', isAromatic: true, x: parseFloat(right[3].x.toFixed(6)), y: parseFloat(right[3].y.toFixed(6)), z: 0, charge: 0 }); // right[3] = C
    return atoms;
  })(),
  bonds: [
    // 左环(嘧啶): 0-1-2-3-4-5-0
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 稠合边: 左环的顶点1-2 与 右环的顶点5-4 (原子1-6和原子2-9)
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 }, // 左1-右5
    { atom1Idx: 2, atom2Idx: 9, order: 1.5 }, // 左2-右4
    // 右环(吡嗪): 6-7-8-9-3-2
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 3, order: 1.5 }, // 右4-左3 (闭环)
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },        // 2度 C
    { idx: 1, neighbors: [0, 2, 6] },    // 3度 N (连接左环和右环)
    { idx: 2, neighbors: [1, 3, 9] },    // 3度 C (连接左环和右环)
    { idx: 3, neighbors: [2, 4, 9] },    // 3度 N (连接左环和右环)
    { idx: 4, neighbors: [3, 5] },        // 2度 C
    { idx: 5, neighbors: [4, 0] },        // 2度 C
    { idx: 6, neighbors: [1, 7] },       // 2度 C
    { idx: 7, neighbors: [6, 8] },       // 2度 C
    { idx: 8, neighbors: [7, 9] },       // 2度 N
    { idx: 9, neighbors: [8, 3, 2] },       // 3度 C (连接右环和左环)
  ],
};

// ------------------------------
// 15. 萘啶 (Naphthyridine) - 两个吡啶稠合
// 原子: 8C + 2N = 10个
// SMILES: c1ccnc2cccnc12
// 结构: 两个6元环，每个含1个N
// ------------------------------
const naphthyridine: FusedRingFragment = {
  name: '萘啶',
  smilesPattern: 'c1ccnc2cccnc12',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：吡啶（6元环，含1个N）
    const cx1 = -R * SQRT3 / 2;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    // N at position 2 (left[2])
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: i === 2 ? 'N' : 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // 右环：吡啶（6元环，含1个N）
    // 共享原子1和2，右六边形中：right[5]=1, right[4]=2
    // 非共享原子：right[0], right[1], right[2], right[3] → atoms 6, 7, 8, 9
    const cx2 = cx1 + R * SQRT3;
    const right = generateHexagon(cx2, cy, R);
    // N at right[2] position
    atoms.push({ idx: 6, symbol: 'C', isAromatic: true, x: parseFloat(right[0].x.toFixed(6)), y: parseFloat(right[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: parseFloat(right[1].x.toFixed(6)), y: parseFloat(right[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'N', isAromatic: true, x: parseFloat(right[2].x.toFixed(6)), y: parseFloat(right[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 9, symbol: 'C', isAromatic: true, x: parseFloat(right[3].x.toFixed(6)), y: parseFloat(right[3].y.toFixed(6)), z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左环(吡啶)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右环(吡啶): 1-6-7-8(N)-9-2
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },        // 2度 C
    { idx: 1, neighbors: [0, 2, 6] },     // 3度 C (shared)
    { idx: 2, neighbors: [1, 3, 9] },    // 3度 N (shared)
    { idx: 3, neighbors: [2, 4] },       // 2度 C
    { idx: 4, neighbors: [3, 5] },        // 2度 C
    { idx: 5, neighbors: [4, 0] },       // 2度 C
    { idx: 6, neighbors: [1, 7] },       // 2度 C
    { idx: 7, neighbors: [6, 8] },       // 2度 C
    { idx: 8, neighbors: [7, 9] },       // 2度 N
    { idx: 9, neighbors: [8, 2] },       // 2度 C
  ],
};

// ------------------------------
// 16. 苯并[c]噻吩 (Benzo[c]thiophene) - 苯环并噻吩
// 原子: 8C + 1S = 9个
// SMILES: c1ccc2c(c1)cs2
// 结构: 苯环(0-5)与噻吩环(3,8,7,6,4)稠合，S在环上
// ------------------------------
const benzoCthiophene: FusedRingFragment = {
  name: '苯并[c]噻吩',
  smilesPattern: 'c1ccc2c(c1)cs2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：苯环（6元环）
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });
    
    // 右环：噻吩（5元环，含S）
    // 共享原子3和4，顺时针: A(3) → C(8) → C(7) → S(6) → B(4)
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    atoms.push({ idx: 6, symbol: 'S', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左环(苯环)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右环(噻吩): 3-8(C)-7(C)-6(S)-4
    { atom1Idx: 3, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 4, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },       // 2度 C
    { idx: 1, neighbors: [0, 2] },       // 2度 C
    { idx: 2, neighbors: [1, 3] },       // 2度 C
    { idx: 3, neighbors: [2, 4, 8] },    // 3度 C (shared, 连噻吩)
    { idx: 4, neighbors: [3, 5, 6] },    // 3度 C (shared, 连噻吩)
    { idx: 5, neighbors: [4, 0] },      // 2度 C
    { idx: 6, neighbors: [4, 7] },      // 2度 S
    { idx: 7, neighbors: [6, 8] },      // 2度 C
    { idx: 8, neighbors: [7, 3] },      // 2度 C
  ],
};

// ------------------------------
// 17. 苯并硒吩 (Benzoselenophene) - 苯环并硒吩
// 原子: 8C + 1Se = 9个
// SMILES: c1ccc2c(c1)[se]cc2
// 结构: 苯环(0-5)与硒吩环(3,8,7,6,4)稠合，Se在环上
// ------------------------------
const benzoselenophene: FusedRingFragment = {
  name: '苯并硒吩',
  smilesPattern: 'c1ccc2c(c1)[se]cc2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左环：苯环（6元环）
    const hexCx = -R * SQRT3 / 2;
    const hexCy = 0;
    const hex = generateHexagon(hexCx, hexCy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(hex[i].x.toFixed(6)), y: parseFloat(hex[i].y.toFixed(6)), z: 0, charge: 0 });
    
    // 右环：硒吩（5元环，含Se）
    // 共享原子3和4，顺时针: A(3) → C(8) → C(7) → Se(6) → B(4)
    const pentVerts = generatePentagonFromSharedEdge(hex[3], hex[4], { x: hexCx, y: hexCy });
    atoms.push({ idx: 6, symbol: 'Se', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左环(苯环)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右环(硒吩): 3-8(C)-7(C)-6(Se)-4
    { atom1Idx: 3, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 4, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },       // 2度 C
    { idx: 1, neighbors: [0, 2] },       // 2度 C
    { idx: 2, neighbors: [1, 3] },       // 2度 C
    { idx: 3, neighbors: [2, 4, 8] },    // 3度 C (shared, 连硒吩)
    { idx: 4, neighbors: [3, 5, 6] },    // 3度 C (shared, 连硒吩)
    { idx: 5, neighbors: [4, 0] },      // 2度 C
    { idx: 6, neighbors: [4, 7] },      // 2度 Se
    { idx: 7, neighbors: [6, 8] },      // 2度 C
    { idx: 8, neighbors: [7, 3] },      // 2度 C
  ],
};

// ------------------------------
// 12. 苊 (Acenaphthylene) - 萘环加五元环，12个C
// 结构: 左苯环 + 右苯环(共享边1-2) + 五元环(共享原子1和2)
// 五元环atoms: 1, 10, 11, 12, 2
// SMILES: c1cc2cccc3c2c(c1)cc3
// ------------------------------
const acenaphthylene: FusedRingFragment = {
  name: '苊',
  smilesPattern: 'c1cc2cccc3c2c(c1)cc3',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左苯环: 中心在 (-R*√3/2, 0)
    const cx1 = -R * SQRT3 / 2;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 右苯环: 中心在 (cx1 + R*√3, 0), shares edge 5-0 (atoms 1,2 in naphthalene numbering)
    const cx2 = cx1 + R * SQRT3;
    const right = generateHexagon(cx2, cy, R);
    // 右苯环的顶点: right[0]=atom1, right[1]=atom6, right[2]=atom2, right[3]=atom7, right[4]=atom8, right[5]=atom9
    // 非共享: right[1], right[3], right[4], right[5] → atoms 6, 7, 8, 9
    for (let i = 1; i <= 4; i++) {
      const idx = 5 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 五元环: 共享原子1(right[0])和2(right[2])
    // 五元环atoms: 1, 10, 11, 12, 2 → indices: 1, 10, 11, 12, 2
    // 使用五边形生成函数
    const pentVerts = generatePentagonFromSharedEdge(right[0], right[2], { x: cx2, y: cy });
    // pentVerts = [五元环顶点1的邻居(=right[5]), 五元环中间顶点, 五元环顶点2的邻居(=right[1])]
    // 五元环顺序: right[0] → pentVerts[0] → pentVerts[1] → pentVerts[2] → right[2]
    // atom1 = right[0] (共享), atom2 = right[2] (共享), atom10 = pentVerts[0], atom11 = pentVerts[1], atom12 = pentVerts[2]
    atoms.push({ idx: 10, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 11, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 12, symbol: 'C', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左苯环 (atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环 (atoms 1,6,7,8,9,2)
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    // 五元环 (atoms 1,10,11,12,2)
    { atom1Idx: 1, atom2Idx: 10, order: 1 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 2, order: 1 },
  ],
  topology: [
    // 左苯环
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6, 10] },
    { idx: 2, neighbors: [1, 3, 9, 12] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    // 右苯环
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
    // 五元环
    { idx: 10, neighbors: [1, 11] },
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 2] },
  ],
};

// ------------------------------
// 13. 苊烯 (Acenaphthene) - 与苊结构相同，12个C
// SMILES: c1cc2cccc3c2c(c1)cc3
// ------------------------------
const acenaphthene: FusedRingFragment = {
  name: '苊烯',
  smilesPattern: 'c1cc2cccc3c2c(c1)cc3',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 与苊相同的结构
    const cx1 = -R * SQRT3 / 2;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const cx2 = cx1 + R * SQRT3;
    const right = generateHexagon(cx2, cy, R);
    for (let i = 1; i <= 4; i++) {
      const idx = 5 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const pentVerts = generatePentagonFromSharedEdge(right[0], right[2], { x: cx2, y: cy });
    atoms.push({ idx: 10, symbol: 'C', isAromatic: true, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 11, symbol: 'C', isAromatic: true, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 12, symbol: 'C', isAromatic: true, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左苯环
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    // 五元环
    { atom1Idx: 1, atom2Idx: 10, order: 1 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 2, order: 1 },
  ],
  topology: [
    // 左苯环
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6, 10] },
    { idx: 2, neighbors: [1, 3, 9, 12] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    // 右苯环
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
    // 五元环
    { idx: 10, neighbors: [1, 11] },
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 2] },
  ],
};

// ------------------------------
// 14. 三亚苯 (Triphenylene) - 中心苯环+3个外围苯环，18个C
// D3h对称，十字形排列
// 
// generateHexagon(cx, cy, R) 顶点排列（逆时针从顶部开始）:
//   顶点0: (cx, cy+R)      - 正上方 (90°)
//   顶点1: (cx+R*SQRT3/2, cy+R/2)  - 30°  
//   顶点2: (cx+R*SQRT3/2, cy-R/2)  - 330°
//   顶点3: (cx, cy-R)      - 正下方 (270°)
//   顶点4: (cx-R*SQRT3/2, cy-R/2)  - 210°
//   顶点5: (cx-R*SQRT3/2, cy+R/2)  - 150°
//
// 结构:
//   中心环(0-5)在原点
//   外围环1(右侧): 共享边5-0, 中心在(R*SQRT3, 0), 添加 vertices 1,2,4,5
//   外围环2(左下): 共享边3-4, 中心在(-R*SQRT3/2, -R*1.5), 添加 vertices 1,2,4,5
//   外围环3(左上): 共享边1-2, 中心在(-R*SQRT3/2, R*1.5), 添加 vertices 1,2,4,5
//
// 原子分配:
//   中心环: 0,1,2,3,4,5 (6个) 
//   外围环1(右侧): 添加 6,7,8,9 (4个) - ring1[1],ring1[2],ring1[4],ring1[5]
//   外围环2(左下): 添加 10,11,12,13 (4个) - ring2[1],ring2[2],ring2[4],ring2[5]
//   外围环3(左上): 添加 14,15,16,17 (4个) - ring3[1],ring3[2],ring3[4],ring3[5]
//
// SMILES: c1ccc2c(c1)c3ccccc3c4ccccc24
// ------------------------------
const triphenylene: FusedRingFragment = {
  name: '三亚苯',
  smilesPattern: 'c1ccc2c(c1)c3ccccc3c4ccccc24',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    
    // 中心苯环: 中心在 (0, 0)
    // 顶点: 0=(0,R), 1=(R*SQRT3/2, R/2), 2=(R*SQRT3/2, -R/2)
    //       3=(0,-R), 4=(-R*SQRT3/2, -R/2), 5=(-R*SQRT3/2, R/2)
    const center = generateHexagon(0, 0, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(center[i].x.toFixed(6)), y: parseFloat(center[i].y.toFixed(6)), z: 0, charge: 0 });
    }

    // 外围环1 (右侧): 中心在 (R*SQRT3, 0)
    // 根据几何计算，ring1[5]与center[0], ring1[0]与center[5]共享
    // ring1添加的顶点: 1,2,4,5 (不是0,3因为它们是共享顶点)
    const ring1Cx = R * SQRT3;
    const ring1Cy = 0;
    const ring1 = generateHexagon(ring1Cx, ring1Cy, R);
    // ring1[1]=(1.5*R*SQRT3, R/2), ring1[2]=(1.5*R*SQRT3, -R/2)
    // ring1[4]=(R*SQRT3/2, -R/2), ring1[5]=(R*SQRT3/2, R/2)
    const ring1AddVerts = [1, 2, 4, 5];
    for (let i = 0; i < ring1AddVerts.length; i++) {
      const vIdx = ring1AddVerts[i];
      const idx = 6 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring1[vIdx].x.toFixed(6)), y: parseFloat(ring1[vIdx].y.toFixed(6)), z: 0, charge: 0 });
    }

    // 外围环2 (左下): 中心在 (-R*SQRT3/2, -R*1.5)
    // ring2[5]与center[3], ring2[0]与center[4]共享
    // ring2添加的顶点: 1,2,4,5
    const ring2Cx = -R * SQRT3 / 2;
    const ring2Cy = -R * 1.5;
    const ring2 = generateHexagon(ring2Cx, ring2Cy, R);
    const ring2AddVerts = [1, 2, 4, 5];
    for (let i = 0; i < ring2AddVerts.length; i++) {
      const vIdx = ring2AddVerts[i];
      const idx = 10 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring2[vIdx].x.toFixed(6)), y: parseFloat(ring2[vIdx].y.toFixed(6)), z: 0, charge: 0 });
    }

    // 外围环3 (左上): 中心在 (-R*SQRT3/2, R*1.5)
    // ring3[5]与center[1], ring3[0]与center[2]共享
    // ring3添加的顶点: 1,2,4,5
    const ring3Cx = -R * SQRT3 / 2;
    const ring3Cy = R * 1.5;
    const ring3 = generateHexagon(ring3Cx, ring3Cy, R);
    const ring3AddVerts = [1, 2, 4, 5];
    for (let i = 0; i < ring3AddVerts.length; i++) {
      const vIdx = ring3AddVerts[i];
      const idx = 14 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring3[vIdx].x.toFixed(6)), y: parseFloat(ring3[vIdx].y.toFixed(6)), z: 0, charge: 0 });
    }

    return atoms;
  })(),
  bonds: [
    // 中心苯环 (atoms 0-5): 完整的六边形
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 外围环1 (右侧): 1-6-7-8-9-2 形成闭环，共享边1-2
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    // 外围环2 (左下): 3-10-11-12-13-4 形成闭环，共享边3-4
    { atom1Idx: 3, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 4, order: 1.5 },
    // 外围环3 (左上): 5-14-15-16-17-0 形成闭环，共享边5-0
    { atom1Idx: 5, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 15, order: 1.5 },
    { atom1Idx: 15, atom2Idx: 16, order: 1.5 },
    { atom1Idx: 16, atom2Idx: 17, order: 1.5 },
    { atom1Idx: 17, atom2Idx: 0, order: 1.5 },
  ],
  topology: [
    // 中心环 (0-5): 每个顶点连接中心环的两个邻居和可能的外围环
    { idx: 0, neighbors: [5, 1, 17] },   // 连接center[5], center[1], ring3[0]
    { idx: 1, neighbors: [0, 2, 6] },     // 连接center[0], center[2], ring1[5]
    { idx: 2, neighbors: [1, 3, 9] },     // 连接center[1], center[3], ring1[0]
    { idx: 3, neighbors: [2, 4, 10] },    // 连接center[2], center[4], ring2[5]
    { idx: 4, neighbors: [3, 5, 13] },    // 连接center[3], center[5], ring2[0]
    { idx: 5, neighbors: [4, 0, 14] },    // 连接center[4], center[0], ring3[5]
    // 外围环1 (右侧, atoms 6-9): 顶点1,6,7,8,9,2 (ring1[5]=center[1], ring1[0]=center[2])
    { idx: 6, neighbors: [1, 7] },        // ring1[1]
    { idx: 7, neighbors: [6, 8] },       // ring1[2]
    { idx: 8, neighbors: [7, 9] },       // ring1[4]
    { idx: 9, neighbors: [8, 2] },        // ring1[5] = center[1]
    // 外围环2 (左下, atoms 10-13): 顶点3,10,11,12,13,4 (ring2[5]=center[3], ring2[0]=center[4])
    { idx: 10, neighbors: [3, 11] },      // ring2[1]
    { idx: 11, neighbors: [10, 12] },    // ring2[2]
    { idx: 12, neighbors: [11, 13] },    // ring2[4]
    { idx: 13, neighbors: [12, 4] },     // ring2[5] = center[3]
    // 外围环3 (左上, atoms 14-17): 顶点5,14,15,16,17,0 (ring3[5]=center[5], ring3[0]=center[0])
    { idx: 14, neighbors: [5, 15] },     // ring3[1]
    { idx: 15, neighbors: [14, 16] },    // ring3[2]
    { idx: 16, neighbors: [15, 17] },    // ring3[4]
    { idx: 17, neighbors: [16, 0] },     // ring3[5] = center[5]
  ],
};

// ------------------------------
// 15. 䓛 (Chrysene) - 4个苯环角状稠合，18个C
// SMILES: c1ccc2c(c1)ccc3c2ccc4ccccc34
// 结构: 4个苯环角状排列成"Z"形
//       环1(左下) + 环2(右下) [共享边1-2] + 环3(右上) [共享边3-4] + 环4(顶部) [共享边3-4]
// 正确的几何:
//   - 环1中心: (-R*SQRT3/2, 0)
//   - 环2中心: (R*SQRT3/2, 0)  - 与环1共享边1-2(右侧面)
//   - 环3中心: (R*SQRT3, R*1.5) - 与环2共享边3-4(右侧面)
//   - 环4中心: (R*SQRT3, R*1.5+R*SQRT3) - 与环3共享边3-4(右侧面)
// ------------------------------
const chrysene: FusedRingFragment = {
  name: '䓛',
  smilesPattern: 'c1ccc2c(c1)ccc3c2ccc4ccccc34',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 环1 (左下): 中心在 (-R*SQRT3/2, 0), vertices 0-5
    const cx1 = -R * SQRT3 / 2;
    const cy1 = 0;
    const ring1 = generateHexagon(cx1, cy1, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring1[i].x.toFixed(6)), y: parseFloat(ring1[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 环2 (右下): 中心在 (R*SQRT3/2, 0), 共享边1-2与环1
    // 环1的边1-2是右侧面，顶点1(右上)和2(右下)
    // 环2的边5-4是左侧面，需要与环1的边1-2重合
    // 所以环2的顶点4 = 环1的顶点1, 环2的顶点5 = 环1的顶点2
    // 环2中心 = 环1中心 + (R*SQRT3, 0) = (R*SQRT3/2, 0)
    const cx2 = R * SQRT3 / 2;
    const cy2 = 0;
    const ring2 = generateHexagon(cx2, cy2, R);
    // ring2的顶点4(vertex4)和5(vertex5)是共享原子(对应ring1的vertex1和vertex2)
    // 新增顶点: vertex0, vertex1, vertex2, vertex3 → atoms 6,7,8,9
    for (let i = 0; i < 4; i++) {
      const idx = 6 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring2[i].x.toFixed(6)), y: parseFloat(ring2[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 环3 (右上): 中心在 (R*SQRT3, R*1.5), 共享边3-4与环2
    // 环2的边3-4是右侧面(vertex3和vertex4)
    // 环3的边5-4是左侧面(vertex5和vertex4)
    // 环3的顶点4 = 环2的顶点3, 环3的顶点5 = 环2的顶点4
    // 环3中心 = 环2中心 + (R*SQRT3/2, R*1.5)
    const cx3 = R * SQRT3;
    const cy3 = R * 1.5;
    const ring3 = generateHexagon(cx3, cy3, R);
    // ring3的顶点4和5是共享原子(对应ring2的vertex3和vertex4)
    // 新增顶点: vertex0, vertex1, vertex2, vertex3 → atoms 10,11,12,13
    for (let i = 0; i < 4; i++) {
      const idx = 10 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring3[i].x.toFixed(6)), y: parseFloat(ring3[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 环4 (顶部): 中心在 (R*SQRT3, R*1.5+R*SQRT3), 共享边3-4与环3
    // 环3的边3-4是右侧面(vertex3和vertex4)
    // 环4的边5-4是左侧面(vertex5和vertex4)
    // 环4的顶点4 = 环3的顶点3, 环4的顶点5 = 环3的顶点4
    const cx4 = R * SQRT3;
    const cy4 = R * 1.5 + R * SQRT3;
    const ring4 = generateHexagon(cx4, cy4, R);
    // ring4的顶点4和5是共享原子(对应ring3的vertex3和vertex4)
    // 新增顶点: vertex0, vertex1, vertex2, vertex3 → atoms 14,15,16,17
    for (let i = 0; i < 4; i++) {
      const idx = 14 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(ring4[i].x.toFixed(6)), y: parseFloat(ring4[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    // 环1 (左下, atoms 0,1,2,3,4,5): 完整六边形
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 稠合边 环1-环2: 环1.vertex1-2 与 环2.vertex4-5
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 }, // 共享边，重复表示两端原子相连
    // 环2 (右下, atoms 1,2,6,7,8,9): 顶点1-2是共享原子, 顶点4-5是共享原子
    // 环2的边: 1-6, 6-7, 7-8, 8-9, 9-2, 2-1
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    // 稠合边 环2-环3: 环2.vertex3-4 与 环3.vertex4-5
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 }, // 共享边，环2的vertex3-4是atoms 8-9
    // 环3 (右上, atoms 8,9,10,11,12,13): 顶点4-5是共享原子
    // 环3的边: 8-10, 10-11, 11-12, 12-13, 13-9, 9-8
    { atom1Idx: 8, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 9, order: 1.5 },
    // 稠合边 环3-环4: 环3.vertex3-4 与 环4.vertex4-5
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 }, // 共享边，环3的vertex3-4是atoms 12-13
    // 环4 (顶部, atoms 12,13,14,15,16,17): 顶点4-5是共享原子
    // 环4的边: 12-14, 14-15, 15-16, 16-17, 17-13, 13-12
    { atom1Idx: 12, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 15, order: 1.5 },
    { atom1Idx: 15, atom2Idx: 16, order: 1.5 },
    { atom1Idx: 16, atom2Idx: 17, order: 1.5 },
    { atom1Idx: 17, atom2Idx: 13, order: 1.5 },
  ],
  topology: [
    // 环1 (atoms 0-5)
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },    // 与环1、环2相连
    { idx: 2, neighbors: [1, 3, 9] },    // 与环1、环2相连
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    // 环2 (atoms 6,7,8,9): 新增4个原子，共享顶点4,5
    // ring2.vertex0=6, vertex1=7, vertex2=8, vertex3=9, vertex4=2, vertex5=1
    // 环2: 1-6-7-8-9-2-1
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },       // 环2: 8连接7和9
    { idx: 9, neighbors: [8, 2, 10] },   // 环2: 9连接8和2; 环3: 9连接10
    // 环3 (atoms 10,11,12,13): 新增4个原子，共享顶点4,5
    // ring3.vertex0=10, vertex1=11, vertex2=12, vertex3=13, vertex4=9, vertex5=8
    // 环3: 8-9-10-11-12-13-8
    { idx: 10, neighbors: [9, 11, 14] }, // 环3: 10连接9和11; 环4: 10连接14
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 13, 14] }, // 环3: 12连接11和13; 环4: 12连接14
    { idx: 13, neighbors: [12, 8, 17] }, // 环3: 13连接12和8; 环4: 13连接17
    // 环4 (atoms 14,15,16,17): 新增4个原子，共享顶点4,5
    // ring4.vertex0=14, vertex1=15, vertex2=16, vertex3=17, vertex4=13, vertex5=12
    // 环4: 12-14-15-16-17-13-12
    { idx: 14, neighbors: [12, 15] },
    { idx: 15, neighbors: [14, 16] },
    { idx: 16, neighbors: [15, 17] },
    { idx: 17, neighbors: [16, 13] },
  ],
};

// ------------------------------
// 16. 苯并[a]蒽 (Benz[a]anthracene) - 4个苯环，18个C
// SMILES: c1ccc2c(c1)ccc3cc4ccccc4ccc23
// 结构: 角状排列 - 左上环 + 左下环(共享边3-4) + 右下环(共享边3-4) + 右环(共享边1-2)
//       环1(左上) → 环2(左下) [共享边3-4] → 环3(右下) [共享边3-4] → 环4(右) [共享边1-2]
// ------------------------------
const benz_a_anthracene: FusedRingFragment = {
  name: '苯并[a]蒽',
  smilesPattern: 'c1ccc2c(c1)ccc3cc4ccccc4ccc23',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 环1 (左上): 中心在 (-R*SQRT3/2, R*1.5), vertices 0-5
    const cx1 = -R * SQRT3 / 2;
    const cy1 = R * 1.5;
    const ring1 = generateHexagon(cx1, cy1, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring1[i].x.toFixed(6)), y: parseFloat(ring1[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 环2 (左下): 与环1共享边3-4 (即边4-3)
    // 环1的边3-4是左侧面(顶点3和4)
    // 环2的边4-3是右侧面(顶点4和3)，与环1的边3-4重合
    // 环2中心 = 环1中心 + (0, -R*SQRT3)
    const cx2 = cx1;
    const cy2 = cy1 - R * SQRT3;
    const ring2 = generateHexagon(cx2, cy2, R);
    // ring2的顶点4(vertex4)和3(vertex3)是共享原子(对应ring1的vertex3和vertex4)
    // 新增顶点: vertex0, vertex1, vertex2, vertex5 → atoms 6,7,8,9
    atoms.push({ idx: 6, symbol: 'C', isAromatic: true, x: parseFloat(ring2[0].x.toFixed(6)), y: parseFloat(ring2[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: parseFloat(ring2[1].x.toFixed(6)), y: parseFloat(ring2[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: parseFloat(ring2[2].x.toFixed(6)), y: parseFloat(ring2[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 9, symbol: 'C', isAromatic: true, x: parseFloat(ring2[5].x.toFixed(6)), y: parseFloat(ring2[5].y.toFixed(6)), z: 0, charge: 0 });
    // 环3 (右下): 与环2共享边3-4
    // 环2的边3-4是左侧面(顶点3和4)
    // 环3的边4-3是右侧面(顶点4和3)，与环2的边3-4重合
    // 环3中心 = 环2中心 + (0, -R*SQRT3)
    const cx3 = cx2;
    const cy3 = cy2 - R * SQRT3;
    const ring3 = generateHexagon(cx3, cy3, R);
    // ring3的顶点4(vertex4)和3(vertex3)是共享原子(对应ring2的vertex3和vertex4)
    // 新增顶点: vertex0, vertex1, vertex2, vertex5 → atoms 10,11,12,13
    atoms.push({ idx: 10, symbol: 'C', isAromatic: true, x: parseFloat(ring3[0].x.toFixed(6)), y: parseFloat(ring3[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 11, symbol: 'C', isAromatic: true, x: parseFloat(ring3[1].x.toFixed(6)), y: parseFloat(ring3[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 12, symbol: 'C', isAromatic: true, x: parseFloat(ring3[2].x.toFixed(6)), y: parseFloat(ring3[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 13, symbol: 'C', isAromatic: true, x: parseFloat(ring3[5].x.toFixed(6)), y: parseFloat(ring3[5].y.toFixed(6)), z: 0, charge: 0 });
    // 环4 (右): 与环3共享边1-2
    // 环3的边1-2是右侧面(顶点1和2)
    // 环4的边5-4是左侧面(顶点5和4)，与环3的边1-2重合
    // 环4中心 = 环3中心 + (R*SQRT3, 0)
    const cx4 = cx3 + R * SQRT3;
    const cy4 = cy3;
    const ring4 = generateHexagon(cx4, cy4, R);
    // ring4的顶点5(vertex5)和4(vertex4)是共享原子(对应ring3的vertex1和vertex2)
    // 新增顶点: vertex0, vertex1, vertex2, vertex3 → atoms 14,15,16,17
    atoms.push({ idx: 14, symbol: 'C', isAromatic: true, x: parseFloat(ring4[0].x.toFixed(6)), y: parseFloat(ring4[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 15, symbol: 'C', isAromatic: true, x: parseFloat(ring4[1].x.toFixed(6)), y: parseFloat(ring4[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 16, symbol: 'C', isAromatic: true, x: parseFloat(ring4[2].x.toFixed(6)), y: parseFloat(ring4[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 17, symbol: 'C', isAromatic: true, x: parseFloat(ring4[3].x.toFixed(6)), y: parseFloat(ring4[3].y.toFixed(6)), z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 环1 (左上, atoms 0,1,2,3,4,5): 完整六边形
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 稠合边 环1-环2: 环1的边3-4 与 环2的边4-3
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 }, // 共享边，重复表示两端原子相连
    // 环2 (左下, atoms 3,4,6,7,8,9): 顶点4-3是共享原子
    // 环2的边: 3-6, 6-7, 7-8, 8-9, 9-4, 4-3
    { atom1Idx: 3, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 4, order: 1.5 },
    // 稠合边 环2-环3: 环2的边3-4 与 环3的边4-3
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 }, // 共享边，环2的顶点8-9对应环3的顶点4-3
    // 环3 (右下, atoms 8,9,10,11,12,13): 顶点4-3是共享原子
    // 环3的边: 8-10, 10-11, 11-12, 12-13, 13-9, 9-8
    { atom1Idx: 8, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 9, order: 1.5 },
    // 稠合边 环3-环4: 环3的边1-2 与 环4的边5-4
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 }, // 共享边，环3的顶点10-11对应环4的顶点5-4
    // 环4 (右, atoms 10,11,14,15,16,17): 顶点5-4是共享原子
    // 环4的边: 10-14, 14-15, 15-16, 16-17, 17-11, 11-10
    { atom1Idx: 10, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 15, order: 1.5 },
    { atom1Idx: 15, atom2Idx: 16, order: 1.5 },
    { atom1Idx: 16, atom2Idx: 17, order: 1.5 },
    { atom1Idx: 17, atom2Idx: 11, order: 1.5 },
  ],
  topology: [
    // 环1 (atoms 0-5)
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4, 6] },    // 与环1、环2相连
    { idx: 4, neighbors: [3, 5, 9] },    // 与环1、环2相连
    { idx: 5, neighbors: [4, 0] },
    // 环2 (atoms 6,7,8,9): 新增4个原子，共享顶点4,3
    // ring2.vertex0=6, vertex1=7, vertex2=8, vertex3=9, vertex4=4, vertex5=3
    // 环2: 3-6-7-8-9-4-3
    { idx: 6, neighbors: [3, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9, 13] },   // 环2: 8连接7和9; 环3: 8连接13
    { idx: 9, neighbors: [8, 4, 10] },   // 环2: 9连接8和4; 环3: 9连接10
    // 环3 (atoms 10,11,12,13): 新增4个原子，共享顶点4,3
    // ring3.vertex0=10, vertex1=11, vertex2=12, vertex3=13, vertex4=9, vertex5=8
    // 环3: 8-9-10-11-12-13-8
    { idx: 10, neighbors: [9, 11, 14] },  // 环3: 10连接9和11; 环4: 10连接14
    { idx: 11, neighbors: [10, 12, 17] }, // 环3: 11连接10和12; 环4: 11连接17
    { idx: 12, neighbors: [11, 13] },      // 环3: 12连接11和13
    { idx: 13, neighbors: [12, 8, 17] },  // 环3: 13连接12和8; 环4: 13连接17
    // 环4 (atoms 14,15,16,17): 新增4个原子，共享顶点5,4
    // ring4.vertex0=14, vertex1=15, vertex2=16, vertex3=17, vertex4=11, vertex5=10
    // 环4: 10-14-15-16-17-11-10
    { idx: 14, neighbors: [10, 15] },
    { idx: 15, neighbors: [14, 16] },
    { idx: 16, neighbors: [15, 17] },
    { idx: 17, neighbors: [16, 11] },
  ],
};

// ------------------------------
// 17. 苝 (Perylene) - 5个苯环弯曲排列，20个C
// 结构: 两个萘-like结构弯曲融合
// SMILES: c1cc2cccc3c4c(c5ccccc15)c2c3cc4
// ------------------------------
const perylene: FusedRingFragment = {
  name: '苝',
  smilesPattern: 'c1cc2cccc3c4c(c5ccccc15)c2c3cc4',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左侧萘结构: 两个苯环稠合
    const cx1 = -R * SQRT3 / 2;
    const cy1 = 0;
    const left1 = generateHexagon(cx1, cy1, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left1[i].x.toFixed(6)), y: parseFloat(left1[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const cx2 = cx1 + R * SQRT3;
    const cy2 = 0;
    const left2 = generateHexagon(cx2, cy2, R);
    // left2 shares vertices 5,0 with left1 → atoms 1,2
    // 添加left2的新顶点: 1,2,3,4 → atoms 6,7,8,9
    for (let i = 1; i <= 4; i++) {
      const idx = 5 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(left2[i].x.toFixed(6)), y: parseFloat(left2[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 右侧萘结构: 向上偏移
    const cx3 = cx2;
    const cy3 = R * SQRT3;
    const right1 = generateHexagon(cx3, cy3, R);
    // right1 shares vertices 5,0 with left2 → atoms 9,6
    // 添加right1的新顶点: 1,2,3,4 → atoms 10,11,12,13
    for (let i = 1; i <= 4; i++) {
      const idx = 9 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right1[i].x.toFixed(6)), y: parseFloat(right1[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const cx4 = cx3 + R * SQRT3;
    const cy4 = cy3;
    const right2 = generateHexagon(cx4, cy4, R);
    // right2 shares vertices 5,0 with right1 → atoms 13,10
    // 添加right2的新顶点: 1,2,3,4 → atoms 14,15,16,17
    for (let i = 1; i <= 4; i++) {
      const idx = 13 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right2[i].x.toFixed(6)), y: parseFloat(right2[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 中间桥连环: 两个萘结构之间的五元/六元混合环
    // 实际上苝是直线型弯曲结构，中间没有额外环
    // 额外添加的4个原子是右侧第二个苯环
    return atoms;
  })(),
  bonds: [
    // 左萘 (atoms 0-5, 1,6,7,8,9,2)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    // 右萘 (atoms 6,10,11,12,13,9)
    { atom1Idx: 6, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 9, order: 1.5 },
    // 右萘2 (atoms 10,14,15,16,17,13)
    { atom1Idx: 10, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 15, order: 1.5 },
    { atom1Idx: 15, atom2Idx: 16, order: 1.5 },
    { atom1Idx: 16, atom2Idx: 17, order: 1.5 },
    { atom1Idx: 17, atom2Idx: 13, order: 1.5 },
  ],
  topology: [
    // 左萘
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [1, 7, 10] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2, 13] },
    // 右萘
    { idx: 10, neighbors: [6, 11, 14] },
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 13] },
    { idx: 13, neighbors: [12, 9, 17] },
    // 右萘2
    { idx: 14, neighbors: [10, 15] },
    { idx: 15, neighbors: [14, 16] },
    { idx: 16, neighbors: [15, 17] },
    { idx: 17, neighbors: [16, 13] },
  ],
};

// ------------------------------
// 18. 并四苯 (Tetracene) - 4个苯环线性稠合
// 18个C原子: ring0=0-5, ring1=1,6,7,8,9,2, ring2=6,10,11,12,13,7, ring3=10,14,15,16,17,11
// ring0和ring1共享边1-2 (ring0的vertex1-2 ↔ ring1的vertex5-0)
// ring1和ring2共享边1-2 (ring1的vertex1-2 ↔ ring2的vertex5-0)
// ring2和ring3共享边1-2 (ring2的vertex1-2 ↔ ring3的vertex5-0)
// 环中心位置: ring0=-3*R, ring1=-R, ring2=R, ring3=3*R
// SMILES: c1ccc2cc3cc4ccccc4cc3cc2c1
// ------------------------------
const tetracene: FusedRingFragment = {
  name: '并四苯',
  smilesPattern: 'c1ccc2cc3cc4ccccc4cc3cc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2 * 3;
    const cx2 = cx1 + R * SQRT3;
    const cx3 = cx2 + R * SQRT3;
    const cx4 = cx3 + R * SQRT3;
    const cy = 0;
    const ring0 = generateHexagon(cx1, cy, R);
    const ring1 = generateHexagon(cx2, cy, R);
    const ring2 = generateHexagon(cx3, cy, R);
    const ring3 = generateHexagon(cx4, cy, R);
    
    // ring0: 6个原子 (0-5)
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring0[i].x.toFixed(6)), y: parseFloat(ring0[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // ring1: 4个新原子 (6-9)
    // ring0的vertex1(右上)=ring1的vertex5(左上), ring0的vertex2(右下)=ring1的vertex4(左下)
    // ring1添加非共享顶点: 0(上),1(右上),2(右下),3(下) -> atoms 6,7,8,9
    for (const i of [0, 1, 2, 3]) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(ring1[i].x.toFixed(6)), y: parseFloat(ring1[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // ring2: 4个新原子 (10-13)
    // ring1的vertex1(右上)=ring2的vertex5(左上), ring1的vertex2(右下)=ring2的vertex4(左下)
    // ring2添加非共享顶点: 0(上),1(右上),2(右下),3(下) -> atoms 10,11,12,13
    for (const i of [0, 1, 2, 3]) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(ring2[i].x.toFixed(6)), y: parseFloat(ring2[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // ring3: 4个新原子 (14-17)
    // ring2的vertex1(右上)=ring3的vertex5(左上), ring2的vertex2(右下)=ring3的vertex4(左下)
    // ring3添加非共享顶点: 0(上),1(右上),2(右下),3(下) -> atoms 14,15,16,17
    for (const i of [0, 1, 2, 3]) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(ring3[i].x.toFixed(6)), y: parseFloat(ring3[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    return atoms;
  })(),
  bonds: [
    // ring0 (0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    
    // ring1: 共享原子1,2 + 新原子6,7,8,9
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    
    // ring2: 共享原子7,8 + 新原子10,11,12,13
    { atom1Idx: 7, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 8, order: 1.5 },
    
    // ring3: 共享原子11,12 + 新原子14,15,16,17
    { atom1Idx: 11, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 15, order: 1.5 },
    { atom1Idx: 15, atom2Idx: 16, order: 1.5 },
    { atom1Idx: 16, atom2Idx: 17, order: 1.5 },
    { atom1Idx: 17, atom2Idx: 12, order: 1.5 },
  ],
  topology: [
    // ring0
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    
    // ring1
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8, 10] },
    { idx: 8, neighbors: [7, 9, 13] },
    { idx: 9, neighbors: [8, 2] },
    
    // ring2
    { idx: 10, neighbors: [7, 11] },
    { idx: 11, neighbors: [10, 12, 14] },
    { idx: 12, neighbors: [11, 13, 17] },
    { idx: 13, neighbors: [12, 8] },
    
    // ring3
    { idx: 14, neighbors: [11, 15] },
    { idx: 15, neighbors: [14, 16] },
    { idx: 16, neighbors: [15, 17] },
    { idx: 17, neighbors: [16, 12] },
  ],
};

// ------------------------------
// 19. 喹喔啉 (Quinoxaline) - 苯并吡嗪
// 原子: 8C + 2N = 10个
// 结构: 苯环并吡嗪(六元杂环，2个N)
// SMILES: c1ccc2nccnc2c1
// ------------------------------
const quinoxaline: FusedRingFragment = {
  name: '喹喔啉',
  smilesPattern: 'c1ccc2nccnc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const right = generateHexagon(cx2, cy, R);
    // 右六边形中：right[5]=frag1(共享), right[4]=frag2(共享)
    // 非共享原子：right[0], right[1], right[2], right[3] → frag 6, 7, 8, 9
    // 吡嗪环中right[1]和right[2]是N原子
    for (let i = 0; i < 4; i++) {
      const idx = 6 + i;
      const symbol = (i === 1 || i === 2) ? 'N' : 'C';
      atoms.push({ idx, symbol, isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    // 左苯环(0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右吡嗪环(1,6,7,8,9,2)
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
  ],
};

// ------------------------------
// 20. 喹唑啉 (Quinazoline) - 苯并嘧啶
// 原子: 8C + 2N = 10个
// 结构: 苯环并嘧啶(六元杂环，2个N)
// SMILES: c1ccc2ncncc2c1
// ------------------------------
const quinazoline: FusedRingFragment = {
  name: '喹唑啉',
  smilesPattern: 'c1ccc2ncncc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const right = generateHexagon(cx2, cy, R);
    // 右六边形中：right[5]=frag1(共享), right[4]=frag2(共享)
    // 非共享原子：right[0], right[1], right[2], right[3] → frag 6, 7, 8, 9
    // 嘧啶环中right[1]是N, right[2]是C
    for (let i = 0; i < 4; i++) {
      const idx = 6 + i;
      const symbol = i === 1 ? 'N' : 'C';
      atoms.push({ idx, symbol, isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    // 左苯环(0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右嘧啶环(1,6,7,8,9,2)
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
  ],
};

// ------------------------------
// 21. 噌啉 (Cinnoline) - 苯并哒嗪
// 原子: 8C + 2N = 10个
// 结构: 苯环并哒嗪(六元杂环，2个N相邻)
// SMILES: c1ccc2nnccc2c1
// ------------------------------
const cinnoline: FusedRingFragment = {
  name: '噌啉',
  smilesPattern: 'c1ccc2nnccc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    const right = generateHexagon(cx2, cy, R);
    // 右六边形中：right[5]=frag1(共享), right[4]=frag2(共享)
    // 非共享原子：right[0], right[1], right[2], right[3] → frag 6, 7, 8, 9
    // 哒嗪环中right[1]和right[2]都是N原子(相邻)
    for (let i = 0; i < 4; i++) {
      const idx = 6 + i;
      const symbol = (i === 1 || i === 2) ? 'N' : 'C';
      atoms.push({ idx, symbol, isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    return atoms;
  })(),
  bonds: [
    // 左苯环(0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右哒嗪环(1,6,7,8,9,2)
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
  ],
  topology: [
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 2] },
  ],
};

// ------------------------------
// 22. 吩嗪 (Phenazine) - 两个苯环并吡嗪
// 原子: 12C + 2N = 14个
// 结构: 萘骨架，中央环为吡嗪(N在对位)
// SMILES: c1ccc2c(c1)nc3ccccc3n2
// ------------------------------
const phenazine: FusedRingFragment = {
  name: '吩嗪',
  smilesPattern: 'c1ccc2nc3ccccc3nc2c1',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    const cx1 = -R * SQRT3 / 2;
    const cx2 = cx1 + R * SQRT3;
    const cx3 = cx2 + R * SQRT3;
    const cy = 0;
    const ring0 = generateHexagon(cx1, cy, R);
    const ring1 = generateHexagon(cx2, cy, R);
    const ring2 = generateHexagon(cx3, cy, R);
    
    // ring0(左苯环): 6个C原子 (0-5)
    for (let i = 0; i < 6; i++) {
      atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(ring0[i].x.toFixed(6)), y: parseFloat(ring0[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    // ring1(中哒嗪环): 4个新原子 (6-9), 共享 ring0的顶点1和2
    // ring1的非共享顶点: 0(上)=N,1(右上)=C,2(右下)=C,3(下)=N (对位)
    atoms.push({ idx: 6, symbol: 'N', isAromatic: true, x: parseFloat(ring1[0].x.toFixed(6)), y: parseFloat(ring1[0].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 7, symbol: 'C', isAromatic: true, x: parseFloat(ring1[1].x.toFixed(6)), y: parseFloat(ring1[1].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 8, symbol: 'C', isAromatic: true, x: parseFloat(ring1[2].x.toFixed(6)), y: parseFloat(ring1[2].y.toFixed(6)), z: 0, charge: 0 });
    atoms.push({ idx: 9, symbol: 'N', isAromatic: true, x: parseFloat(ring1[3].x.toFixed(6)), y: parseFloat(ring1[3].y.toFixed(6)), z: 0, charge: 0 });
    
    // ring2(右苯环): 4个新原子 (10-13), 共享 ring1的顶点7和8
    // ring2的非共享顶点: 0(上),1(右上),2(右下),3(下)
    for (const i of [0, 1, 2, 3]) {
      atoms.push({ idx: atoms.length, symbol: 'C', isAromatic: true, x: parseFloat(ring2[i].x.toFixed(6)), y: parseFloat(ring2[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    
    return atoms;
  })(),
  bonds: [
    // ring0 (左苯环 atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    
    // ring1 (中哒嗪环): 共享原子1,2 + 新原子6(N),7,8,9(N)
    // ring1: 1-6-7-8-9-2-1
    { atom1Idx: 1, atom2Idx: 6, order: 1.5 },
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 2, order: 1.5 },
    
    // ring2 (右苯环): 共享原子7,8 + 新原子10,11,12,13
    // ring2: 7-10-11-12-13-8-7
    { atom1Idx: 7, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 8, order: 1.5 },
  ],
  topology: [
    // ring0 (左苯环 0-5)
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2, 6] },
    { idx: 2, neighbors: [1, 3, 9] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0] },
    
    // ring1 (中哒嗪环 6,7,8,9)
    { idx: 6, neighbors: [1, 7] },
    { idx: 7, neighbors: [6, 8, 10] },
    { idx: 8, neighbors: [7, 9, 13] },
    { idx: 9, neighbors: [8, 2] },
    
    // ring2 (右苯环 10,11,12,13)
    { idx: 10, neighbors: [7, 11] },
    { idx: 11, neighbors: [10, 12] },
    { idx: 12, neighbors: [11, 13] },
    { idx: 13, neighbors: [12, 8] },
  ],
};

// ------------------------------
// 23. 吩噻嗪 (Phenothiazine) - 两个苯环通过噻嗪环连接
// 原子: 12C + 1N + 1S = 14个
// 结构: 二苯并噻唑(N-S五元环)
// SMILES: c1ccc2c(c1)sc3ccccc3n2
// 五元环使用共享边生成，确保与苯环对齐
// ------------------------------
const phenothiazine: FusedRingFragment = {
  name: '吩噻嗪',
  smilesPattern: 'c1ccc2c(c1)sc3ccccc3n2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左苯环中心: (-R*√3*0.75, 0)
    const cx1 = -R * SQRT3 * 0.75;
    // 右苯环中心: (R*√3*0.75, 0)
    const cx2 = R * SQRT3 * 0.75;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    const right = generateHexagon(cx2, cy, R);
    for (let i = 0; i < 6; i++) {
      const idx = 6 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 噻嗪环使用共享边生成
    // 噻嗪环: left[5], S(12), C(13), N(14), right[0]
    const pentVerts = generatePentagonFromSharedEdge(left[5], right[0], { x: cx1, y: cy });
    // pentVerts = [left[5]的邻居(S), 中间(C), right[0]的邻居(N)]
    atoms.push({ idx: 12, symbol: 'S', isAromatic: false, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 13, symbol: 'C', isAromatic: false, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 14, symbol: 'N', isAromatic: false, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左苯环 (atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环 (atoms 6-11)
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 6, order: 1.5 },
    // 噻嗪环: left[5]-12(S)-13-14(N)-right[0]
    { atom1Idx: 5, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 6, order: 1.5 },
  ],
  topology: [
    // 左苯环
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0, 12] },
    // 右苯环
    { idx: 6, neighbors: [11, 7, 14] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 10] },
    { idx: 10, neighbors: [9, 11] },
    { idx: 11, neighbors: [10, 6] },
    // 噻嗪环
    { idx: 12, neighbors: [5, 13] },
    { idx: 13, neighbors: [12, 14] },
    { idx: 14, neighbors: [13, 6] },
  ],
};

// ------------------------------
// 24. 吩恶嗪 (Phenoxazine) - 两个苯环通过恶嗪环连接
// 原子: 12C + 1N + 1O = 14个
// 结构: 二苯并恶唑(N-O五元环)
// SMILES: c1ccc2c(c1)oc3ccccc3n2
// 五元环使用共享边生成，确保与苯环对齐
// ------------------------------
const phenoxazine: FusedRingFragment = {
  name: '吩恶嗪',
  smilesPattern: 'c1ccc2c(c1)oc3ccccc3n2',
  atoms: (() => {
    const atoms: FusedRingAtom[] = [];
    // 左苯环中心: (-R*√3*0.75, 0)
    const cx1 = -R * SQRT3 * 0.75;
    // 右苯环中心: (R*√3*0.75, 0)
    const cx2 = R * SQRT3 * 0.75;
    const cy = 0;
    const left = generateHexagon(cx1, cy, R);
    for (let i = 0; i < 6; i++) atoms.push({ idx: i, symbol: 'C', isAromatic: true, x: parseFloat(left[i].x.toFixed(6)), y: parseFloat(left[i].y.toFixed(6)), z: 0, charge: 0 });
    const right = generateHexagon(cx2, cy, R);
    for (let i = 0; i < 6; i++) {
      const idx = 6 + i;
      atoms.push({ idx, symbol: 'C', isAromatic: true, x: parseFloat(right[i].x.toFixed(6)), y: parseFloat(right[i].y.toFixed(6)), z: 0, charge: 0 });
    }
    // 恶嗪环使用共享边生成
    // 恶嗪环: left[5], O(12), C(13), N(14), right[0]
    const pentVerts = generatePentagonFromSharedEdge(left[5], right[0], { x: cx1, y: cy });
    // pentVerts = [left[5]的邻居(O), 中间(C), right[0]的邻居(N)]
    atoms.push({ idx: 12, symbol: 'O', isAromatic: false, x: pentVerts[0].x, y: pentVerts[0].y, z: 0, charge: 0 });
    atoms.push({ idx: 13, symbol: 'C', isAromatic: false, x: pentVerts[1].x, y: pentVerts[1].y, z: 0, charge: 0 });
    atoms.push({ idx: 14, symbol: 'N', isAromatic: false, x: pentVerts[2].x, y: pentVerts[2].y, z: 0, charge: 0 });
    return atoms;
  })(),
  bonds: [
    // 左苯环 (atoms 0-5)
    { atom1Idx: 0, atom2Idx: 1, order: 1.5 },
    { atom1Idx: 1, atom2Idx: 2, order: 1.5 },
    { atom1Idx: 2, atom2Idx: 3, order: 1.5 },
    { atom1Idx: 3, atom2Idx: 4, order: 1.5 },
    { atom1Idx: 4, atom2Idx: 5, order: 1.5 },
    { atom1Idx: 5, atom2Idx: 0, order: 1.5 },
    // 右苯环 (atoms 6-11)
    { atom1Idx: 6, atom2Idx: 7, order: 1.5 },
    { atom1Idx: 7, atom2Idx: 8, order: 1.5 },
    { atom1Idx: 8, atom2Idx: 9, order: 1.5 },
    { atom1Idx: 9, atom2Idx: 10, order: 1.5 },
    { atom1Idx: 10, atom2Idx: 11, order: 1.5 },
    { atom1Idx: 11, atom2Idx: 6, order: 1.5 },
    // 恶嗪环: left[5]-12(O)-13-14(N)-right[0]
    { atom1Idx: 5, atom2Idx: 12, order: 1.5 },
    { atom1Idx: 12, atom2Idx: 13, order: 1.5 },
    { atom1Idx: 13, atom2Idx: 14, order: 1.5 },
    { atom1Idx: 14, atom2Idx: 6, order: 1.5 },
  ],
  topology: [
    // 左苯环
    { idx: 0, neighbors: [5, 1] },
    { idx: 1, neighbors: [0, 2] },
    { idx: 2, neighbors: [1, 3] },
    { idx: 3, neighbors: [2, 4] },
    { idx: 4, neighbors: [3, 5] },
    { idx: 5, neighbors: [4, 0, 12] },
    // 右苯环
    { idx: 6, neighbors: [11, 7, 14] },
    { idx: 7, neighbors: [6, 8] },
    { idx: 8, neighbors: [7, 9] },
    { idx: 9, neighbors: [8, 10] },
    { idx: 10, neighbors: [9, 11] },
    { idx: 11, neighbors: [10, 6] },
    // 恶嗪环
    { idx: 12, neighbors: [5, 13] },
    { idx: 13, neighbors: [12, 14] },
    { idx: 14, neighbors: [13, 6] },
  ],
};

// 导出所有碎片
export const FUSED_RING_FRAGMENTS: FusedRingFragment[] = [
  naphthalene,
  anthracene,
  phenanthrene,
  indole,
  quinoline,
  benzimidazole,
  pyrene,
  purine,
  fluorene,
  dibenzofuran,
  benzoxazole,
  dibenzothiophene,
  betaCarboline,
  pteridine,
  naphthyridine,
  benzoCthiophene,
  benzoselenophene,
  acenaphthylene,
  acenaphthene,
  triphenylene,
  chrysene,
  benz_a_anthracene,
  perylene,
  tetracene,
  quinoxaline,
  quinazoline,
  cinnoline,
  phenazine,
  phenothiazine,
  phenoxazine,
  // 新增含一个杂原子的苯并稠环碎片
  benzothiazole,
  isoquinoline,
  benzofuran,
  benzothiophene,
  carbazole,
  acridine,
];

// ============ 图同构匹配（回溯搜索 + 约束传播） ============

/**
 * 匹配稠环碎片
 * @param atomIndices 分子中的原子索引数组
 * @param atoms 完整的分子原子数组
 * @param bonds 完整的分子键数组
 * @returns 匹配结果，atomMap的key=local索引，value=碎片原子索引
 */
export function matchFusedRingFragment(
  atomIndices: number[],
  atoms: Array<{ id: string; symbol: string; isAromatic: boolean }>,
  bonds: Array<{ atom1Id: string; atom2Id: string }>
): { fragment: FusedRingFragment; atomMap: Map<number, number> } | null {
  if (atomIndices.length < 8) return null;

  console.log(`[matchFusedRingFragment] === Starting matching ===`);
  console.log(`  atomIndices: [${atomIndices.join(', ')}]`);
  console.log(`  atomCount: ${atomIndices.length}`);

  // 构建local邻接表
  const atomIdToLocalIdx = new Map<string, number>();
  for (let i = 0; i < atomIndices.length; i++) {
    atomIdToLocalIdx.set(atoms[atomIndices[i]].id, i);
  }

  const localAdj: number[][] = Array(atomIndices.length).fill(0).map(() => []);
  const localSymbols: string[] = atomIndices.map(i => normalizeAtomSymbol(atoms[i].symbol));
  for (const bond of bonds) {
    const li1 = atomIdToLocalIdx.get(bond.atom1Id);
    const li2 = atomIdToLocalIdx.get(bond.atom2Id);
    if (li1 !== undefined && li2 !== undefined) {
      localAdj[li1].push(li2);
      localAdj[li2].push(li1);
    }
  }

  console.log(`  localSymbols: [${localSymbols.join(', ')}]`);
  console.log(`  localAdj:`);
  for (let i = 0; i < localAdj.length; i++) {
    const molIdx = atomIndices[i];
    console.log(`    local ${i} (mol ${molIdx} ${localSymbols[i]}): neighbors=[${localAdj[i].join(', ')}] (deg=${localAdj[i].length})`);
  }

  // 遍历所有碎片，找匹配
  for (const fragment of FUSED_RING_FRAGMENTS) {
    if (fragment.atoms.length !== atomIndices.length) continue;
    console.log(`  Trying fragment: ${fragment.name} (${fragment.atoms.length} atoms)`);
    
    // 快速验证：统计C/N/O/S数量是否一致
    const fragSymbols = fragment.atoms.map(a => normalizeAtomSymbol(a.symbol));
    const molSymbols = atomIndices.map(i => normalizeAtomSymbol(atoms[i].symbol));
    let symbolMatch = true;
    const countFrag = (sym: string) => fragSymbols.filter(s => s === sym).length;
    const countMol = (sym: string) => molSymbols.filter(s => s === sym).length;
    for (const sym of ['C', 'N', 'O', 'S', 'SE']) {
      const fc = countFrag(sym);
      const mc = countMol(sym);
      if (fc !== mc) {
        console.log(`    Symbol count mismatch: ${sym} frag=${fc} mol=${mc}`);
        symbolMatch = false;
        break;
      }
    }
    if (!symbolMatch) continue;
    console.log(`    Symbol counts match ✓`);
    
    // 度数分布快速验证
    const fragDegreeDist = new Map<number, number>();
    for (const t of fragment.topology) {
      fragDegreeDist.set(t.neighbors.length, (fragDegreeDist.get(t.neighbors.length) || 0) + 1);
    }
    const molDegreeDist = new Map<number, number>();
    for (let i = 0; i < localAdj.length; i++) {
      const deg = localAdj[i].length;
      molDegreeDist.set(deg, (molDegreeDist.get(deg) || 0) + 1);
    }
    let degreeMatch = true;
    for (const [deg, count] of fragDegreeDist) {
      if (molDegreeDist.get(deg) !== count) {
        console.log(`    Degree dist mismatch: deg=${deg} frag=${count} mol=${molDegreeDist.get(deg)}`);
        degreeMatch = false; break;
      }
    }
    if (!degreeMatch) continue;
    console.log(`    Degree distribution match ✓`);
    
    // 通用回溯匹配：从每个local原子尝试映射到每个兼容的fragment原子
    // 优先从3度节点开始（约束最多，剪枝最快）
    const sortedLocalIndices = Array.from({ length: localAdj.length }, (_, i) => i)
      .sort((a, b) => localAdj[b].length - localAdj[a].length);
    
    const startLocal = sortedLocalIndices[0];
    const startMolSymbol = atoms[atomIndices[startLocal]].symbol.toUpperCase();
    console.log(`    Starting from local ${startLocal} (mol ${atomIndices[startLocal]} ${startMolSymbol}, deg=${localAdj[startLocal].length})`);
    
    let attemptCount = 0;
    for (const fragAtom of fragment.topology) {
      // 符号必须匹配
      if (fragment.atoms[fragAtom.idx].symbol.toUpperCase() !== startMolSymbol) continue;
      // 度数必须匹配
      if (fragAtom.neighbors.length !== localAdj[startLocal].length) continue;
      
      attemptCount++;
      console.log(`    Attempt ${attemptCount}: mapping local ${startLocal} → frag ${fragAtom.idx} (${fragment.atoms[fragAtom.idx].symbol})`);
      
      const localToFrag = new Map<number, number>();
      const fragToLocal = new Map<number, number>();
      localToFrag.set(startLocal, fragAtom.idx);
      fragToLocal.set(fragAtom.idx, startLocal);
      
      if (backtrackIso(localAdj, fragment.topology, localToFrag, fragToLocal, localSymbols, fragment.atoms)) {
        console.log(`[matchFusedRingFragment] ✓ 匹配到${fragment.name}`);
        console.log(`  atomMap:`);
        for (const [localIdx, fragIdx] of localToFrag) {
          console.log(`    local ${localIdx} (mol ${atomIndices[localIdx]} ${localSymbols[localIdx]}) → frag ${fragIdx} (${fragment.atoms[fragIdx].symbol})`);
        }
        return { fragment, atomMap: localToFrag };
      } else {
        console.log(`    Backtracking failed for this attempt`);
      }
    }
    
    if (attemptCount === 0) {
      console.log(`    No compatible starting fragment atom found`);
    }
  }

  console.log(`[matchFusedRingFragment] ✗ No fragment matched`);
  return null;
}

/**
 * 回溯搜索图同构映射
 */
function backtrackIso(
  localAdj: number[][],
  fragTopology: Array<{ idx: number; neighbors: number[] }>,
  localToFrag: Map<number, number>,
  fragToLocal: Map<number, number>,
  localSymbols?: string[],
  fragAtoms?: FusedRingAtom[]
): boolean {
  if (localToFrag.size === localAdj.length) return true;
  
  // 选择约束最多的未映射节点
  let bestLocal = -1;
  let bestMappedCount = -1;
  for (let i = 0; i < localAdj.length; i++) {
    if (localToFrag.has(i)) continue;
    const mappedCount = localAdj[i].filter(n => localToFrag.has(n)).length;
    if (mappedCount > bestMappedCount) {
      bestMappedCount = mappedCount;
      bestLocal = i;
    }
  }
  
  if (bestLocal === -1) return true;
  
  // 找兼容的fragment原子
  for (const ft of fragTopology) {
    if (fragToLocal.has(ft.idx)) continue;
    
    // 度数检查
    if (localAdj[bestLocal].length !== ft.neighbors.length) continue;
    
    // 原子符号匹配
    if (localSymbols && fragAtoms) {
      const localSym = localSymbols[bestLocal];
      const fragAtom = fragAtoms.find(a => a.idx === ft.idx);
      if (fragAtom && normalizeAtomSymbol(fragAtom.symbol) !== normalizeAtomSymbol(localSym)) continue;
    }
    
    // 键一致性验证
    let consistent = true;
    for (const localN of localAdj[bestLocal]) {
      if (localToFrag.has(localN)) {
        const fragN = localToFrag.get(localN)!;
        if (!ft.neighbors.includes(fragN)) {
          consistent = false;
          break;
        }
      }
    }
    if (!consistent) continue;
    
    for (const fragN of ft.neighbors) {
      if (fragToLocal.has(fragN)) {
        const localN = fragToLocal.get(fragN)!;
        if (!localAdj[bestLocal].includes(localN)) {
          consistent = false;
          break;
        }
      }
    }
    if (!consistent) continue;
    
    // 尝试赋值
    localToFrag.set(bestLocal, ft.idx);
    fragToLocal.set(ft.idx, bestLocal);
    
    if (backtrackIso(localAdj, fragTopology, localToFrag, fragToLocal, localSymbols, fragAtoms)) return true;
    
    localToFrag.delete(bestLocal);
    fragToLocal.delete(ft.idx);
  }
  
  return false;
}

/**
 * 应用碎片坐标到分子
 * @param fragment 碎片定义
 * @param atomMap key=分子原子索引，value=碎片原子索引
 * @param parsedAtoms 完整的分子原子数组
 * @param atomPositions 原子位置Map
 */
export function applyFusedRingFragment(
  fragment: FusedRingFragment,
  atomMap: Map<number, number>,
  parsedAtoms: Array<{ id: string }>,
  atomPositions: Map<string, { x: number; y: number; z: number }>
): void {
  const fragCenter = { x: 0, y: 0, z: 0 };
  for (const atom of fragment.atoms) {
    fragCenter.x += atom.x;
    fragCenter.y += atom.y;
    fragCenter.z += atom.z;
  }
  fragCenter.x /= fragment.atoms.length;
  fragCenter.y /= fragment.atoms.length;
  fragCenter.z /= fragment.atoms.length;

  for (const [molIdx, fragIdx] of atomMap) {
    const fragAtom = fragment.atoms.find(a => a.idx === fragIdx);
    if (!fragAtom) continue;
    
    const atomId = parsedAtoms[molIdx].id;
    atomPositions.set(atomId, {
      x: parseFloat((fragAtom.x - fragCenter.x).toFixed(6)),
      y: parseFloat((fragAtom.y - fragCenter.y).toFixed(6)),
      z: 0,
    });
  }
  
  console.log(`[applyFusedRingFragment] ✓ 已应用碎片：${fragment.name}`);
}
