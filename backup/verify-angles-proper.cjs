// 完整验证脚本 - 复制 FUNCTIONAL_GROUPS 常量定义然后验证
const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('./src/utils/functionalGroups.ts', 'utf8');

// 提取BL常量
const bl = {};
const blMatch = content.match(/const BL = \{[\s\S]*?\};/);
const pairs = blMatch[0].matchAll(/(\w+):\s*([\d.]+)/g);
for (const [k, v] of pairs) bl[k] = parseFloat(v);

// 提取 A120, cos120, sin120 等
const a120 = Math.PI * 2 / 3;
const cos120 = Math.cos(a120);
const sin120 = Math.sin(a120);

// 提取 NX, OX, SX, PX
const nx = 1.47, ox = 1.43, sx = 1.82, px = 1.84, cx = 1.54, hx = 1.09;

// 用动态执行提取FUNCTIONAL_GROUPS
// 因为functionalGroups.ts 中有 IIFE 形式的原子（苯基），用 eval 是最简单的

// 抽取从const BL开始的到结尾的代码，去除export
const codeToExec = content
  .replace(/^export\s+/gm, '')
  .replace(/:\s*FunctionalGroup\[\]\s*$/m, '');

// 找到 FUNCTIONAL_GROUPS 数组的结尾
const startIdx = content.indexOf('export const FUNCTIONAL_GROUPS');
const endMarker = '];';
const endIdx = content.indexOf(endMarker, startIdx);

// 构造可执行代码
const execCode = content
  .substring(0, endIdx + endMarker.length)
  .replace(/^export\s+/gm, '');

let FUNCTIONAL_GROUPS;
try {
  // 模拟执行
  const module = { exports: {} };
  const fn = new Function('module', 'exports', execCode + '\nmodule.exports = FUNCTIONAL_GROUPS;');
  fn(module, module.exports);
  FUNCTIONAL_GROUPS = module.exports;
  console.log(`解析到 ${FUNCTIONAL_GROUPS.length} 个官能团\n`);
} catch (e) {
  console.error('Exec error:', e.message);
  process.exit(1);
}

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
for (const g of FUNCTIONAL_GROUPS) {
  const bondOrder = {};
  for (const a of g.atoms) {
    let total = 0;
    for (const b of g.bonds) {
      if (b.atom1Idx === a.idx || b.atom2Idx === a.idx) total += b.order;
    }
    bondOrder[a.idx] = total;
  }

  const hyb = {};
  for (const a of g.atoms) {
    hyb[a.idx] = getHyb(a.symbol, bondOrder[a.idx]);
  }

  for (const a of g.atoms) {
    if (a.symbol === 'H') continue;
    const directions = [];

    for (const b of g.bonds) {
      if (b.atom1Idx === a.idx) {
        const n = g.atoms.find(x => x.idx === b.atom2Idx);
        if (n) directions.push({ pos: n, type: 'internal' });
      }
      if (b.atom2Idx === a.idx) {
        const n = g.atoms.find(x => x.idx === b.atom1Idx);
        if (n) directions.push({ pos: n, type: 'internal' });
      }
    }

    if (g.emptyBonds) {
      for (const eb of g.emptyBonds) {
        if (eb.atomIdx === a.idx) {
          directions.push({
            pos: { x: a.x + eb.position.x, y: a.y + eb.position.y, z: a.z + eb.position.z },
            type: 'empty'
          });
        }
      }
    }

    if (directions.length < 2) continue;
    const t = 5;
    const i = ideal(hyb[a.idx]);

    for (let k = 0; k < directions.length; k++) {
      for (let j = k + 1; j < directions.length; j++) {
        const act = angle(directions[k].pos, a, directions[j].pos);
        const dev = Math.abs(act - i);
        if (dev > t) {
          issues.push({
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

console.log(`发现 ${issues.length} 个键角问题（含空头键方向）：\n`);

const byGroup = {};
for (const i of issues) {
  if (!byGroup[i.id]) byGroup[i.id] = { name: i.group, items: [] };
  byGroup[i.id].items.push(i);
}

for (const [id, info] of Object.entries(byGroup)) {
  console.log(`\n=== ${info.name} (${id}) ===`);
  for (const it of info.items) {
    console.log(`  ${it.atom}(${it.idx}) [${it.hyb}]: ${it.from}-${it.to}: 实际 ${it.actual.toFixed(1)}° 理想 ${it.ideal}° 偏差 ${it.deviation.toFixed(1)}°`);
  }
}
