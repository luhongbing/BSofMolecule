import { parseSmiles } from './src/utils/smilesParser';

const smiles = 'CCCCc1nc(Cl)c(CO)n1Cc2ccc(-c3ccccc3-c4nnnn4[K])cc2';

console.log('Testing SMILES:', smiles);
console.log('Length:', smiles.length);
console.log('');

try {
  const result = parseSmiles(smiles);
  console.log('✓ Parse succeeded');
  console.log('Atoms:', result.atoms.length);
  console.log('Bonds:', result.bonds.length);
  console.log('');
  console.log('Atom details:');
  result.atoms.forEach((a, i) => {
    console.log(`  ${i}: ${a.symbol} (aromatic: ${a.aromatic})`);
  });
  console.log('');
  console.log('Bond details:');
  result.bonds.forEach((b, i) => {
    console.log(`  ${i}: ${b.a1} - ${b.a2} (order: ${b.order})`);
  });
} catch (e) {
  console.error('✗ Parse failed');
  console.error('Error:', e);
  console.error('Stack:', (e as Error).stack);
}
