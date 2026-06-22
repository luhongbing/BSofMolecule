/**
 * 稠环碎片结构验证脚本
 * 检查: 1) 原子重叠 2) 键长合理性 3) 结构完整性
 */

const R = 1.40;
const SQRT3 = Math.sqrt(3);

// 辅助函数 - 生成六边形
function generateHexagon(cx, cy, radius) {
  const positions = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 2 - i * Math.PI / 3;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    });
  }
  return positions;
}

// 辅助函数 - 计算两点距离
function distance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

// 辅助函数 - 计算键长
function bondLength(a1, a2) {
  return distance(a1, a2);
}

// ============ 碎片验证函数 ============

function validateNaphthalene() {
  const issues = [];
  const cx1 = -R * SQRT3 / 2;
  const cx2 = cx1 + R * SQRT3;
  const left = generateHexagon(cx1, 0, R);
  const right = generateHexagon(cx2, 0, R);

  // 原子列表
  const atoms = [];
  for (let i = 0; i < 6; i++) atoms.push(left[i]);
  for (let i = 0; i < 4; i++) atoms.push(right[i]);

  // 检查重叠
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i], atoms[j]);
      if (d < 0.5) {
        issues.push(`原子重叠: atom ${i} 和 ${j} 距离 ${d.toFixed(3)}`);
      }
    }
  }

  // 检查键长 (共享边应该是 ~1.40)
  const sharedBond = distance(left[1], right[5]); // 共享边
  if (Math.abs(sharedBond - R) > 0.01) {
    issues.push(`共享边键长异常: ${sharedBond.toFixed(3)} (期望 ${R})`);
  }

  return issues;
}

function validateAnthracene() {
  const issues = [];
  const cx = -R * SQRT3;
  const atoms = [];

  // 3个六边形
  for (let ring = 0; ring < 3; ring++) {
    const ringPos = generateHexagon(cx + ring * R * SQRT3, 0, R);
    if (ring === 0) {
      for (let i = 0; i < 6; i++) atoms.push(ringPos[i]);
    } else {
      // 共享边是 ringPos[5] 和 ringPos[4]
      for (let i = 0; i < 4; i++) atoms.push(ringPos[i]);
    }
  }

  // 检查重叠
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i], atoms[j]);
      if (d < 0.5) {
        issues.push(`原子重叠: atom ${i} 和 ${j} 距离 ${d.toFixed(3)}`);
      }
    }
  }

  return issues;
}

function validatePhenanthrene() {
  const issues = [];
  const cx1 = -R * SQRT3 / 2;
  const cx2 = cx1 + R * SQRT3 / 2;
  const left = generateHexagon(cx1, 0, R);
  const middle = generateHexagon(cx2, R * 1.5, R);

  const atoms = [...left];
  for (let i = 0; i < 5; i++) atoms.push(middle[i]);

  // 检查重叠
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i], atoms[j]);
      if (d < 0.5) {
        issues.push(`原子重叠: atom ${i} 和 ${j} 距离 ${d.toFixed(3)}`);
      }
    }
  }

  // 检查连接
  const bond1 = distance(left[4], middle[5]);
  if (Math.abs(bond1 - R) > 0.01) {
    issues.push(`稠合边键长异常: ${bond1.toFixed(3)}`);
  }

  return issues;
}

function validatePyrene() {
  const issues = [];
  const offset = R * SQRT3 / 2;
  const cy_offset = -offset;
  const atoms = [];

  // ring0
  const ring0 = generateHexagon(-offset, cy_offset, R);
  for (let i = 0; i < 6; i++) atoms.push(ring0[i]);

  // ring1
  const ring1 = generateHexagon(offset, cy_offset, R);
  for (let i = 1; i <= 4; i++) atoms.push(ring1[i]);

  // ring2
  const ring2 = generateHexagon(-offset, -cy_offset, R);
  const ring2AddVerts = [0, 1, 2, 5];
  for (let i = 0; i < ring2AddVerts.length; i++) {
    atoms.push(ring2[ring2AddVerts[i]]);
  }

  // ring3
  const ring3 = generateHexagon(offset, -cy_offset, R);
  for (let i = 1; i <= 2; i++) atoms.push(ring3[i]);

  // 检查重叠
  for (let i = 0; i < atoms.length; i++) {
    for (let j = i + 1; j < atoms.length; j++) {
      const d = distance(atoms[i], atoms[j]);
      if (d < 0.5) {
        issues.push(`原子重叠: atom ${i} 和 ${j} 距离 ${d.toFixed(3)}`);
      }
    }
  }

  return issues;
}

function validateFluorene() {
  const issues = [];
  const cx1 = -R * SQRT3 * 0.75;
  const cx2 = R * SQRT3 * 0.75;
  const left = generateHexagon(cx1, 0, R);
  const right = generateHexagon(cx2, 0, R);

  // 五元环
  const pentCx = 0;
  const pentCy = R * SQRT3 / 4;

  // 生成五边形顶点
  const pent = [];
  for (let i = 0; i < 5; i++) {
    const angle = Math.PI / 2 - i * 2 * Math.PI / 5;
    pent.push({
      x: pentCx + R * 0.8 * Math.cos(angle),
      y: pentCy + R * 0.8 * Math.sin(angle)
    });
  }

  // 检查原子重叠
  const allAtoms = [...left, ...right, pent[0], pent[1], pent[2]];
  for (let i = 0; i < allAtoms.length; i++) {
    for (let j = i + 1; j < allAtoms.length; j++) {
      const d = distance(allAtoms[i], allAtoms[j]);
      if (d < 0.5) {
        issues.push(`原子重叠: atom ${i} 和 ${j} 距离 ${d.toFixed(3)}`);
      }
    }
  }

  // 检查键长
  const bond1 = distance(left[5], pent[0]);
  const bond2 = distance(pent[0], pent[1]);
  const bond3 = distance(pent[1], pent[2]);
  const bond4 = distance(pent[2], right[0]);

  if (Math.abs(bond1 - R) > 0.2) {
    issues.push(`五元环键长异常: left[5]-pent[0] = ${bond1.toFixed(3)}`);
  }
  if (Math.abs(bond4 - R) > 0.2) {
    issues.push(`五元环键长异常: pent[2]-right[0] = ${bond4.toFixed(3)}`);
  }

  return issues;
}

function validateIndole() {
  const issues = [];
  const hexCx = -R * SQRT3 / 2;
  const hex = generateHexagon(hexCx, 0, R);

  // 五边形计算
  const A = hex[3];
  const B = hex[4];
  const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  const outDir = { x: mid.x - hexCx, y: mid.y - 0 };
  const outLen = Math.sqrt(outDir.x ** 2 + outDir.y ** 2);
  outDir.x /= outLen;
  outDir.y /= outLen;

  const apothem = R / (2 * Math.tan(Math.PI / 5));
  const pentCenter = { x: mid.x + outDir.x * apothem, y: mid.y + outDir.y * apothem };
  const circumradius = R / (2 * Math.sin(Math.PI / 5));

  const angleA = Math.atan2(A.y - pentCenter.y, A.x - pentCenter.x);
  const pent = [];
  for (let i = 1; i <= 3; i++) {
    const angle = angleA - i * 2 * Math.PI / 5;
    pent.push({
      x: pentCenter.x + circumradius * Math.cos(angle),
      y: pentCenter.y + circumradius * Math.sin(angle)
    });
  }

  const allAtoms = [...hex, pent[0], pent[1], pent[2]];

  for (let i = 0; i < allAtoms.length; i++) {
    for (let j = i + 1; j < allAtoms.length; j++) {
      const d = distance(allAtoms[i], allAtoms[j]);
      if (d < 0.5) {
        issues.push(`原子重叠: atom ${i} 和 ${j} 距离 ${d.toFixed(3)}`);
      }
    }
  }

  return issues;
}

// 主验证
console.log('='.repeat(60));
console.log('稠环碎片结构验证报告');
console.log('='.repeat(60));
console.log('');

const results = [];

// 验证各碎片
console.log('1. 萘 (Naphthalene) - 10原子');
const naphthaleneIssues = validateNaphthalene();
if (naphthaleneIssues.length === 0) {
  console.log('   ✓ 通过');
} else {
  naphthaleneIssues.forEach(i => console.log('   ✗ ' + i));
}
results.push({ name: '萘', issues: naphthaleneIssues });

console.log('2. 蒽 (Anthracene) - 14原子');
const anthraceneIssues = validateAnthracene();
if (anthraceneIssues.length === 0) {
  console.log('   ✓ 通过');
} else {
  anthraceneIssues.forEach(i => console.log('   ✗ ' + i));
}
results.push({ name: '蒽', issues: anthraceneIssues });

console.log('3. 菲 (Phenanthrene) - 11原子');
const phenanthreneIssues = validatePhenanthrene();
if (phenanthreneIssues.length === 0) {
  console.log('   ✓ 通过');
} else {
  phenanthreneIssues.forEach(i => console.log('   ✗ ' + i));
}
results.push({ name: '菲', issues: phenanthreneIssues });

console.log('4. 芘 (Pyrene) - 16原子');
const pyreneIssues = validatePyrene();
if (pyreneIssues.length === 0) {
  console.log('   ✓ 通过');
} else {
  pyreneIssues.forEach(i => console.log('   ✗ ' + i));
}
results.push({ name: '芘', issues: pyreneIssues });

console.log('5. 芴 (Fluorene) - 13原子');
const fluoreneIssues = validateFluorene();
if (fluoreneIssues.length === 0) {
  console.log('   ✓ 通过');
} else {
  fluoreneIssues.forEach(i => console.log('   ✗ ' + i));
}
results.push({ name: '芴', issues: fluoreneIssues });

console.log('6. 吲哚 (Indole) - 9原子');
const indoleIssues = validateIndole();
if (indoleIssues.length === 0) {
  console.log('   ✓ 通过');
} else {
  indoleIssues.forEach(i => console.log('   ✗ ' + i));
}
results.push({ name: '吲哚', issues: indoleIssues });

console.log('');
console.log('='.repeat(60));
console.log('验证完成');
console.log('='.repeat(60));
