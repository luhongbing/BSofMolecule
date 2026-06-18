const fs = require('fs');
const content = fs.readFileSync('/Users/hunter.lu/Documents/个人办公/AI技术/原子分析/src/components/Canvas3D.tsx', 'utf8');
const lines = content.split('\n');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;
let lineNum = 0;
let maxBrace = 0;
let maxLine = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    lineNum = i + 1;
    
    // 跳过注释和字符串
    let inString = false;
    let stringChar = '';
    let skipNext = false;
    
    for (let j = 0; j < line.length; j++) {
        const ch = line[j];
        
        if (skipNext) {
            skipNext = false;
            continue;
        }
        
        if ((ch === '"' || ch === "'" || ch === '`') && (j === 0 || line[j-1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = ch;
            } else if (ch === stringChar) {
                inString = false;
            }
        } else if (!inString) {
            if (ch === '{') {
                braceCount++;
                if (braceCount > maxBrace) {
                    maxBrace = braceCount;
                    maxLine = lineNum;
                }
            } else if (ch === '}') {
                braceCount--;
            } else if (ch === '(') {
                parenCount++;
            } else if (ch === ')') {
                parenCount--;
            } else if (ch === '[') {
                bracketCount++;
            } else if (ch === ']') {
                bracketCount--;
            }
        }
    }
    
    if (braceCount < 0) {
        console.log(`第${lineNum}行: 出现了多余的右括号 '}'，当前计数: ${braceCount}`);
        break;
    }
}

console.log(`文件总行数: ${lines.length}`);
console.log(`最终大括号计数: ${braceCount}`);
console.log `最终圆括号计数: ${parenCount}`;
console.log(`最终方括号计数: ${bracketCount}`);
console.log(`最大嵌套层级: ${maxBrace}，出现在第${maxLine}行`);

if (braceCount > 0) {
    console.log(`\n警告: 有 ${braceCount} 个未闭合的 '{'`);
} else if (braceCount < 0) {
    console.log(`\n警告: 有 ${Math.abs(braceCount)} 个多余的 '}'`);
}
