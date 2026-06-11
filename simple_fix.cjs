const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/Canvas3D.tsx');

console.log('Reading file:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// 我们用更简单的办法，先打印那周围的内容看看！我们找位置！
// 先找 "const methylHSelected = group.hIds.every" 所在的行号：
const lines = content.split('\n');
let lineIndex = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const methylHSelected = group.hIds.every')) {
        lineIndex = i;
        console.log('找到了行号:', i + 1);
        // 打印周围的内容
        console.log('========== 附近的内容 ==========');
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 60); j++) {
            console.log(`${j+1}: ${lines[j]}`);
        }
        console.log('================================');
        break;
    }
}

if (lineIndex === -1) {
    console.log('没找到那一行！');
    process.exit(1);
}

console.log('现在我们要替换第', lineIndex+1, '行开始的那一段到return结束！');

// 现在我们直接构造替换后的内容！
const newBlockLines = [
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
    '                }',
    '              }',
    '            }'
];

// 现在找到原来那段的结束行：我们要从lineIndex开始一直找到下一个return结束后的闭合大括号！
let endLine = lineIndex;
let braceCount = 0;

// 从lineIndex开始查找结束位置：
for (let i = lineIndex; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('if (methylHSelected) {')) braceCount++;
    if (line.includes('{')) {
        const openCount = (line.match(/\{/g) || []).length;
        braceCount += openCount;
    }
    if (line.includes('}')) {
        const closeCount = (line.match(/\}/g) || []).length;
        braceCount -= closeCount;
    }
    if (braceCount === 0 && i > lineIndex + 5) {
        endLine = i;
        break;
    }
}
console.log('要替换的结束行号:', endLine+1);
console.log('现在替换...');

// 现在进行替换！
const newLines = [
    ...lines.slice(0, lineIndex),
    ...newBlockLines,
    ...lines.slice(endLine + 1)
];

const outputContent = newLines.join('\n');

console.log('写入文件...');
fs.writeFileSync(filePath, outputContent, 'utf8');
console.log('成功更新文件！');
