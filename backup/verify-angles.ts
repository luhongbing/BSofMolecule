/**
 * 复核所有官能团中重原子的键角
 * 使用与SMILES解析相同的几何计算规则
 */

import { FUNCTIONAL_GROUPS } from './src/utils/functionalGroups';
import { getValences } from './src/utils/elements';

// 1. 计算两个向量之间的夹角（度）
function angle(p1: {x: number, y: number, z: number}, center: {x: number, y: number, z: number}, p2: {x: number, y: number, z: number}): number {
  const v1 = { x: p1.x - center.x, y: p1.y - center.y, z: p1.z - center.z };
  const v2 = { x: p2.x - center.x, y: p2.y - center.y, z: p2.z - center.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  if (len1 < 0.0001 || len2 < 0.0001) return 0;
  const cosA = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return Math.acos(cosA) * 180 / Math.PI;
}

// 2. 判断原子的杂化类型（基于总键序和元素）
function getHybridization(symbol: string, totalBondOrder: number, isAromatic: boolean = false): 'sp' | 'sp2' | 'sp3' {
  if (symbol === 'H') return 'sp3';

  if (symbol === 'O' || symbol === 'S') {
    if (totalBondOrder >= 2) return 'sp2';
    return 'sp3';
  }

  if (symbol === 'N') {
    if (isAromatic) return 'sp2';
    if (totalBondOrder >= 3) return 'sp';
    if (totalBondOrder >= 2) return 'sp2';
    return 'sp3';
  }

  if (symbol === 'C') {
    if (isAromatic) return 'sp2';
    if (totalBondOrder >= 4) return 'sp';
    if (totalBondOrder >= 3) return 'sp2';
    return 'sp3';
  }

  if (symbol === 'P') {
    if (totalBondOrder >= 5) return 'sp';
    if (totalBondOrder >= 4) return 'sp2';
    return 'sp3';
  }

  return 'sp3';
}

// 3. 获取理想键角
function getIdealAngle(hyb: 'sp' | 'sp2' | 'sp3'): number {
  if (hyb === 'sp') return 180;
  if (hyb === 'sp2') return 120;
  return 109.5;
}

const issues: { group: string; atom: string; idx: number; actual: number; ideal: number; deviation: number; hyb: string; neighbors: number }[] = [];

for (const group of FUNCTIONAL_GROUPS) {
  // 1. 计算每个原子的总键序
  const atomBondOrder: Record<number, number> = {};
  for (const atom of group.atoms) {
    let total = 0;
    for (const bond of group.bonds) {
      if (bond.atom1Idx === atom.idx || bond.atom2Idx === atom.idx) {
        total += bond.order;
      }
    }
    atomBondOrder[atom.idx] = total;
  }

  // 2. 计算每个原子的杂化
  const atomHyb: Record<number, 'sp' | 'sp2' | 'sp3'> = {};
  for (const atom of group.atoms) {
    atomHyb[atom.idx] = getHybridization(atom.symbol, atomBondOrder[atom.idx], false);
  }

  // 3. 检查所有重原子的键角（非H原子）
  for (const atom of group.atoms) {
    if (atom.symbol === 'H') continue;

    // 找出该原子的邻居
    const neighbors: number[] = [];
    for (const bond of group.bonds) {
      if (bond.atom1Idx === atom.idx) neighbors.push(bond.atom2Idx);
      if (bond.atom2Idx === atom.idx) neighbors.push(bond.atom1Idx);
    }

    if (neighbors.length < 2) continue;  // 至少2个邻居才能计算键角

    const ideal = getIdealAngle(atomHyb[atom.idx]);
    const tolerance = 5;  // 5度容差

    // 检查所有邻居对的键角
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const n1 = group.atoms.find(a => a.idx === neighbors[i]);
        const n2 = group.atoms.find(a => a.idx === neighbors[j]);
        if (!n1 || !n2) continue;

        const a = angle(n1, atom, n2);
        const dev = Math.abs(a - ideal);

        if (dev > tolerance) {
          issues.push({
            group: group.name,
            atom: atom.symbol,
            idx: atom.idx,
            actual: a,
            ideal: ideal,
            deviation: dev,
            hyb: atomHyb[atom.idx],
            neighbors: neighbors.length
          });
        }
      }
    }
  }
}

console.log(`共发现 ${issues.length} 个键角问题：\n`);

// 按官能团分组
const grouped: Record<string, typeof issues> = {};
for (const issue of issues) {
  if (!grouped[issue.group]) grouped[issue.group] = [];
  grouped[issue.group].push(issue);
}

for (const [group, list] of Object.entries(grouped)) {
  console.log(`\n=== ${group} ===`);
  for (const i of list) {
    console.log(`  ${i.atom}(${i.idx}) [${i.hyb}]: 实际 ${i.actual.toFixed(1)}° 理想 ${i.ideal}° 偏差 ${i.deviation.toFixed(1)}° (${i.neighbors}个邻居)`);
  }
}
