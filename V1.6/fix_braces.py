with open('/Users/hunter.lu/Documents/个人办公/AI技术/原子分析/src/components/Canvas3D.tsx', 'r') as f:
    lines = f.readlines()

# 在第1664行（0索引为1663）后面插入一行：添加缺失的大括号
# 第1664行是 "            }"，下一行应该是新的 "          }" 来关闭 for 循环
lines.insert(1664, '          }\n')

with open('/Users/hunter.lu/Documents/个人办公/AI技术/原子分析/src/components/Canvas3D.tsx', 'w') as f:
    f.writelines(lines)

print('修复完成！')
