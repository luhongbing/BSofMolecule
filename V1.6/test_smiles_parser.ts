
import { parseSmilesToMolecule } from './src/utils/smilesParser';
import { parseSmiles } from './src/utils/smilesParser';

const testSmiles = 'CCCCc1nc(Cl)c(CO)n1Cc2ccc(-c3ccccc3-c4nnnn4[K])cc2';

console.log('Testing SMILES:', testSmiles);
console.log();

try {
  const { atoms, bonds } = parseSmiles(testSmiles);
  console.log('Parsed atoms:', atoms.map(a =&gt; ({ symbol: a.symbol, aromatic: a.aromatic, charge: a.charge })));
  console.log();
  console.log('Parsed bonds:', bonds);
  console.log();
  console.log('Token count:', atoms.length + bonds.length);

  const molecule = parseSmilesToMolecule(testSmiles);
  console.log();
  console.log('Molecule created:', molecule ? 'success' : 'null');
  if (molecule) {
    console.log('Molecule atoms:', molecule.atoms.length);
    console.log('Molecule bonds:', molecule.bonds.length);
  }
} catch (e) {
  console.error('Error:', e);
  console.error('Stack:', (e as Error).stack);
}
