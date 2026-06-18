const { FUNCTIONAL_GROUPS } = require('./fg-bundle.cjs');

function angle(p1, c, p2) {
  const v1 = { x: p1.x - c.x, y: p1.y - c.y, z: (p1.z||0) - (c.z||0) };
  const v2 = { x: p2.x - c.x, y: p2.y - c.y, z: (p2.z||0) - (c.z||0) };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const l1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y + v1.z*v1.z);
  const l2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y + v2.z*v2.z);
  if (l1 < 0.0001 || l2 < 0.0001) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (l1 * l2)))) * 180 / Math.PI;
}

function getHyb(symbol, totalBondOrder, neighborCount, hasTripleBond, hasDoubleBond, doubleBondCount) {
  // 有三键 → sp
  if (hasTripleBond) return 'sp';
  // O: 1个邻居 + 双键（C=O的O）→ sp2；否则 sp3
  if (symbol === 'O') {
    if (neighborCount === 1 && hasDoubleBond) return 'sp2';
    return 'sp3';
  }
  // S: 2个邻居 + 双键（如S=O）→ sp2；3或4邻居 → sp3
  if (symbol === 'S') {
    if (neighborCount === 2 && hasDoubleBond) return 'sp2';
    return 'sp3';
  }
  // 2个邻居：2个双键（如N=C=O累积双键）→ sp 直线；1个双键（如苯基）→ sp2 120°；0个双键 → sp
  if (neighborCount === 2) {
    if (doubleBondCount === 2) return 'sp';
    if (hasDoubleBond) return 'sp2';
    return 'sp';
  }
  // 3个邻居 → sp2
  if (neighborCount === 3) return 'sp2';
  // 4个邻居 → sp3
  if (neighborCount === 4) return 'sp3';
  return 'sp3';
}

function ideal(hyb) {
  if (hyb === 'sp') return 180;
  if (hyb === 'sp2') return 120;
  return 109.5;
}

console.log('Found ' + FUNCTIONAL_GROUPS.length + ' groups\n');

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
    let hasTriple = false;
    let doubleBondCount = 0;

    for (const b of g.bonds) {
      if (b.atom1Idx === a.idx) {
        const n = g.atoms.find(x => x.idx === b.atom2Idx);
        if (n) directions.push({ pos: n, type: 'internal' });
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
      if (b.atom2Idx === a.idx) {
        const n = g.atoms.find(x => x.idx === b.atom1Idx);
        if (n) directions.push({ pos: n, type: 'internal' });
        if (b.order === 3) hasTriple = true;
        if (b.order === 2) doubleBondCount++;
      }
    }

    if (g.emptyBonds) {
      for (const eb of g.emptyBonds) {
        if (eb.atomIdx === a.idx) {
          // eb.position 是相对 basePos 的世界偏移，v2 应是 eb.position - a（从a看的方向）
          directions.push({
            pos: { x: eb.position.x, y: eb.position.y, z: (eb.position.z||0) },
            type: 'empty'
          });
          if (eb.order === 3) hasTriple = true;
          if (eb.order === 2) doubleBondCount++;
        }
      }
    }

    if (directions.length < 2) continue;
    const t = 5;
    const hasDouble = doubleBondCount > 0;
    const i = ideal(getHyb(a.symbol, 0, directions.length, hasTriple, hasDouble, doubleBondCount));

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
            hyb: getHyb(a.symbol, 0, directions.length, hasTriple, hasDouble, doubleBondCount)
          });
        }
      }
    }
  }
}

console.log('Found ' + issues.length + ' angle issues (with empty bonds):\n');

const byGroup = {};
for (const i of issues) {
  if (!byGroup[i.id]) byGroup[i.id] = { name: i.group, items: [] };
  byGroup[i.id].items.push(i);
}

for (const [id, info] of Object.entries(byGroup)) {
  console.log('\n=== ' + info.name + ' (' + id + ') ===');
  for (const it of info.items) {
    console.log('  ' + it.atom + '(' + it.idx + ') [' + it.hyb + ']: ' + it.from + '-' + it.to + ': actual ' + it.actual.toFixed(1) + ' ideal ' + it.ideal + ' dev ' + it.deviation.toFixed(1));
  }
}
