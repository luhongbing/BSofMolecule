// 验证空头键方向是否合理
const fs = require('fs');
const content = fs.readFileSync('./src/utils/functionalGroups.ts', 'utf8');

// 解析BL常量
const bl = {};
const blMatch = content.match(/const BL = \{[\s\S]*?\};/);
if (blMatch) {
  const pairs = blMatch[0].matchAll(/(\w+):\s*([\d.]+)/g);
  for (const [k, v] of pairs) {
    bl[k] = parseFloat(v);
  }
}

// 解析所有官能团
const groupBlocks = content.matchAll(/id: '([^']+)',[\s\S]*?connectionPoint: \d+,?\s*\}/g);
const groups = [];
for (const m of groupBlocks) {
  const block = m[0];

  // 解析单行原子
  const atoms = [];
  // 支持表达式求值
  const safeEval = (expr) => {
    const cleaned = expr
      .replace(/BL\.(\w+)/g, (m, p1) => 'bl.' + p1)
      .replace(/cos120/g, '-0.5')
      .replace(/sin120/g, '0.8660254037844387')
      .replace(/cos109/g, '0.3333333333333333')
      .replace(/sin109/g, '0.9428090415820634')
      .replace(/\bNX\b/g, '1.47')
      .replace(/\bOX\b/g, '1.43')
      .replace(/\bSX\b/g, '1.82')
      .replace(/\bPX\b/g, '1.84')
      .replace(/\bCX\b/g, '1.54')
      .replace(/\bHX\b/g, '1.09');
    try { return eval(cleaned); } catch (e) { return 0; }
  };

  // 移除块内所有注释
  const blockClean = block.replace(/\/\/.*$/gm, '');
  const singleAtomRe = /\{\s*idx:\s*(\d+),\s*symbol:\s*'(\w+)',\s*x:\s*([^,]+),\s*y:\s*([^,]+),\s*z:\s*([^}]+?)\s*,?\s*\}/g;
  let m2;
  while ((m2 = singleAtomRe.exec(blockClean)) !== null) {
    atoms.push({
      idx: parseInt(m2[1]),
      symbol: m2[2],
      x: safeEval(m2[3]),
      y: safeEval(m2[4]),
      z: safeEval(m2[5])
    });
  }

  // 苯基的特殊处理
  if (atoms.length === 0) {
    const funcMatch = block.match(/atoms:\s*\(\(\)\s*=>\s*\{([\s\S]*?)\}\)\(\)/);
    if (funcMatch) {
      const rMatch = funcMatch[1].match(/const\s+r\s*=\s*([\d.]+)/);
      const r = rMatch ? parseFloat(rMatch[1]) : 1.40;

      // push连接点
      atoms.push({ idx: 0, symbol: 'C', x: 0, y: 0, z: 0 });
      // push循环的原子
      for (let i = 1; i <= 5; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI * 2) / 6;
        atoms.push({
          idx: i,
          symbol: 'C',
          x: parseFloat((r * Math.sin(angle)).toFixed(4)),
          y: parseFloat((-r * (1 - Math.cos(angle))).toFixed(4)),
          z: 0
        });
      }
    }
  }

  // 解析bonds
  const bonds = [];
  const bondsMatch = block.match(/bonds:\s*\[([\s\S]*?)\]/);
  if (bondsMatch) {
    const bondRe = /\{\s*atom1Idx:\s*(\d+),\s*atom2Idx:\s*(\d+),\s*order:\s*(\d+)\s*\}/g;
    while ((m2 = bondRe.exec(bondsMatch[1])) !== null) {
      bonds.push({
        atom1Idx: parseInt(m2[1]),
        atom2Idx: parseInt(m2[2]),
        order: parseInt(m2[3])
      });
    }
  }

  // 解析空头键
  const emptyBonds = [];
  const ebMatch = blockClean.match(/emptyBonds:\s*\[([\s\S]*?)\]/);
  if (ebMatch) {
    const ebRe = /\{\s*atomIdx:\s*(\d+),\s*order:\s*(\d+),\s*position:\s*\{\s*x:\s*([^,}]+),\s*y:\s*([^,}]+),\s*z:\s*([^}]+)\s*\}\s*\}/g;
    while ((m2 = ebRe.exec(ebMatch[1])) !== null) {
      emptyBonds.push({
        atomIdx: parseInt(m2[1]),
        order: parseInt(m2[2]),
        position: {
          x: safeEval(m2[3]),
          y: safeEval(m2[4]),
          z: safeEval(m2[5])
        }
      });
    }
  }

  const nameMatch = block.match(/name:\s*'([^']+)'/);
  const idMatch = block.match(/id:\s*'([^']+)'/);

  if (atoms.length > 0) {
    groups.push({ id: idMatch[1], name: nameMatch[1], atoms, bonds, emptyBonds });
  }
}

console.log(`解析到 ${groups.length} 个官能团\n`);

function angle(p1, c, p2) {
  const v1 = { x: p1.x - c.x, y: p1.y - c.y, z: p1.z - c.z };
  const v2 = { x: p2.x - c.x, y: p2.y - c.y, z: p2.z - c.z };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const l1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y + v1.z*v1.z);
  const l2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y + v2.z*v2.z);
  if (l1 < 0.0001 || l2 < 0.0001) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (l1 * l2)))) * 180 / Math.PI;
}

function getHyb(symbol, totalBondOrder) {
  if (symbol === 'H') return 'sp3';
  if (symbol === 'O' || symbol === 'S') return totalBondOrder >= 2 ? 'sp2' : 'sp3';
  if (symbol === 'N') {
    if (totalBondOrder >= 3) return 'sp';
    if (totalBondOrder >= 2) return 'sp2';
    return 'sp3';
  }
  if (symbol === 'C') {
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

function ideal(hyb) {
  if (hyb === 'sp') return 180;
  if (hyb === 'sp2') return 120;
  return 109.5;
}

const allIssues = [];

for (const g of groups) {
  // 计算每个原子的总键序（不含空头键，连接外部）
  const bondOrder = {};
  for (const a of g.atoms) {
    let total = 0;
    for (const b of g.bonds) {
      if (b.atom1Idx === a.idx || b.atom2Idx === a.idx) total += b.order;
    }
    bondOrder[a.idx] = total;
  }

  // 计算杂化
  const hyb = {};
  for (const a of g.atoms) {
    hyb[a.idx] = getHyb(a.symbol, bondOrder[a.idx]);
  }

  // 检查每个原子的所有键角（包括空头键方向）
  for (const a of g.atoms) {
    if (a.symbol === 'H') continue;

    // 收集所有键方向（含空头键）
    const directions = [];

    // 内部键方向
    for (const b of g.bonds) {
      if (b.atom1Idx === a.idx) {
        const n = g.atoms.find(x => x.idx === b.atom2Idx);
        if (n) directions.push({ pos: n, order: b.order, type: 'internal' });
      }
      if (b.atom2Idx === a.idx) {
        const n = g.atoms.find(x => x.idx === b.atom1Idx);
        if (n) directions.push({ pos: n, order: b.order, type: 'internal' });
      }
    }

    // 空头键方向
    for (const eb of g.emptyBonds) {
      if (eb.atomIdx === a.idx) {
        directions.push({ pos: eb.position, order: eb.order, type: 'empty' });
      }
    }

    if (directions.length < 2) continue;

    const t = 5;
    const i = ideal(hyb[a.idx]);

    // 检查所有方向对的键角
    for (let k = 0; k < directions.length; k++) {
      for (let j = k + 1; j < directions.length; j++) {
        const act = angle(directions[k].pos, a, directions[j].pos);
        const dev = Math.abs(act - i);
        if (dev > t) {
          allIssues.push({
            group: g.name,
            id: g.id,
            atom: a.symbol,
            idx: a.idx,
            from: directions[k].type,
            to: directions[j].type,
            actual: act,
            ideal: i,
            deviation: dev,
            hyb: hyb[a.idx]
          });
        }
      }
    }
  }
}

console.log(`\n发现 ${allIssues.length} 个键角问题（含空头键方向）：\n`);

const byGroup = {};
for (const i of allIssues) {
  if (!byGroup[i.id]) byGroup[i.id] = { name: i.group, items: [] };
  byGroup[i.id].items.push(i);
}

for (const [id, info] of Object.entries(byGroup)) {
  console.log(`\n=== ${info.name} (${id}) ===`);
  for (const i of info.items) {
    console.log(`  ${i.atom}(${i.idx}) [${i.hyb}]: ${i.from}-${i.to}: 实际 ${i.actual.toFixed(1)}° 理想 ${i.ideal}° 偏差 ${i.deviation.toFixed(1)}°`);
  }
}
