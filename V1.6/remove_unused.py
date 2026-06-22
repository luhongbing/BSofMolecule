import re

with open('/Users/hunter.lu/Documents/个人办公/AI技术/原子分析/src/components/Canvas3D.tsx', 'r') as f:
    content = f.read()

# 删除未使用的变量
# 根据错误信息，这些行需要删除：
# 153: 'lastStateUpdateRef'
# 154: 'cameraQuaternionRef'
# 155: 'gyroUpdateTimerRef'
# 207: 'cameraRight'
# 208: 'cameraUp'
# 209: 'worldUp'
# 3210: 'centerMolecule'

lines = content.split('\n')
new_lines = []

for i, line in enumerate(lines):
    # 跳过这些未使用的变量声明
    if any([
        'lastStateUpdateRef' in line and 'is declared' not in line,
        'cameraQuaternionRef' in line and 'is declared' not in line,
        'gyroUpdateTimerRef' in line and 'is declared' not in line,
        'cameraRight' in line and 'is declared' not in line,
        'cameraUp' in line and 'is declared' not in line,
        'worldUp' in line and 'is declared' not in line,
        'centerMolecule' in line and 'is declared' not in line,
    ]):
        # 检查是否是const声明
        if 'const' in line or 'let' in line or 'var' in line:
            print(f"删除第{i+1}行: {line.strip()}")
            continue
    new_lines.append(line)

with open('/Users/hunter.lu/Documents/个人办公/AI技术/原子分析/src/components/Canvas3D.tsx', 'w') as f:
    f.write('\n'.join(new_lines))

print('修复完成')
