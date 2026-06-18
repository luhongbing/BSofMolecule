/**
 * 验证所有官能团的键角和化合价约束
 */

import { FUNCTIONAL_GROUPS, FunctionalGroup } from './src/utils/functionalGroups';
import { getValences } from './src/utils/elements';

// 键角计算
function calculateAngle(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  if (len1 < 0.0001 || len2 < 0.0001) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return Math.acos(cosAngle) * 180 / Math.PI;
}

function getAtomValence(symbol: string): number {
  const valences = getValences(symbol);
  return valences[0] || 4;
}

console.log('=== 官能团键角和化合价验证 ===\n');

const issues: string[] = [];

for (const group of FUNCTIONAL_GROUPS) {
  console.log(`\n--- ${group.name} (${group.formula}) ---`);

  // 1. 计算每个原子的当前化合价（键序总和）
  const atomValences: Record<number, { symbol: string, current: number, max: number }> = {};
  for (const atom of group.atoms) {
    let currentBondOrder = 0;
    for (const bond of group.bonds) {
      if (bond.atom1Idx === atom.idx || bond.atom2Idx === atom.idx) {
        currentBondOrder += bond.order;
      }
    }
    const maxValence = getAtomValence(atom.symbol);
    atomValences[atom.idx] = { symbol: atom.symbol, current: currentBondOrder, max: maxValence };

    // 检查化合价
    if (currentBondOrder > maxValence) {
      issues.push(`[${group.name}] ${atom.symbol}(${atom.idx}) 键序${currentBondOrder}超过化合价${maxValence}`);
    }
  }

  // 2. 检查每个原子的键角
  for (const atom of group.atoms) {
    const neighbors: number[] = [];
    for (const bond of group.bonds) {
      if (bond.atom1Idx === atom.idx) neighbors.push(bond.atom2Idx);
      if (bond.atom2Idx === atom.idx) neighbors.push(bond.atom1Idx);
    }

    // 检查键角
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const n1 = group.atoms.find(a => a.idx === neighbors[i]);
        const n2 = group.atoms.find(a => a.idx === neighbors[j]);
        if (!n1 || !n2) continue;

        const angle = calculateAngle(
          { x: n1.x, y: n1.y },
          { x: atom.x, y: atom.y },
          { x: n2.x, y: n2.y }
        );

        // 根据杂化类型确定理想键角
        let idealAngle = 109.5;
        if (atomValences[atom.idx].current === 4) idealAngle = 109.5;
        else if (atomValences[atom.idx].current === 3) idealAngle = 120;
        else if (atomValences[atom.idx].current === 2) idealAngle = 120;
        else if (atomValences[atom.idx].current === 1) idealAngle = 109.5;

        // sp杂化特殊处理
        const spHybrid = neighbors.length === 2 && atomValences[atom.idx].current >= 3;
        if (spHybrid) idealAngle = 180;

        const deviation = Math.abs(angle - idealAngle);
        if (deviation > 10) {
          issues.push(`[${group.name}] ${atom.symbol}(${atom.idx}) 的键角 ${angle.toFixed(1)}° 偏离理想值 ${idealAngle}° (偏差${deviation.toFixed(1)}°)`);
        }
      }
    }
  }

  // 3. 打印化合价状态
  for (const [idx, info] of Object.entries(atomValences)) {
    const status = info.current >= info.max ? '✓' : `⚠ 缺${info.max - info.current}`;
    console.log(`  ${info.symbol}(${idx}): 键序${info.current}/${info.max} ${status}`);
  }
}

console.log('\n\n=== 问题汇总 ===');
if (issues.length === 0) {
  console.log('没有发现键角或化合价问题!');
} else {
  issues.forEach(issue => console.log(issue));
}
