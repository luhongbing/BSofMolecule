import { parseSmilesToMolecule } from './src/utils/smilesParser';

console.log('开始测试苯环解析...');
const smiles = 'c1ccccc1';
console.log(`输入的SMILES: ${smiles}`);

const molecule = parseSmilesToMolecule(smiles);

if (molecule) {
  console.log('\n解析成功！');
  console.log(`原子总数: ${molecule.atoms.length}`);
  
  const carbonAtoms = molecule.atoms.filter(a => a.symbol === 'C');
  const hydrogenAtoms = molecule.atoms.filter(a => a.symbol === 'H');
  
  console.log(`碳原子数: ${carbonAtoms.length}`);
  console.log(`氢原子数: ${hydrogenAtoms.length}`);
  console.log(`分子式: ${molecule.formula}`);
  
  console.log('\n原子详情:');
  molecule.atoms.forEach(atom => {
    console.log(`  ${atom.symbol} (id: ${atom.id})`);
  });
} else {
  console.error('解析失败！');
}
