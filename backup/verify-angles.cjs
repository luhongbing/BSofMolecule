// 直接读取functionalGroups.ts的内容并解析
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
console.log('BL keys:', Object.keys(bl).length);

// 解析所有官能团（用正则）
const groupBlocks = content.matchAll(/id: '([^']+)',[\s\S]*?connectionPoint: \d+,?\s*\}/g);
const groups = [];
for (const m of groupBlocks) {
  const block = m[0];
  // 提取atoms
  const atomsMatch = block.match(/atoms: (\[[\s\S]*?^\s*\],|atoms: \(\(\) => \{[\s\S]*?\}\)\(\));/m);
  // 提取bonds
  const bondsMatch = block.match(/bonds:\s*\[([\s\S]*?)\],/);
  if (!bondsMatch) continue;

  // 提取每个原子的 { idx, symbol, x, y, z }
  const atoms = [];
  // 匹配单行原子定义
  const singleAtomRe = /\{\s*idx:\s*(\d+),\s*symbol:\s*'(\w+)',\s*x:\s*([-\d.]+),\s*y:\s*([-\d.]+),\s*z:\s*([-\d.]+)\s*\}/g;
  let m2;
  while ((m2 = singleAtomRe.exec(block)) !== null) {
    atoms.push({
      idx: parseInt(m2[1]),
      symbol: m2[2],
      x: parseFloat(m2[3]),
      y: parseFloat(m2[4]),
      z: parseFloat(m2[5])
    });
  }

  // 匹配箭头函数形式的atoms
  if (atoms.length === 0) {
    const funcMatch = block.match(/atoms:\s*\(\(\)\s*=>\s*\{([\s\S]*?)\}\)\(\)/);
    if (funcMatch) {
      // 从 r 变量推断键长
      const rMatch = funcMatch[1].match(/const\s+r\s*=\s*([\d.]+)/);
      const r = rMatch ? parseFloat(rMatch[1]) : 1.40;

      // 解析 push 的原子
      const pushRe = /atoms\.push\(\{\s*idx:\s*(\d+),\s*symbol:\s*'(\w+)',\s*x:\s*([-\d.eE]+),\s*y:\s*([-\d.eE]+),\s*z:\s*([-\d.eE]+)\s*\}\)/g;
      while ((m2 = pushRe.exec(funcMatch[1])) !== null) {
        atoms.push({
          idx: parseInt(m2[1]),
          symbol: m2[2],
          x: parseFloat(m2[3]),
          y: parseFloat(m2[4]),
          z: parseFloat(m2[5])
        });
      }

      // 解析循环中的原子
      const loopRe = /for\s*\(let\s+i\s*=\s*1;\s*i\s*<=\s*5;\s*i\+\+\)\s*\{([\s\S]*?)\}/;
      const loopMatch = funcMatch[1].match(loopRe);
      if (loopMatch) {
        const angleRe = /const\s+angle\s*=\s*([-\d.eE+\s*\/()]+);/;
        const am = loopMatch[1].match(angleRe);
        if (am) {
          // 解析 -Math.PI / 2 + (i * Math.PI * 2) / 6
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
    }
  }

  // 解析bonds
  const bonds = [];
  const bondRe = /\{\s*atom1Idx:\s*(\d+),\s*atom2Idx:\s*(\d+),\s*order:\s*(\d+)\s*\}/g;
  while ((m2 = bondRe.exec(bondsMatch[1])) !== null) {
    bonds.push({
      atom1Idx: parseInt(m2[1]),
      atom2Idx: parseInt(m2[2]),
      order: parseInt(m2[3])
    });
  }

  // 提取 group name
  const nameMatch = block.match(/name:\s*'([^']+)'/);
  const idMatch = block.match(/id:\s*'([^']+)'/);

  if (atoms.length > 0) {
    groups.push({ id: idMatch[1], name: nameMatch[1], atoms, bonds });
  }
}

console.log(`\n解析到 ${groups.length} 个官能团\n`);

// 键角计算
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

const issues = [];
for (const g of groups) {
  // 计算每个原子的总键序
  const bondOrder = {};
  for (const a of g.atoms) {
    let total = 0;
    for (const b of g.bonds) {
      if (b.atom1Idx === a.idx || b.atom2Idx === a.idx) total += b.order;
    }
    bondOrder[a.idx] = total;
  }

  // 计算每个原子的杂化
  const hyb = {};
  for (const a of g.atoms) {
    hyb[a.idx] = getHyb(a.symbol, bondOrder[a.idx]);
  }

  // 检查重原子的键角
  for (const a of g.atoms) {
    if (a.symbol === 'H') continue;

    const neighbors = [];
    for (const b of g.bonds) {
      if (b.atom1Idx === a.idx) neighbors.push(b.atom2Idx);
      if (b.atom2Idx === a.idx) neighbors.push(b.atom1Idx);
    }
    if (neighbors.length < 2) continue;

    const t = 5;
    const i = ideal(hyb[a.idx]);

    for (let k = 0; k < neighbors.length; k++) {
      for (let j = k + 1; j < neighbors.length; j++) {
        const n1 = g.atoms.find(x => x.idx === neighbors[k]);
        const n2 = g.atoms.find(x => x.idx === neighbors[j]);
        if (!n1 || !n2) continue;

        const act = angle(n1, a, n2);
        const dev = Math.abs(act - i);
        if (dev > t) {
          issues.push({
            group: g.name,
            id: g.id,
            atom: a.symbol,
            idx: a.idx,
            actual: act,
            ideal: i,
            deviation: dev,
            hyb: hyb[a.idx],
            nb: neighbors.length
          });
        }
      }
    }
  }
}

console.log(`发现 ${issues.length} 个键角问题：\n`);

// 按官能团分组
const byGroup = {};
for (const i of issues) {
  if (!byGroup[i.id]) byGroup[i.id] = { name: i.group, items: [] };
  byGroup[i.id].items.push(i);
}

for (const [id, info] of Object.entries(byGroup)) {
  console.log(`\n=== ${info.name} (${id}) ===`);
  for (const i of info.items) {
    console.log(`  ${i.atom}(${i.idx}) [${i.hyb}]: 实际 ${i.actual.toFixed(1)}° 理想 ${i.ideal}° 偏差 ${i.deviation.toFixed(1)}° (${i.nb}个邻居)`);
  }
}
