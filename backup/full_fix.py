#!/usr/bin/env python3
# 完整修复脚本 - 替换identifyConstrainedGroup中的甲基旋转逻辑

with open('/Users/hunter.lu/Documents/个人办公/AI技术/原子分析/src/components/Canvas3D.tsx', 'r') as f:
    content = f.read()

# 我们需要找到并替换的旧代码（在 "检查每个甲基是否被选中" 部分）
old_code = '''          // 检查每个甲基是否被选中 - 只需要甲基的H被选中就可以旋转
          for (const group of methylGroups) {
            const methylHSelected = group.hIds.every(hId => selectedHAtoms.includes(hId));
            
            console.log('[identifyConstrainedGroup] Checking methyl group:', group, 'methylHSelected:', methylHSelected);
            
            // 如果这个甲基的3个H被选中，允许旋转（无论C是否被选中）
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
                }
              }
            }
          }'''

# 新代码
new_code = '''          // 检查每个甲基是否被选中 - 只需要甲基的H被选中就可以旋转
          for (const group of methylGroups) {
            const methylHSelected = group.hIds.every(hId => selectedHAtoms.includes(hId));
            const methylCSelected = selectedNonHAtoms.includes(group.cId);
            
            console.log('[identifyConstrainedGroup] Checking methyl group:', group, 'methylHSelected:', methylHSelected, 'methylCSelected:', methylCSelected);
            
            // 如果这个甲基的3个H被选中（或者C+3个H被选中），允许旋转
            if (methylHSelected || (methylHSelected && methylCSelected)) {
              // 找到甲基碳原子
              const methylCId = group.cId;
              const methylC = stateRef.current.molecule.atoms.find(a => a.id === methylCId);
              
              if (methylC) {
                console.log('[identifyConstrainedGroup] METHYL ROTATION SUCCESS:');
                console.log('[identifyConstrainedGroup] - methylC:', methylC.symbol, methylCId);
                
                // fixedAtom是中心原子（这个甲基连接的那个碳原子，就是当前的centerAtom！）
                const fixedAtomId = centerAtomId;
                const fixedAtom = stateRef.current.molecule.atoms.find(a => a.id === fixedAtomId);
                
                if (fixedAtom) {
                  // 旋转轴是从固定原子指向甲基碳
                  const rotationAxis = new THREE.Vector3(
                    methylC.position.x - fixedAtom.position.x,
                    methylC.position.y - fixedAtom.position.y,
                    methylC.position.z - fixedAtom.position.z
                  ).normalize();
                  
                  // 旋转甲基C和它的3个H
                  const rotateAtoms = [methylCId, ...group.hIds];
                  console.log('[identifyConstrainedGroup] METHYL ROTATION: rotateAtoms =', rotateAtoms, 'fixedAtomId =', fixedAtomId);
                  return {
                    atoms: rotateAtoms,
                    fixedAtomId: fixedAtomId,
                    rotationAxis,
                    rotationCenterId: fixedAtomId,
                    noRotation: false
                  };
                }
              }
            }
          }'''

if old_code in content:
    content = content.replace(old_code, new_code)
    print("成功替换甲基旋转逻辑！")
else:
    print("错误：找不到要替换的代码段！")
    print("尝试在文件中搜索...")
    if '检查每个甲基是否被选中' in content:
        print("找到目标注释，但代码段不匹配")
    else:
        print("未找到目标注释")
    exit(1)

with open('/Users/hunter.lu/Documents/个人办公/AI技术/原子分析/src/components/Canvas3D.tsx', 'w') as f:
    f.write(content)

print("文件已更新！")
