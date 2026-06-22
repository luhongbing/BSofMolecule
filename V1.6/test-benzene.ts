
import { parseSmilesToMolecule } from './src/utils/smilesParser';

console.log('=== 测试苯解析 ===');
const smiles = 'c1ccccc1';
console.log(`输入: ${smiles}`);

try {
  const molecule = parseSmilesToMolecule(smiles);
  
  if (molecule) {
    console.log('✅ 解析成功');
    console.log(`原子数量: ${molecule.atoms.length}`);
    
    const carbons = molecule.atoms.filter(a => a.symbol === 'C');
    const hydrogens = molecule.atoms.filter(a => a.symbol === 'H');
    console.log(`C: ${carbons.length}, H: ${hydrogens.length}`);
    console.log(`分子式: ${molecule.formula}`);
    
    console.log('\n=== 原子详情 ===');
    molecule.atoms.forEach((atom, i) => {
      console.log(`${i}: ${atom.symbol} (id: ${atom.id}, pos: (${atom.position.x.toFixed(2)}, ${atom.position.y.toFixed(2)}, ${atom.position.z.toFixed(2)}))`);
    });
    
    console.log('\n=== 键详情 ===');
    molecule.bonds.forEach((bond, i) => {
      console.log(`${i}: ${bond.atom1Id} <-> ${bond.atom2Id} (order: ${bond.order})`);
    });
  } else {
    console.error('❌ 解析失败');
  }
} catch (error) {
  console.error('💥 错误:', error);
  console.error('堆栈:', (error as Error).stack);
}
