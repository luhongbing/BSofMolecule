const { FUNCTIONAL_GROUPS } = require('/tmp/fg-bundle.cjs');

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
            pos: { x: a.x + eb.position.x, y: a.y + eb.position.y, z: a.z + (eb.position.z || 0) },
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
