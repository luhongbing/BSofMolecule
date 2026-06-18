// 综合验证脚本：键长 + 键角 + 化合价 + 共面性 + 原子重叠
// 编译: npx esbuild --bundle --format=cjs --platform=node --outfile=./fg-bundle.cjs src/utils/functionalGroups.ts
// 运行: node run-verify-rigidity.cjs

const fs = require('fs');

// 从 fg-bundle.cjs 中提取 functionalGroups
const bundle = require('./fg-bundle.cjs');
const FUNCTIONAL_GROUPS = bundle.FUNCTIONAL_GROUPS || bundle.default?.FUNCTIONAL_GROUPS;
if (!FUNCTIONAL_GROUPS) {
  console.error('无法找到 FUNCTIONAL_GROUPS，导出:', Object.keys(bundle));
  process.exit(1);
}

// 标准键长表 (与 molecularConstraints.ts 一致)
const STANDARD_BOND_LENGTHS = {
  'C-C': { 1: 1.54, 2: 1.34, 3: 1.20 },
  'C-H': { 1: 1.09 },
  'C-O': { 1: 1.43, 2: 1.22 },
  'O-H': { 1: 0.96 },
  'C-N': { 1: 1.47, 2: 1.29, 3: 1.16 },
  'N-H': { 1: 1.01 },
  'C-S': { 1: 1.82, 2: 1.60 },
  'S-H': { 1: 1.34 },
  'C-P': { 1: 1.84 },
  'P-H': { 1: 1.44 },
  'P-O': { 1: 1.50, 2: 1.45 },
  'C-Cl': { 1: 1.77 },
  'C-Br': { 1: 1.94 },
  'C-I': { 1: 2.14 },
  'C-F': { 1: 1.35 },
  'N-N': { 1: 1.45, 2: 1.25 },
  'N-O': { 1: 1.40, 2: 1.21 },
  'S-O': { 1: 1.57, 2: 1.43 },
  'O-O': { 1: 1.48 },
  'C-C_aromatic': { 1: 1.39 },
};

// 化合价
const VALENCES = {
  H: [1],
  C: [4],
  N: [3, 5],
  O: [2],
  F: [1],
  P: [3, 5],
  S: [2, 4, 6],
  Cl: [1],
  Br: [1],
  I: [1],
};

// 最小原子距离
const MIN_ATOM_DISTANCE = 1.0;

function getBondLength(s1, s2, order) {
  const key1 = `${s1}-${s2}`;
  const key2 = `${s2}-${s1}`;
  const table = STANDARD_BOND_LENGTHS[key1] || STANDARD_BOND_LENGTHS[key2];
  if (table && table[order]) return table[order];
  if (table && table[1]) return table[1];
  return 1.5;
}

function getValence(symbol) {
  return VALENCES[symbol] || [4];
}

function checkDefaultValence(symbol, totalBondOrder) {
  const valences = getValence(symbol);
  return valences.includes(totalBondOrder);
}

function angle(p1, c, p2) {
  const v1 = { x: p1.x - c.x, y: p1.y - c.y, z: (p1.z||0) - (c.z||0) };
  const v2 = { x: p2.x - c.x, y: p2.y - c.y, z: (p2.z||0) - (c.z||0) };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const l1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y + v1.z*v1.z);
  const l2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y + v2.z*v2.z);
  if (l1 < 0.0001 || l2 < 0.0001) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (l1 * l2)))) * 180 / Math.PI;
}

function dist(p1, p2) {
  const dx = p1.x - p2.x, dy = p1.y - p2.y, dz = (p1.z||0) - (p2.z||0);
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

function getHyb(symbol, neighborCount, doubleBondCount, hasTriple) {
  if (hasTriple) return 'sp';
  if (symbol === 'O') {
    if (neighborCount === 1 && doubleBondCount >= 1) return 'sp2';
    return 'sp3';
  }
  if (symbol === 'S') {
    if (neighborCount === 2 && doubleBondCount >= 1) return 'sp2';
    return 'sp3';
  }
  if (neighborCount === 2) {
    if (doubleBondCount === 2) return 'sp';
    if (doubleBondCount === 1) return 'sp2';
    return 'sp';
  }
  if (neighborCount === 3) {
    // 与 SMILES 解析器一致：3 邻居 N/P 一律 sp2
    return 'sp2';
  }
  if (neighborCount === 4) return 'sp3';
  return 'sp3';
}

function ideal(hyb) {
  if (hyb === 'sp') return 180;
  if (hyb === 'sp2') return 120;
  return 109.5;
}

console.log(`Found ${FUNCTIONAL_GROUPS.length} groups\n`);

const allIssues = {
  bondLength: [],
  bondAngle: [],
  valence: [],
  coplanar: [],
  collinear: [],
  overlap: [],
  benzene: [],
  emptyBondCount: [],
};

for (const g of FUNCTIONAL_GROUPS) {
  // 构建原子映射
  const atoms = g.atoms || [];
  const bonds = g.bonds || [];
  const emptyBonds = g.emptyBonds || [];

  const atomMap = new Map();
  for (const a of atoms) atomMap.set(a.idx, a);

  // ===== 1. 键长检查 =====
  for (const b of bonds) {
    const a1 = atomMap.get(b.atom1Idx);
    const a2 = atomMap.get(b.atom2Idx);
    if (!a1 || !a2) continue;
    const actualLen = dist(a1, a2);
    // 苯基中的 C-C 键使用芳香键长 1.39
    let idealLen;
    if (g.id === 'phenyl' && (a1.symbol === 'C' && a2.symbol === 'C')) {
      idealLen = 1.39;
    } else {
      idealLen = getBondLength(a1.symbol, a2.symbol, b.order);
    }
    const dev = Math.abs(actualLen - idealLen) / idealLen * 100;
    if (dev > 5) {
      allIssues.bondLength.push({
        group: g.name,
        id: g.id,
        bond: `${a1.symbol}${a1.idx}-${a2.symbol}${a2.idx}`,
        order: b.order,
        actual: actualLen.toFixed(3),
        ideal: idealLen.toFixed(3),
        dev: dev.toFixed(1) + '%'
      });
    }
  }

  // ===== 2. 键角检查 =====
  for (const a of atoms) {
    if (a.symbol === 'H') continue;
    const directions = [];
    let hasTriple = false;
    let doubleBondCount = 0;

    for (const b of bonds) {
      if (b.atom1Idx === a.idx) {
        const n = atomMap.get(b.atom2Idx);
        if (n) directions.push({ pos: n });
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
      if (b.atom2Idx === a.idx) {
        const n = atomMap.get(b.atom1Idx);
        if (n) directions.push({ pos: n });
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
    }

    for (const eb of emptyBonds) {
      if (eb.atomIdx === a.idx) {
        directions.push({ pos: { x: eb.position.x, y: eb.position.y, z: (eb.position.z||0) } });
        if (eb.order === 3) hasTriple = true;
        if (eb.order === 2) doubleBondCount++;
      }
    }

    if (directions.length < 2) continue;
    const hyb = getHyb(a.symbol, directions.length, doubleBondCount, hasTriple);
    const i = ideal(hyb);

    for (let k = 0; k < directions.length; k++) {
      for (let j = k + 1; j < directions.length; j++) {
        const act = angle(directions[k].pos, a, directions[j].pos);
        const dev = Math.abs(act - i);
        if (dev > 5) {
          allIssues.bondAngle.push({
            group: g.name,
            id: g.id,
            atom: `${a.symbol}(${a.idx})`,
            hyb,
            actual: act.toFixed(1),
            ideal: i.toFixed(1),
            dev: dev.toFixed(1)
          });
        }
      }
    }
  }

  // ===== 3. 化合价检查 =====
  for (const a of atoms) {
    if (a.symbol === 'H') continue;
    let totalBondOrder = 0;
    for (const b of bonds) {
      if (b.atom1Idx === a.idx || b.atom2Idx === a.idx) totalBondOrder += b.order;
    }
    for (const eb of emptyBonds) {
      if (eb.atomIdx === a.idx) totalBondOrder += eb.order;
    }

    // 计算隐式 H 数（化合价 - 当前总键序）
    const possibleValences = getValence(a.symbol);
    // 选最大化合价（多数情况）
    const maxValence = Math.max(...possibleValences);
    const implicitH = Math.max(0, maxValence - totalBondOrder);

    // 连接点（connectionPoint）原子有 1 个外部键，应 +1 化合价占用
    // 苯环 C 与 C 之间是 Kekulé 表示（6 个单键），C 实际有 1 个隐式 H
    const isConnectionPoint = (g.connectionPoint === a.idx);
    const isPhenylAromatic = (g.id === 'phenyl' && a.symbol === 'C');

    // 真实化合价占用 = totalBondOrder + 隐式H + 连接点外部键
    const effectiveBondOrder = totalBondOrder + implicitH + (isConnectionPoint ? 1 : 0);

    // 检查化合价是否匹配
    // 注意：连接点有 1 个外部键（来自外部分子），所以化合价占用要 +1
    // 苯基 C 在 Kekulé 表示中有 3 个键 + 1 隐式 H = 4 价

    // 如果 effectiveBondOrder 不在化合价列表中
    // 但若 effectiveBondOrder - 1 (去连接点外部) 在列表中，也算正常
    const possibleValencesWithExt = [
      ...possibleValences,
      ...possibleValences.map(v => v + 1)  // 含外部分子的键
    ];
    if (!possibleValencesWithExt.includes(effectiveBondOrder) && !possibleValences.includes(totalBondOrder + implicitH)) {
      allIssues.valence.push({
        group: g.name,
        id: g.id,
        atom: `${a.symbol}(${a.idx})`,
        totalBondOrder,
        implicitH,
        isConnectionPoint,
        effectiveBondOrder,
        valences: possibleValences
      });
    }
  }

  // ===== 4. 共面性检查（sp2 原子及其邻居应共面） =====
  for (const a of atoms) {
    if (a.symbol === 'H') continue;
    const neighbors = [];
    let doubleBondCount = 0;
    let hasTriple = false;

    for (const b of bonds) {
      if (b.atom1Idx === a.idx) {
        const n = atomMap.get(b.atom2Idx);
        if (n) neighbors.push(n);
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
      if (b.atom2Idx === a.idx) {
        const n = atomMap.get(b.atom1Idx);
        if (n) neighbors.push(n);
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
    }
    for (const eb of emptyBonds) {
      if (eb.atomIdx === a.idx) {
        neighbors.push({ x: eb.position.x, y: eb.position.y, z: (eb.position.z||0), _empty: true });
        if (eb.order === 3) hasTriple = true;
        if (eb.order === 2) doubleBondCount++;
      }
    }

    if (neighbors.length < 3) continue;
    const hyb = getHyb(a.symbol, neighbors.length, doubleBondCount, hasTriple);
    if (hyb !== 'sp2' && hyb !== 'sp') continue;  // 只检查 sp2/sp

    // 检查所有邻居是否共面（与中心原子 a）
    // 取前3个原子确定平面
    const p1 = neighbors[0], p2 = neighbors[1], p3 = neighbors[2];
    const v1 = { x: p1.x - a.x, y: p1.y - a.y, z: (p1.z||0) - (a.z||0) };
    const v2 = { x: p2.x - a.x, y: p2.y - a.y, z: (p2.z||0) - (a.z||0) };
    // 法向量
    const normal = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };
    const nLen = Math.sqrt(normal.x*normal.x + normal.y*normal.y + normal.z*normal.z);
    if (nLen < 0.0001) continue;
    normal.x /= nLen; normal.y /= nLen; normal.z /= nLen;

    for (let k = 3; k < neighbors.length; k++) {
      const n = neighbors[k];
      const v = { x: n.x - a.x, y: n.y - a.y, z: (n.z||0) - (a.z||0) };
      const dot = Math.abs(v.x * normal.x + v.y * normal.y + v.z * normal.z);
      // dot 是该邻居到前3邻居平面的距离
      const distFromPlane = dot;
      if (distFromPlane > 0.1) {
        allIssues.coplanar.push({
          group: g.name,
          id: g.id,
          atom: `${a.symbol}(${a.idx})`,
          hyb,
          neighbor: n._empty ? 'empty' : `${n.symbol}(${n.idx})`,
          deviation: distFromPlane.toFixed(3)
        });
      }
    }
  }

  // ===== 5. 共线性检查（sp 杂化原子周围的 2 个邻居应共线） =====
  for (const a of atoms) {
    if (a.symbol === 'H') continue;
    const neighbors = [];
    let doubleBondCount = 0;
    let hasTriple = false;

    for (const b of bonds) {
      if (b.atom1Idx === a.idx) {
        const n = atomMap.get(b.atom2Idx);
        if (n) neighbors.push(n);
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
      if (b.atom2Idx === a.idx) {
        const n = atomMap.get(b.atom1Idx);
        if (n) neighbors.push(n);
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
    }
    for (const eb of emptyBonds) {
      if (eb.atomIdx === a.idx) {
        neighbors.push({ x: eb.position.x, y: eb.position.y, z: (eb.position.z||0) });
        if (eb.order === 3) hasTriple = true;
        if (eb.order === 2) doubleBondCount++;
      }
    }

    if (neighbors.length !== 2) continue;
    const hyb = getHyb(a.symbol, 2, doubleBondCount, hasTriple);
    if (hyb !== 'sp') continue;

    // 检查两个邻居与 a 共线
    const n1 = neighbors[0], n2 = neighbors[1];
    const v1 = { x: n1.x - a.x, y: n1.y - a.y, z: (n1.z||0) - (a.z||0) };
    const v2 = { x: n2.x - a.x, y: n2.y - a.y, z: (n2.z||0) - (a.z||0) };
    const cross = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };
    const crossLen = Math.sqrt(cross.x*cross.x + cross.y*cross.y + cross.z*cross.z);
    if (crossLen > 0.1) {
      allIssues.collinear.push({
        group: g.name,
        id: g.id,
        atom: `${a.symbol}(${a.idx})`,
        hyb,
        crossLen: crossLen.toFixed(3)
      });
    }
  }

  // ===== 6. 原子重叠检查 =====
  const allPositions = [];
  for (const a of atoms) allPositions.push({ ...a, _type: 'atom' });
  for (const eb of emptyBonds) {
    const a = atomMap.get(eb.atomIdx);
    if (a) allPositions.push({ x: a.x + eb.position.x, y: a.y + eb.position.y, z: (a.z||0) + (eb.position.z||0), _type: 'empty' });
  }
  for (let i = 0; i < allPositions.length; i++) {
    for (let j = i + 1; j < allPositions.length; j++) {
      const d = dist(allPositions[i], allPositions[j]);
      if (d < MIN_ATOM_DISTANCE * 0.8 && d > 0.0001) {
        allIssues.overlap.push({
          group: g.name,
          id: g.id,
          pair: `${allPositions[i]._type}-${allPositions[j]._type}`,
          dist: d.toFixed(3)
        });
      }
    }
  }

  // ===== 7. 苯环规则 =====
  if (g.id === 'phenyl') {
    // 苯环 6 个 C 应该是正六边形
    // 6 个 C 索引：0,1,2,3,4,5
    // 0-1, 1-2, 2-3, 3-4, 4-5, 5-0 键长都应该是 1.39
    const ringIndices = [0, 1, 2, 3, 4, 5];
    const ringBonds = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]];
    const bondLens = [];
    for (const [i, j] of ringBonds) {
      const a1 = atomMap.get(i), a2 = atomMap.get(j);
      bondLens.push(dist(a1, a2));
    }
    const avg = bondLens.reduce((s, x) => s + x, 0) / bondLens.length;
    const maxDev = Math.max(...bondLens.map(x => Math.abs(x - 1.39) / 1.39 * 100));
    if (maxDev > 5) {
      allIssues.benzene.push({
        group: g.name,
        bondLens: bondLens.map(x => x.toFixed(3)),
        avg: avg.toFixed(3),
        maxDev: maxDev.toFixed(1) + '%'
      });
    }
    // 检查内角（每个 C 的键角）应是 120°
    for (let k = 0; k < ringIndices.length; k++) {
      const prev = atomMap.get(ringIndices[(k + 5) % 6]);
      const curr = atomMap.get(ringIndices[k]);
      const next = atomMap.get(ringIndices[(k + 1) % 6]);
      const ang = angle(prev, curr, next);
      if (Math.abs(ang - 120) > 3) {
        allIssues.benzene.push({
          group: g.name,
          atom: `C(${ringIndices[k]})`,
          angle: ang.toFixed(1) + '°',
          ideal: '120°'
        });
      }
    }
  }

  // ===== 8. 空头键数量检查 =====
  // 每个原子的化合价应被满足：内部键 + 空头键 = 化合价（或允许隐式 H）
  for (const a of atoms) {
    if (a.symbol === 'H') continue;
    const valences = getValence(a.symbol);
    const maxValence = Math.max(...valences);

    // 计算该原子的内部键总键序
    let internalBondOrder = 0;
    for (const b of bonds) {
      if (b.atom1Idx === a.idx || b.atom2Idx === a.idx) internalBondOrder += b.order;
    }

    // 计算该原子的空头键总键序
    let emptyBondOrder = 0;
    for (const eb of emptyBonds) {
      if (eb.atomIdx === a.idx) emptyBondOrder += eb.order;
    }

    // 总键序 = 内部键 + 空头键
    // 注意：空头键就是"待连接键"，connectionPoint 只是位置标记，不额外增加键序
    const totalBondOrder = internalBondOrder + emptyBondOrder;

    // 检查是否满足化合价
    // 允许隐式 H 填补差额
    const implicitH = Math.max(0, maxValence - totalBondOrder);

    // 如果总键序超过最大化合价，报错
    if (totalBondOrder > maxValence) {
      allIssues.emptyBondCount.push({
        group: g.name,
        id: g.id,
        atom: `${a.symbol}(${a.idx})`,
        internalBondOrder,
        emptyBondOrder,
        totalBondOrder,
        maxValence,
        issue: '总键序超过化合价'
      });
    }
  }
}

// 报告
console.log('='.repeat(60));
console.log('综合刚性约束检查报告');
console.log('='.repeat(60));

const categories = [
  ['键长偏差', allIssues.bondLength],
  ['键角偏差', allIssues.bondAngle],
  ['化合价异常', allIssues.valence],
  ['共面性偏差', allIssues.coplanar],
  ['共线性偏差', allIssues.collinear],
  ['原子重叠', allIssues.overlap],
  ['苯环规则', allIssues.benzene],
  ['空头键数量', allIssues.emptyBondCount],
];

let total = 0;
for (const [name, list] of categories) {
  console.log(`\n[${name}] ${list.length} 个问题:`);
  for (const item of list.slice(0, 15)) {
    console.log('  ', JSON.stringify(item));
  }
  if (list.length > 15) console.log(`  ... 还有 ${list.length - 15} 个`);
  total += list.length;
}

console.log(`\n${'='.repeat(60)}`);
console.log(`总计: ${total} 个问题`);
console.log('='.repeat(60));
