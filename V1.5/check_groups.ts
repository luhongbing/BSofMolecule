import { FUNCTIONAL_GROUPS } from './src/utils/functionalGroups';

// 键长容差：±0.15 Å
const BOND_LENGTH_TOL = 0.15;
// 键角容差：±15°
const BOND_ANGLE_TOL = 15;
// 原子重叠最小距离
const MIN_NONBOND_DIST = 0.8;

// 标准键长表（与 functionalGroups.ts 一致）
const STANDARD_BL: Record<string, number> = {
  // C-C 系列
  'C-C-1': 1.54, 'C-C-2': 1.34, 'C-C-3': 1.20,
  // C-H
  'C-H-1': 1.09,
  // C-O 系列
  'C-O-1': 1.43, 'C-O-2': 1.22,
  // O-H
  'O-H-1': 0.96,
  // C-N 系列
  'C-N-1': 1.47, 'C-N-2': 1.29, 'C-N-3': 1.16,
  // N-H
  'N-H-1': 1.01,
  // 卤素
  'C-Cl-1': 1.77, 'C-Br-1': 1.94, 'C-I-1': 2.14, 'C-F-1': 1.35,
  // C-S
  'C-S-1': 1.82, 'C-S-2': 1.60,
  // N-N
  'N-N-1': 1.45, 'N-N-2': 1.25,
  // N-O
  'N-O-1': 1.41, 'N-O-2': 1.22,
  // S-O
  'S-O-1': 1.57, 'S-O-2': 1.43,
  // S-H
  'S-H-1': 1.34,
  // P-O
  'P-O-1': 1.54, 'P-O-2': 1.50,
  // P-H
  'P-H-1': 1.44,
  // O-O
  'O-O-1': 1.48,
};

// 空头键长度（连接到外部 C 原子）
const EMPTY_BL: Record<string, Record<number, number>> = {
  'C': { 1: 1.54, 2: 1.34, 3: 1.20 },
  'O': { 1: 1.43, 2: 1.22 },
  'N': { 1: 1.47, 2: 1.29, 3: 1.16 },
  'S': { 1: 1.82, 2: 1.60 },
  'P': { 1: 1.84, 2: 1.50 },
  'F': { 1: 1.35 },
  'Cl': { 1: 1.77 },
  'Br': { 1: 1.94 },
  'I': { 1: 2.14 },
};

function getBondLength(symbol1: string, symbol2: string, order: number): number {
  const k1 = `${symbol1}-${symbol2}-${order}`;
  const k2 = `${symbol2}-${symbol1}-${order}`;
  if (STANDARD_BL[k1]) return STANDARD_BL[k1];
  if (STANDARD_BL[k2]) return STANDARD_BL[k2];
  // 退回到单键长度
  const k1b = `${symbol1}-${symbol2}-1`;
  const k2b = `${symbol2}-${symbol1}-1`;
  if (STANDARD_BL[k1b]) return STANDARD_BL[k1b];
  if (STANDARD_BL[k2b]) return STANDARD_BL[k2b];
  return 1.5; // 默认值
}

function dist(a: { x: number; y: number; z: number },
             b: { x: number; y: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

function angleDeg(
  p1: { x: number; y: number; z: number },
  center: { x: number; y: number; z: number },
  p3: { x: number; y: number; z: number }
): number {
  const v1 = { x: p1.x - center.x, y: p1.y - center.y, z: p1.z - center.z };
  const v2 = { x: p3.x - center.x, y: p3.y - center.y, z: p3.z - center.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const m1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const m2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);
  if (m1 < 1e-9 || m2 < 1e-9) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

// 标准键角：sp3 (109.5), sp2 (120), sp (180)
const STANDARD_ANGLES = [109.5, 120, 180];

function checkAngle(angle: number, tol: number = BOND_ANGLE_TOL): boolean {
  // 检查角度是否接近任一标准键角
  for (const ideal of STANDARD_ANGLES) {
    if (Math.abs(angle - ideal) <= tol) return true;
  }
  return false;
}

function findNearestIdealAngle(angle: number): number {
  let best = STANDARD_ANGLES[0];
  let bestDiff = Math.abs(angle - best);
  for (const a of STANDARD_ANGLES) {
    const diff = Math.abs(angle - a);
    if (diff < bestDiff) { best = a; bestDiff = diff; }
  }
  return best;
}

function checkGroup(group: typeof FUNCTIONAL_GROUPS[0]): string[] {
  const issues: string[] = [];
  const atoms = group.atoms;
  const atomMap = new Map(atoms.map(a => [a.idx, a]));

  // ===== 1. 检查内部键长 =====
  for (const b of group.bonds) {
    const a1 = atomMap.get(b.atom1Idx);
    const a2 = atomMap.get(b.atom2Idx);
    if (!a1 || !a2) continue;
    const actual = dist(a1, a2);
    const expected = getBondLength(a1.symbol, a2.symbol, b.order);
    if (Math.abs(actual - expected) > BOND_LENGTH_TOL) {
      issues.push(
        `键长错误: ${a1.symbol}(${b.atom1Idx})-${a2.symbol}(${b.atom2Idx}) order=${b.order}: actual=${actual.toFixed(3)}Å, standard=${expected.toFixed(2)}Å, diff=${(actual - expected).toFixed(3)}`
      );
    }
  }

  // ===== 2. 检查空头键长度 =====
  if (group.emptyBonds) {
    for (const eb of group.emptyBonds) {
      const atom = atomMap.get(eb.atomIdx);
      if (!atom) continue;
      const actual = dist(atom, eb.position);
      const stdEntry = EMPTY_BL[atom.symbol];
      const expected = stdEntry ? (stdEntry[eb.order] || stdEntry[1] || 1.54) : 1.54;
      if (Math.abs(actual - expected) > BOND_LENGTH_TOL) {
        issues.push(
          `空头键长错误: ${atom.symbol}(${eb.atomIdx}) order=${eb.order}: actual=${actual.toFixed(3)}Å, standard=${expected.toFixed(2)}Å, diff=${(actual - expected).toFixed(3)}`
        );
      }
    }
  }

  // ===== 3. 检查原子重叠（非键连原子） =====
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const isBonded = group.bonds.some(
        b => (b.atom1Idx === atoms[i].idx && b.atom2Idx === atoms[j].idx) ||
             (b.atom1Idx === atoms[j].idx && b.atom2Idx === atoms[i].idx)
      );
      if (isBonded) continue;
      const d = dist(atoms[i], atoms[j]);
      if (d < MIN_NONBOND_DIST) {
        issues.push(
          `原子重叠: ${atoms[i].symbol}(${atoms[i].idx})-${atoms[j].symbol}(${atoms[j].idx}): dist=${d.toFixed(3)}Å`
        );
      }
    }
  }

  // ===== 4. 检查键角 =====
  for (const center of atoms) {
    // 收集所有邻居（包括空头键的位置）
    const neighbors: { pos: { x: number; y: number; z: number }; label: string }[] = [];
    for (const b of group.bonds) {
      if (b.atom1Idx === center.idx) {
        const a = atomMap.get(b.atom2Idx);
        if (a) neighbors.push({ pos: { x: a.x, y: a.y, z: a.z }, label: `${a.symbol}(${a.idx})` });
      } else if (b.atom2Idx === center.idx) {
        const a = atomMap.get(b.atom1Idx);
        if (a) neighbors.push({ pos: { x: a.x, y: a.y, z: a.z }, label: `${a.symbol}(${a.idx})` });
      }
    }
    if (group.emptyBonds) {
      for (const eb of group.emptyBonds) {
        if (eb.atomIdx === center.idx) {
          neighbors.push({ pos: eb.position, label: `empty(${eb.order})` });
        }
      }
    }

    if (neighbors.length >= 2) {
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          const ang = angleDeg(neighbors[i].pos, { x: center.x, y: center.y, z: center.z }, neighbors[j].pos);
          if (!checkAngle(ang)) {
            const ideal = findNearestIdealAngle(ang);
            issues.push(
              `键角偏差: ${center.symbol}(${center.idx}) [${neighbors[i].label}→center→${neighbors[j].label}]: angle=${ang.toFixed(1)}°, nearest ideal=${ideal}°, deviation=${(ang - ideal).toFixed(1)}°`
            );
          }
        }
      }
    }
  }

  return issues;
}

// ===== 运行 =====
console.log('========== 官能团结构检查 ==========\n');
let totalGroups = 0;
let groupsWithIssues = 0;
let totalIssues = 0;

for (const group of FUNCTIONAL_GROUPS) {
  totalGroups++;
  const issues = checkGroup(group);
  if (issues.length > 0) {
    groupsWithIssues++;
    console.log(`[${group.id}] ${group.name}:`);
    for (const issue of issues) {
      console.log(`  ${issue}`);
      totalIssues++;
    }
    console.log();
  } else {
    console.log(`[${group.id}] ${group.name}: ✅ OK\n`);
  }
}

console.log('========== 总结 ==========');
console.log(`检查官能团: ${totalGroups} 个`);
console.log(`有问题的官能团: ${groupsWithIssues} 个`);
console.log(`总问题数: ${totalIssues}`);
