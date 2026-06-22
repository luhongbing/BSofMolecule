const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/Canvas3D.tsx');

console.log('Reading file:', filePath);

let content = fs.readFileSync(filePath, 'utf8');

// 找到我们要替换的那一部分内容
const oldText = `            // 如果这个甲基的3个H被选中，允许旋转（无论C是否被选中）
            if (methylHSelected) {
              // 找到旋转轴的另一端（甲基连接的另一个碳）
              const rotNeighborId = group.cId;
              const rotNeighbor = stateRef.current.molecule.atoms.find(a => a.id === rotNeighborId);
              
              if (rotNeighbor) {
                console.log('[identifyConstrainedGroup] METHYL ROTATION SUCCESS:');
                console.log('[identifyConstrainedGroup] - methylC:', rotNeighbor.symbol, rotNeighborId);
                
                // 找到这个甲基连接的另一个碳（旋转轴的另一端）
                const cBonds = stateRef.current.molecule.bonds.filter(
                  b => (b.atom1Id === rotNeighborId || b.atom2Id === rotNeighborId) && 
                       b.order === 1 // 单键
                );
                
                let fixedAtomId: string | null = null;
                for (const bond of cBonds) {
                  const neighborId = bond.atom1Id === rotNeighborId ? bond.atom2Id : bond.atom1Id;
                  const neighbor = stateRef.current.molecule.atoms.find(a => a.id === neighborId);
                  // 找到另一个碳（不是甲基碳的那个）
                  if (neighbor && neighbor.symbol === 'C' && neighborId !== group.cId) {
                    fixedAtomId = neighborId;
                    break;
                  }
                }
                
                if (fixedAtomId) {
                  const fixedAtom = stateRef.current.molecule.atoms.find(a => a.id === fixedAtomId);
                  const rotationAxis = new THREE.Vector3(
                    rotNeighbor.position.x - fixedAtom!.position.x,
                    rotNeighbor.position.y - fixedAtom!.position.y,
                    rotNeighbor.position.z - fixedAtom!.position.z
                  ).normalize();
                  
                  // 旋转甲基C和它的3个H
                  const rotateAtoms = [rotNeighborId, ...group.hIds];
                  console.log('[identifyConstrainedGroup] METHYL ROTATION: rotateAtoms =', rotateAtoms, 'fixedAtomId =', fixedAtomId);
                  return {
                    atoms: rotateAtoms,
                    fixedAtomId: fixedAtomId,
                    rotationAxis,
                    rotationCenterId: fixedAtomId,
                    noRotation: false
                  };
                }`;

// 等等，我需要先打印一下我们要找的部分，我们更简单，我先查找并打印一段
// 让我打印一下真实存在的内容先

// 我们还是先查找具体内容，让我打印中间的一小段，比如用正则来替换吧，我先检查是否有这些内容。

console.log('Looking for lines with "methylHSelected = group.hIds.every"');

// 我们换个更简单的方式，直接用grep来找这段，或者换一种更通用的方式，我们直接用替换
const regex1 = /const methylHSelected = group\.hIds\.every\(hId => selectedHAtoms\.includes\(hId\)\);\s*console\.log\(\'\[identifyConstrainedGroup\] Checking methyl group:', group, 'methylHSelected:', methylHSelected\);\s*\/\/ 如果这个甲基的3个H被选中，允许旋转（无论C是否被选中）\s*if \(methylHSelected\) \{/;

// 或者更简单的方法，我用一个简化的正则，找 "methylHSelected = group.hIds.every"
console.log('Found regex test 1:', /methylHSelected = group\.hIds\.every/.test(content));
console.log('Found regex test 2:', /Checking methyl group:/.test(content));

// 我直接先打印那部分内容让我看看，我先找那段准确的，我把我要替换的一小段：

// 找到 "const methylHSelected = group.hIds.every(hId => selectedHAtoms.includes(hId));
// 然后下面的console.log
// 然后if (methylHSelected) {

// 让我尝试定位到这段内容，让我打印那一小段内容，找到后我打印，然后替换
console.log('Looking for exact section...');
let contentLines = content.split('\n');
let start = -1, end = -1;
for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].includes('const methylHSelected = group.hIds.every')) {
        console.log(`Found start at line', i+1);
        start = i;
        // 查找到下一个if之后，到return结束！
        for (let j = i; j < i + 100; j++) {
            if (contentLines[j].includes('noRotation: false')) {
                end = j;
                console.log('Found end at line', j+1);
                break;
            }
        }
    }
        break;
    }
}
// 好，现在我们找到了！现在从start到end这一段。
// 让我打印一下我们要替换的准确文本！
console.log('Found lines from', start, 'to', end);
const linesToReplace = contentLines.slice(start, end + 1);
console.log('Original lines:', linesToReplace);

// 现在写我们要替换的新内容！

const newLines = [
    '            const methylHSelected = group.hIds.every(hId => selectedHAtoms.includes(hId));',
    '            const methylCSelected = selectedNonHAtoms.includes(group.cId);',
    '',
    '            console.log(\'[identifyConstrainedGroup] Checking methyl group:\', group, \'methylHSelected:\', methylHSelected, \'methylCSelected:\', methylCSelected);',
    '',
    '            // 如果这个甲基的3个H被选中（或者C+3个H被选中），允许旋转',
    '            if (methylHSelected || (methylHSelected && methylCSelected)) {',
    '              // 找到甲基碳原子',
    '              const methylCId = group.cId;',
    '              const methylC = stateRef.current.molecule.atoms.find(a => a.id === methylCId);',
    '',
    '              if (methylC) {',
    '                console.log(\'[identifyConstrainedGroup] METHYL ROTATION SUCCESS:\');',
    '                console.log(\'[identifyConstrainedGroup] - methylC:\', methylC.symbol, methylCId);',
    '',
    '                // fixedAtom是中心原子（这个甲基连接的那个碳原子，就是当前的centerAtom！）',
    '                const fixedAtomId = centerAtomId;',
    '                const fixedAtom = stateRef.current.molecule.atoms.find(a => a.id === fixedAtomId);',
    '',
    '                if (fixedAtom) {',
    '                  // 旋转轴是从固定原子指向甲基碳',
    '                  const rotationAxis = new THREE.Vector3(',
    '                    methylC.position.x - fixedAtom.position.x,',
    '                    methylC.position.y - fixedAtom.position.y,',
    '                    methylC.position.z - fixedAtom.position.z',
    '                  ).normalize();',
    '',
    '                  // 旋转甲基C和它的3个H',
    '                  const rotateAtoms = [methylCId, ...group.hIds];',
    '                  console.log(\'[identifyConstrainedGroup] METHYL ROTATION: rotateAtoms =\', rotateAtoms, \'fixedAtomId =\', fixedAtomId);',
    '                  return {',
    '                    atoms: rotateAtoms,',
    '                    fixedAtomId: fixedAtomId,',
    '                    rotationAxis,',
    '                    rotationCenterId: fixedAtomId,',
    '                    noRotation: false',
    '                  };',
    '                }'
];

console.log('Replacing lines...');
const newContentLines = [...contentLines.slice(0, start).concat(newLines).concat(contentLines.slice(end+1));

console.log('Writing new file...');
fs.writeFileSync(filePath, newContentLines.join('\n'), 'utf8');
console.log('Done!');
console.log('File updated successfully!');
console.log('Now let me build the project...');
