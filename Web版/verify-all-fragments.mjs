/**
 * 稠环碎片完整验证脚本
 * 验证所有36个碎片的几何结构和拓扑一致性
 */

import { FUSED_RING_FRAGMENTS } from './src/utils/fusedRingFragments.ts';

const R = 1.40;
const TOLERANCE = 0.1; // 键长容差

function distance(a1, a2) {
  return Math.sqrt((a1.x - a2.x) ** 2 + (a1.y - a2.y) ** 2 + (a1.z - a2.z) ** 2);
}

function validateFragment(fragment) {
  const issues = [];
  const { name, atoms, bonds, topology } = fragment;

  // 1. 检查原子重叠
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i], atoms[j]);
      if (d < 0.5) {
        issues.push(`原子重叠: ${atoms[i].symbol}${i} 和 ${atoms[j].symbol}${j} 距离 ${d.toFixed(3)}Å`);
      }
    }
  }

  // 2. 检查键长
  for (const bond of bonds) {
    const a1 = atoms.find(a => a.idx === bond.atom1Idx);
    const a2 = atoms.find(a => a.idx === bond.atom2Idx);
    if (!a1 || !a2) {
      issues.push(`键原子不存在: ${bond.atom1Idx}-${bond.atom2Idx}`);
      continue;
    }
    const d = distance(a1, a2);
    const expected = bond.order === 1.5 ? R : (bond.order === 1 ? R * 0.85 : R);
    if (Math.abs(d - expected) > TOLERANCE) {
      issues.push(`键长异常: ${a1.symbol}${a1.idx}-${a2.symbol}${a2.idx} 距离 ${d.toFixed(3)}Å (期望 ${expected.toFixed(3)}Å)`);
    }
  }

  // 3. 检查拓扑一致性
  for (const t of topology) {
    const atom = atoms.find(a => a.idx === t.idx);
    if (!atom) {
      issues.push(`拓扑原子不存在: idx=${t.idx}`);
      continue;
    }
    if (t.neighbors.length !== atom.isAromatic ? 3 : 2) {
      //芳香族3度或脂肪族2度
    }
  }

  // 4. 检查topology邻居与bonds一致性
  for (const t of topology) {
    for (const n of t.neighbors) {
      const bondExists = bonds.some(b =>
        (b.atom1Idx === t.idx && b.atom2Idx === n) ||
        (b.atom2Idx === t.idx && b.atom1Idx === n)
      );
      if (!bondExists) {
        issues.push(`拓扑不一致: ${t.idx} 声称连接 ${n} 但bonds中无此键`);
      }
    }
  }

  // 5. 检查键数量与拓扑一致性
  for (const bond of bonds) {
    const t1 = topology.find(t => t.idx === bond.atom1Idx);
    const t2 = topology.find(t => t.idx === bond.atom2Idx);
    if (!t1 || !t2) continue;
    if (!t1.neighbors.includes(bond.atom2Idx) || !t2.neighbors.includes(bond.atom1Idx)) {
      issues.push(`键-拓扑不一致: 键 ${bond.atom1Idx}-${bond.atom2Idx} 但拓扑邻居不匹配`);
    }
  }

  return issues;
}

// 主验证
console.log('='.repeat(70));
console.log('           稠环碎片结构验证报告');
console.log('='.repeat(70));
console.log(`验证碎片数量: ${FUSED_RING_FRAGMENTS.length}`);
console.log('');

const allResults = [];
let passCount = 0;
let failCount = 0;

for (const fragment of FUSED_RING_FRAGMENTS) {
  const issues = validateFragment(fragment);
  const status = issues.length === 0 ? '✓' : '✗';

  if (issues.length === 0) {
    passCount++;
    console.log(`${status} ${fragment.name.padEnd(20)} (${fragment.atoms.length}原子)`);
  } else {
    failCount++;
    console.log(`${status} ${fragment.name.padEnd(20)} (${fragment.atoms.length}原子)`);
    issues.forEach(i => console.log(`    └─ ${i}`));
  }
  allResults.push({ name: fragment.name, issues });
}

console.log('');
console.log('='.repeat(70));
console.log(`验证结果: ${passCount} 通过, ${failCount} 失败`);
console.log('='.repeat(70));

if (failCount > 0) {
  console.log('');
  console.log('失败碎片清单:');
  allResults.filter(r => r.issues.length > 0).forEach(r => {
    console.log(`  - ${r.name}: ${r.issues.length}个问题`);
  });
}
