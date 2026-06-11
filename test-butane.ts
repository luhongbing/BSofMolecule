// 丁烷生成测试脚本
import { parseSmilesToMolecule } from './src/utils/smilesParser.ts';

console.log('=== 丁烷生成测试 ===');

const smiles = 'CCCC';
console.log(`输入 SMILES: ${smiles}`);

try {
  const molecule = parseSmilesToMolecule(smiles);
  
  if (molecule) {
    console.log('\n=== 生成结果 ===');
    console.log(`原子总数: ${molecule.atoms.length}`);
    
    // 打印重原子坐标
    console.log('\n重原子坐标:');
    molecule.atoms
      .filter(a => a.symbol !== 'H')
      .forEach((atom, idx) => {
        console.log(`${atom.symbol}: (${atom.position.x.toFixed(3)}, ${atom.position.y.toFixed(3)}, ${atom.position.z.toFixed(3)})`);
      });
    
    // 计算键角
    console.log('\n=== 键角计算 ===');
    const atoms = molecule.atoms.filter(a => a.symbol !== 'H');
    for (let i = 1; i < atoms.length - 1; i++) {
      const prev = atoms[i - 1].position;
      const curr = atoms[i].position;
      const next = atoms[i + 1].position;
      
      const v1 = {
        x: prev.x - curr.x,
        y: prev.y - curr.y,
        z: prev.z - curr.z
      };
      const v2 = {
        x: next.x - curr.x,
        y: next.y - curr.y,
        z: next.z - curr.z
      };
      
      const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
      const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
      const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
      const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
      
      console.log(`C(${i-1})-C(${i})-C(${i+1}) 键角: ${angle.toFixed(1)}° (预期: 109.5°)`);
    }
    
    // 计算键长
    console.log('\n=== 键长计算 ===');
    for (let i = 0; i < atoms.length - 1; i++) {
      const curr = atoms[i].position;
      const next = atoms[i + 1].position;
      const length = Math.sqrt(
        Math.pow(next.x - curr.x, 2) +
        Math.pow(next.y - curr.y, 2) +
        Math.pow(next.z - curr.z, 2)
      );
      console.log(`C(${i})-C(${i+1}) 键长: ${length.toFixed(2)} Å (预期: 1.54 Å)`);
    }
    
    // 打印H原子数量
    console.log('\n=== H原子统计 ===');
    const hCount = molecule.atoms.filter(a => a.symbol === 'H').length;
    console.log(`H原子总数: ${hCount} (预期: 10)`);
    
    // 打印每个C原子的H原子数
    console.log('\n每个C原子的H原子数:');
    for (let i = 0; i < atoms.length; i++) {
      const cAtom = atoms[i];
      const hConnected = molecule.bonds.filter(
        b => b.atom1Id === cAtom.id || b.atom2Id === cAtom.id
      ).filter(
        b => {
          const otherAtom = molecule.atoms.find(
            a => a.id === (b.atom1Id === cAtom.id ? b.atom2Id : b.atom1Id)
          );
          return otherAtom?.symbol === 'H';
        }
      ).length;
      console.log(`C(${i}): ${hConnected} 个H原子 (${i === 0 || i === atoms.length - 1 ? '预期: 3' : '预期: 2'})`);
    }
  } else {
    console.log('解析失败');
  }
} catch (error) {
  console.error('运行错误:', error);
}