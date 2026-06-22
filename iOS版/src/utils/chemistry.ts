import type { Atom, Molecule, HybridizationAnalysis, CollinearityResult, CoplanarityResult } from '../types';
import { getElementColor, getCovalentRadius, getVdwRadius } from './elements';

// Re-export from elements library for backward compatibility
export { getElementColor, getCovalentRadius, getVdwRadius };

// 原子最大成键数（N 规则 / 八电子规则）
// H=1, C=4, N=3, O=2, 卤素=1, S=2(常见), P=3(常见)
const MAX_BOND_CAPACITY: Record<string, number> = {
  H: 1,
  C: 4,
  N: 3,
  O: 2,
  F: 1,
  Cl: 1,
  Br: 1,
  I: 1,
  S: 2,
  P: 3
};

// 计算原子已使用的化合价
export function getUsedValence(molecule: Molecule, atomId: string): number {
  let usedValence = 0;
  const atomBonds = molecule.bonds.filter(b => b.atom1Id === atomId || b.atom2Id === atomId);
  for (const bond of atomBonds) {
    usedValence += bond.order; // 单键1，双键2，三键3
  }
  return usedValence;
}

// 计算原子剩余成键容量（最大成键数 - 已用成键数）
export function getAvailableValence(molecule: Molecule, atomId: string): number {
  const atom = molecule.atoms.find(a => a.id === atomId);
  if (!atom) return 0;
  const maxBondCapacity = MAX_BOND_CAPACITY[atom.symbol] || 4;
  const usedValence = getUsedValence(molecule, atomId);
  return maxBondCapacity - usedValence;
}

// 判断原子是否有空位接受键
export function hasFreeValence(molecule: Molecule, atomId: string): boolean {
  return getAvailableValence(molecule, atomId) > 0;
}

// 获取原子的空余方向（用于键吸附）
export function getAvailableBondDirections(molecule: Molecule, atomId: string): { x: number, y: number, z: number }[] {
  const atom = molecule.atoms.find(a => a.id === atomId);
  if (!atom) return [];
  
  const atomBonds = molecule.bonds.filter(b => b.atom1Id === atomId || b.atom2Id === atomId);
  const bondVectors: { x: number, y: number, z: number }[] = [];
  
  for (const bond of atomBonds) {
    const otherId = bond.atom1Id === atomId ? bond.atom2Id : bond.atom1Id;
    const otherAtom = molecule.atoms.find(a => a.id === otherId);
    if (otherAtom) {
      const dx = otherAtom.position.x - atom.position.x;
      const dy = otherAtom.position.y - atom.position.y;
      const dz = otherAtom.position.z - atom.position.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len > 0.001) {
        bondVectors.push({ x: dx / len, y: dy / len, z: dz / len });
      }
    }
  }
  
  const availableValence = getAvailableValence(molecule, atomId);
  if (availableValence <= 0) return [];
  
  // 基于杂化类型计算空余方向
  // 所有方向都在XY平面内（Z=0），确保原子和键共面
  const directions: { x: number, y: number, z: number }[] = [];
  const atomSymbol = atom.symbol;
  
  // 简单版本：根据已有的键向量，计算相反或垂直方向
  // 先根据杂化类型和已有键，推断可能的空余键方向
  if (atom.hybridization === 'sp3') {
    // 四面体构型投影到XY平面：4个方向
    directions.push({ x: 1, y: 0, z: 0 });
    directions.push({ x: -1, y: 0, z: 0 });
    directions.push({ x: 0, y: 1, z: 0 });
    directions.push({ x: 0, y: -1, z: 0 });
  } else if (atom.hybridization === 'sp2') {
    // 平面三角形：3个方向
    directions.push({ x: 1, y: 0, z: 0 });
    directions.push({ x: -0.5, y: Math.sqrt(3)/2, z: 0 });
    directions.push({ x: -0.5, y: -Math.sqrt(3)/2, z: 0 });
  } else if (atom.hybridization === 'sp') {
    // 直线：2个方向
    directions.push({ x: 1, y: 0, z: 0 });
    directions.push({ x: -1, y: 0, z: 0 });
  } else {
    // 默认：4个轴向（XY平面内）
    directions.push({ x: 1, y: 0, z: 0 });
    directions.push({ x: -1, y: 0, z: 0 });
    directions.push({ x: 0, y: 1, z: 0 });
    directions.push({ x: 0, y: -1, z: 0 });
  }
  
  // 过滤掉已有键方向附近的方向
  const filtered: { x: number, y: number, z: number }[] = [];
  for (const dir of directions) {
    let hasOverlap = false;
    for (const bv of bondVectors) {
      // 点积检查方向相似度
      const dot = dir.x * bv.x + dir.y * bv.y + dir.z * bv.z;
      if (Math.abs(dot) > 0.7) { // 超过0.7认为是相似方向
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
      filtered.push(dir);
    }
  }
  
  // 如果没有过滤出方向，就返回前几个
  if (filtered.length === 0) {
    return directions.slice(0, availableValence);
  }
  
  return filtered.slice(0, availableValence);
}

// 获取原子最近的吸附位置
export function getSnappedPosition(
  atomToAdd: { x: number, y: number, z: number },
  targetAtomId: string,
  molecule: Molecule
): { position: { x: number, y: number, z: number }, canSnap: boolean } {
  const targetAtom = molecule.atoms.find(a => a.id === targetAtomId);
  if (!targetAtom) return { position: atomToAdd, canSnap: false };
  
  // 检查目标原子是否有空余化合价
  const availableValence = getAvailableValence(molecule, targetAtomId);
  if (availableValence <= 0) return { position: atomToAdd, canSnap: false };
  
  // 获取可能的吸附方向
  const directions = getAvailableBondDirections(molecule, targetAtomId);
  if (directions.length === 0) return { position: atomToAdd, canSnap: false };
  
  // 查找最近的方向
  const dxFromTarget = atomToAdd.x - targetAtom.position.x;
  const dyFromTarget = atomToAdd.y - targetAtom.position.y;
  const dzFromTarget = atomToAdd.z - targetAtom.position.z;
  const distFromTarget = Math.sqrt(dxFromTarget * dxFromTarget + dyFromTarget * dyFromTarget + dzFromTarget * dzFromTarget);
  
  // 归一化用户拖动的方向
  let userDir = { x: 0, y: 0, z: 1 };
  if (distFromTarget > 0.001) {
    userDir = {
      x: dxFromTarget / distFromTarget,
      y: dyFromTarget / distFromTarget,
      z: dzFromTarget / distFromTarget
    };
  }
  
  // 找到与用户拖动方向最接近的吸附方向
  let bestDir = directions[0];
  let bestDot = -Infinity;
  for (const dir of directions) {
    const dot = userDir.x * dir.x + userDir.y * dir.y + userDir.z * dir.z;
    if (dot > bestDot) {
      bestDot = dot;
      bestDir = dir;
    }
  }
  
  // 默认C-C键长
  let bondLength = 1.54;
  
  // 计算目标位置
  // 约束Z方向：吸附位置与目标原子保持同一Z平面
  const snappedPos = {
    x: targetAtom.position.x + bestDir.x * bondLength,
    y: targetAtom.position.y + bestDir.y * bondLength,
    z: targetAtom.position.z  // 保持与目标原子同一Z平面
  };
  
  return { position: snappedPos, canSnap: true };
}

// 查找鼠标附近有空闲化合价的原子
export function findNearbyAtomWithFreeValence(
  mousePosition: { x: number, y: number, z: number },
  molecule: Molecule,
  excludeAtomIds: string[] = []
): { targetAtomId: string | null, canSnap: boolean, distance: number } {
  let closestId: string | null = null;
  let closestDist = Infinity;
  
  for (const atom of molecule.atoms) {
    // 排除指定的原子
    if (excludeAtomIds.includes(atom.id)) continue;
    
    if (hasFreeValence(molecule, atom.id)) {
      const dx = atom.position.x - mousePosition.x;
      const dy = atom.position.y - mousePosition.y;
      const dz = atom.position.z - mousePosition.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // 吸附条件：键端点小球完全进入原子球内
      // 即距离 < 原子显示半径 - 端点小球半径
      const atomDisplayRadius = atom.radius || getCovalentRadius(atom.symbol);
      const endpointBallRadius = 0.1; // BOND_RADIUS * 1.5
      const snapThreshold = atomDisplayRadius - endpointBallRadius;
      
      if (dist < closestDist && snapThreshold > 0 && dist < snapThreshold) {
        closestId = atom.id;
        closestDist = dist;
      }
    }
  }
  
  return { targetAtomId: closestId, canSnap: closestId !== null, distance: closestDist };
}

// 查找附近有空头位置的键
export function findNearbyBondEndpoint(
  mousePosition: { x: number, y: number, z: number },
  molecule: Molecule,
  excludeAtomIds: string[] = []
): { bondId: string | null, endpoint: 'atom1' | 'atom2' | null, canSnap: boolean, distance: number, position: { x: number, y: number, z: number } | null, connectedAtomId: string | null } {
  let closestBondId: string | null = null;
  let closestEndpoint: 'atom1' | 'atom2' | null = null;
  let closestDist = Infinity;
  let closestPos: { x: number, y: number, z: number } | null = null;
  let closestConnectedAtomId: string | null = null;
  
  // 吸附阈值：拖拽原子靠近空头端点时的最大距离
  const snapThreshold = 0.5;
  
  // 检查每个键的空头位置
  for (const bond of molecule.bonds) {
    // 检查 atom1 端是否是空头
    if (bond.atom1Id === null && bond.atom1Position) {
      // 检测拖拽原子是否靠近空头端点位置
      const dx = bond.atom1Position.x - mousePosition.x;
      const dy = bond.atom1Position.y - mousePosition.y;
      const dist2D = Math.sqrt(dx * dx + dy * dy);
      
      if (dist2D < closestDist && dist2D < snapThreshold) {
        closestBondId = bond.id;
        closestEndpoint = 'atom1';
        closestDist = dist2D;
        closestPos = bond.atom1Position;
        closestConnectedAtomId = bond.atom2Id;
      }
    }
    
    // 检查 atom2 端是否是空头
    if (bond.atom2Id === null && bond.atom2Position) {
      // 检测拖拽原子是否靠近空头端点位置
      const dx = bond.atom2Position.x - mousePosition.x;
      const dy = bond.atom2Position.y - mousePosition.y;
      const dist2D = Math.sqrt(dx * dx + dy * dy);
      
      if (dist2D < closestDist && dist2D < snapThreshold) {
        closestBondId = bond.id;
        closestEndpoint = 'atom2';
        closestDist = dist2D;
        closestPos = bond.atom2Position;
        closestConnectedAtomId = bond.atom1Id;
      }
    }
  }
  
  return { 
    bondId: closestBondId, 
    endpoint: closestEndpoint, 
    canSnap: closestBondId !== null, 
    distance: closestDist,
    position: closestPos,
    connectedAtomId: closestConnectedAtomId
  };
}

export function calculateMolecularWeight(atoms: Atom[]): number {
  const atomicWeights: Record<string, number> = {
    H: 1.008, C: 12.011, N: 14.007, O: 15.999,
    F: 18.998, Cl: 35.453, Br: 79.904, I: 126.904,
    S: 32.065, P: 30.974
  };
  return atoms.reduce((sum, atom) => sum + (atomicWeights[atom.symbol] || 12), 0);
}

export function calculateFormula(atoms: Atom[]): string {
  const counts: Record<string, number> = {};
  atoms.forEach(atom => {
    counts[atom.symbol] = (counts[atom.symbol] || 0) + 1;
  });
  const order = ['C', 'H', 'N', 'O', 'F', 'Cl', 'Br', 'I', 'S', 'P'];
  return order
    .filter(symbol => counts[symbol])
    .map(symbol => `${symbol}${counts[symbol] > 1 ? counts[symbol] : ''}`)
    .join('');
}

export function calculateUnsaturation(formula: string): number {
  let c = 0, h = 0, n = 0, x = 0;
  const matches = formula.match(/([A-Z][a-z]?)(\d*)/g) || [];
  matches.forEach(match => {
    const [, element, count] = match.match(/([A-Z][a-z]?)(\d*)/) || [];
    const num = count ? parseInt(count) : 1;
    switch (element) {
      case 'C': c += num; break;
      case 'H': h += num; break;
      case 'N': n += num; break;
      case 'F':
      case 'Cl':
      case 'Br':
      case 'I': x += num; break;
    }
  });
  return Math.max(0, Math.floor(c + 1 - h / 2 + n / 2 - x / 2));
}

export function analyzeHybridization(molecule: Molecule): HybridizationAnalysis {
  const result: HybridizationAnalysis = { sp: [], sp2: [], sp3: [] };
  
  molecule.atoms.forEach(atom => {
    if (atom.symbol !== 'C' && atom.symbol !== 'O' && atom.symbol !== 'N') return;
    
    // 如果原子已有杂化类型（由SMILES解析器根据芳香性设置），优先使用
    if (atom.hybridization) {
      result[atom.hybridization].push(atom.id);
      return;
    }
    
    const bonds = molecule.bonds.filter(
      bond => bond.atom1Id === atom.id || bond.atom2Id === atom.id
    );
    
    const maxBondOrder = Math.max(...bonds.map(b => b.order));
    
    // 有三键→sp，有双键→sp2，否则sp3
    if (maxBondOrder === 3) {
      result.sp.push(atom.id);
      atom.hybridization = 'sp';
    } else if (maxBondOrder === 2) {
      result.sp2.push(atom.id);
      atom.hybridization = 'sp2';
    } else {
      result.sp3.push(atom.id);
      atom.hybridization = 'sp3';
    }
  });
  
  return result;
}

export function checkCollinearity(atoms: Atom[], atomIds: string[]): CollinearityResult {
  const selectedAtoms = atoms.filter(atom => atomIds.includes(atom.id));
  if (selectedAtoms.length < 3) {
    return { isCollinear: true, atoms: atomIds, explanation: '少于3个原子，默认为共线' };
  }
  
  const p1 = selectedAtoms[0].position;
  const p2 = selectedAtoms[1].position;
  const p3 = selectedAtoms[2].position;
  
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v1z = p2.z - p1.z;
  
  const v2x = p3.x - p1.x;
  const v2y = p3.y - p1.y;
  const v2z = p3.z - p1.z;
  
  const crossX = v1y * v2z - v1z * v2y;
  const crossY = v1z * v2x - v1x * v2z;
  const crossZ = v1x * v2y - v1y * v2x;
  
  const crossMagnitude = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  const tolerance = 0.001;
  
  const isCollinear = crossMagnitude < tolerance;
  
  return {
    isCollinear,
    atoms: atomIds,
    explanation: isCollinear 
      ? `${selectedAtoms.map(a => a.symbol).join('-')} 共线（三点叉积为零）`
      : `${selectedAtoms.map(a => a.symbol).join('-')} 不共线（三点叉积不为零）`
  };
}

export function checkCoplanarity(atoms: Atom[], atomIds: string[]): CoplanarityResult {
  const selectedAtoms = atoms.filter(atom => atomIds.includes(atom.id));
  if (selectedAtoms.length < 3) {
    return { isCoplanar: true, atoms: atomIds, explanation: '少于3个原子，默认为共面' };
  }
  
  const p1 = selectedAtoms[0].position;
  const p2 = selectedAtoms[1].position;
  const p3 = selectedAtoms[2].position;
  
  const v1x = p2.x - p1.x;
  const v1y = p2.y - p1.y;
  const v1z = p2.z - p1.z;
  
  const v2x = p3.x - p1.x;
  const v2y = p3.y - p1.y;
  const v2z = p3.z - p1.z;
  
  const a = v1y * v2z - v1z * v2y;
  const b = v1z * v2x - v1x * v2z;
  const c = v1x * v2y - v1y * v2x;
  const d = -(a * p1.x + b * p1.y + c * p1.z);
  
  let isCoplanar = true;
  let explanation = '';
  
  if (selectedAtoms.length === 3) {
    isCoplanar = true;
    explanation = `${selectedAtoms.map(a => a.symbol).join('-')} 共面（三点共面）`;
  } else {
    const tolerance = 0.01;
    isCoplanar = true;
    
    for (let i = 3; i < selectedAtoms.length; i++) {
      const p = selectedAtoms[i].position;
      const distance = Math.abs(a * p.x + b * p.y + c * p.z + d) / Math.sqrt(a * a + b * b + c * c);
      
      if (distance >= tolerance) {
        isCoplanar = false;
        break;
      }
    }
    
    explanation = isCoplanar
      ? `${selectedAtoms.map(a => a.symbol).join('-')} 共面（所有点到平面距离小于阈值）`
      : `${selectedAtoms.map(a => a.symbol).join('-')} 不共面（有点到平面距离超过阈值）`;
  }
  
  return {
    isCoplanar,
    atoms: atomIds,
    explanation,
    planeEquation: { a, b, c, d }
  };
}

// 辅助函数：检查一个组是否是另一个组的子集
function isSubset(small: string[], large: string[]): boolean {
  return small.every(id => large.includes(id));
}

// 辅助函数：过滤掉被包含的子集，只保留最大的组
function filterToMaxGroups(groups: string[][]): string[][] {
  if (groups.length === 0) return [];
  
  // 按组大小降序排序
  const sortedGroups = [...groups].sort((a, b) => b.length - a.length);
  const maxGroups: string[][] = [];
  
  for (const group of sortedGroups) {
    // 检查这个组是否已经被已有的最大组完全包含
    const isAlreadyContained = maxGroups.some(maxGroup => isSubset(group, maxGroup));
    if (!isAlreadyContained) {
      maxGroups.push(group);
    }
  }
  
  return maxGroups;
}

// 辅助函数：去重和排序原子ID列表
function normalizeGroup(group: string[]): string[] {
  return [...new Set(group)].sort();
}

// 获取与原子直接相连的所有原子
function getConnectedAtoms(molecule: any, atomId: string): { atomId: string, order: number }[] {
  const connected: { atomId: string, order: number }[] = [];
  molecule.bonds.forEach((bond: any) => {
    if (bond.atom1Id === atomId) {
      connected.push({ atomId: bond.atom2Id, order: bond.order });
    } else if (bond.atom2Id === atomId) {
      connected.push({ atomId: bond.atom1Id, order: bond.order });
    }
  });
  return connected;
}

// 获取三键的共线原子（4个原子）
function getTripleBondCollinear(molecule: any): string[][] {
  const groups: string[][] = [];
  molecule.bonds.forEach((bond: any) => {
    if (bond.order === 3) {
      const atom1 = molecule.atoms.find((a: any) => a.id === bond.atom1Id);
      const atom2 = molecule.atoms.find((a: any) => a.id === bond.atom2Id);
      if (atom1 && atom2) {
        const collinearGroup = new Set<string>();
        collinearGroup.add(atom1.id);
        collinearGroup.add(atom2.id);
        
        // 添加与atom1相连的其他原子（通过单键连接的）
        const connected1 = getConnectedAtoms(molecule, atom1.id);
        connected1.forEach(conn => {
          if (conn.atomId !== atom2.id) {
            collinearGroup.add(conn.atomId);
          }
        });
        
        // 添加与atom2相连的其他原子（通过单键连接的）
        const connected2 = getConnectedAtoms(molecule, atom2.id);
        connected2.forEach(conn => {
          if (conn.atomId !== atom1.id) {
            collinearGroup.add(conn.atomId);
          }
        });
        
        if (collinearGroup.size >= 3) {
          groups.push(Array.from(collinearGroup));
        }
      }
    }
  });
  return groups;
}

// 获取双键的共面原子（6个原子）
function getDoubleBondCoplanar(molecule: any): string[][] {
  const groups: string[][] = [];
  molecule.bonds.forEach((bond: any) => {
    if (bond.order === 2) {
      const atom1 = molecule.atoms.find((a: any) => a.id === bond.atom1Id);
      const atom2 = molecule.atoms.find((a: any) => a.id === bond.atom2Id);
      if (atom1 && atom2) {
        const coplanarGroup = new Set<string>();
        coplanarGroup.add(atom1.id);
        coplanarGroup.add(atom2.id);
        
        // 添加与atom1相连的所有原子
        const connected1 = getConnectedAtoms(molecule, atom1.id);
        connected1.forEach(conn => coplanarGroup.add(conn.atomId));
        
        // 添加与atom2相连的所有原子
        const connected2 = getConnectedAtoms(molecule, atom2.id);
        connected2.forEach(conn => coplanarGroup.add(conn.atomId));
        
        if (coplanarGroup.size >= 4) {
          groups.push(Array.from(coplanarGroup));
        }
      }
    }
  });
  return groups;
}

// 获取苯环的共面原子（12个原子）
function getBenzeneCoplanar(molecule: any): string[][] {
  const groups: string[][] = [];
  const processedRings = new Set<string>();
  
  // 简单的苯环检测：寻找6个sp2杂化的碳原子形成环
  const sp2Carbons = molecule.atoms.filter((a: any) => a.symbol === 'C' && a.hybridization === 'sp2');
  
  sp2Carbons.forEach((startCarbon: any) => {
    if (!processedRings.has(startCarbon.id)) {
      // 尝试寻找6元环
      const visited = new Set<string>();
      const ring: string[] = [];
      
      const dfs = (currentId: string, depth: number): boolean => {
        if (depth === 6 && currentId === startCarbon.id) {
          return ring.length === 6;
        }
        if (visited.has(currentId) || depth > 6) return false;
        
        visited.add(currentId);
        ring.push(currentId);
        
        const connected = getConnectedAtoms(molecule, currentId);
        for (const conn of connected) {
          const connAtom = molecule.atoms.find((a: any) => a.id === conn.atomId);
          if (connAtom && connAtom.symbol === 'C' && connAtom.hybridization === 'sp2') {
            if (dfs(conn.atomId, depth + 1)) {
              return true;
            }
          }
        }
        
        ring.pop();
        visited.delete(currentId);
        return false;
      };
      
      if (dfs(startCarbon.id, 0)) {
        // 找到苯环，添加所有环原子和它们连接的H
        const coplanarGroup = new Set<string>();
        ring.forEach(carbonId => {
          coplanarGroup.add(carbonId);
          const connected = getConnectedAtoms(molecule, carbonId);
          connected.forEach(conn => {
            const connAtom = molecule.atoms.find((a: any) => a.id === conn.atomId);
            if (connAtom && connAtom.symbol === 'H') {
              coplanarGroup.add(conn.atomId);
            }
          });
          processedRings.add(carbonId);
        });
        
        if (coplanarGroup.size >= 4) {
          groups.push(Array.from(coplanarGroup));
        }
      }
    }
  });
  
  return groups;
}

// 查找所有共线基团（基于化学规则）
export function findAllCollinearGroups(molecule: Molecule): string[][] {
  const groups: string[][] = [];
  const seenGroups = new Set<string>();
  
  // 1. 三键共线
  const tripleBondGroups = getTripleBondCollinear(molecule);
  tripleBondGroups.forEach(group => {
    const normalized = normalizeGroup(group);
    const key = normalized.join(',');
    if (!seenGroups.has(key)) {
      seenGroups.add(key);
      groups.push(normalized);
    }
  });
  
  return filterToMaxGroups(groups);
}

// 查找所有共面基团（基于化学规则）
export function findAllCoplanarGroups(molecule: Molecule): string[][] {
  const groups: string[][] = [];
  const seenGroups = new Set<string>();
  
  // 1. 双键共面
  const doubleBondGroups = getDoubleBondCoplanar(molecule);
  doubleBondGroups.forEach(group => {
    const normalized = normalizeGroup(group);
    const key = normalized.join(',');
    if (!seenGroups.has(key)) {
      seenGroups.add(key);
      groups.push(normalized);
    }
  });
  
  // 2. 苯环共面
  const benzeneGroups = getBenzeneCoplanar(molecule);
  benzeneGroups.forEach(group => {
    const normalized = normalizeGroup(group);
    const key = normalized.join(',');
    if (!seenGroups.has(key)) {
      seenGroups.add(key);
      groups.push(normalized);
    }
  });
  
  // 3. 羰基共面（C=O双键）
  // 已经包含在双键共面中了
  
  return filterToMaxGroups(groups);
}

export function generateUUID(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== 刚性约束规则系统 ====================

// 辅助函数：获取原子的键信息
function getBondInfo(molecule: any, atomId: string) {
  const bonds = molecule.bonds.filter((b: any) => b.atom1Id === atomId || b.atom2Id === atomId);
  const connectedAtoms = bonds.map((b: any) => ({
    atomId: b.atom1Id === atomId ? b.atom2Id : b.atom1Id,
    order: b.order
  }));
  return { bonds, connectedAtoms };
}

// 辅助函数：检查两个原子是否直接相连
function areDirectlyBonded(molecule: any, atom1Id: string, atom2Id: string): { bonded: boolean; order: number } {
  const bond = molecule.bonds.find((b: any) => 
    (b.atom1Id === atom1Id && b.atom2Id === atom2Id) ||
    (b.atom1Id === atom2Id && b.atom2Id === atom1Id)
  );
  return { bonded: !!bond, order: bond?.order || 0 };
}

// 辅助函数：检查原子是否在苯环中
function isInBenzeneRing(molecule: any, atomId: string): { isInRing: boolean; ringAtomIds: string[] } {
  const atom = molecule.atoms.find((a: any) => a.id === atomId);
  if (!atom || atom.symbol !== 'C') return { isInRing: false, ringAtomIds: [] };
  
  const { connectedAtoms } = getBondInfo(molecule, atomId);
  if (connectedAtoms.length !== 3) return { isInRing: false, ringAtomIds: [] };
  
  let allTriconnected = true;
  const potentialRingAtoms = [atomId];
  
  for (const conn of connectedAtoms) {
    const connAtom = molecule.atoms.find((a: any) => a.id === conn.atomId);
    if (!connAtom) { allTriconnected = false; break; }
    const { connectedAtoms: connConn } = getBondInfo(molecule, conn.atomId);
    if (connConn.length !== 3) { allTriconnected = false; break; }
    potentialRingAtoms.push(conn.atomId);
  }
  
  if (allTriconnected && potentialRingAtoms.length === 4) {
    return { isInRing: true, ringAtomIds: potentialRingAtoms };
  }
  
  return { isInRing: false, ringAtomIds: [] };
}

// 刚性约束检查 - 共面
export function checkRigidConstraintsForCoplanar(molecule: any, atomIds: string[]): { 
  canAdjust: boolean; 
  reason: string; 
  violatingRules: string[] 
} {
  // 共面分析至少需要4个原子
  if (atomIds.length < 4) {
    return { 
      canAdjust: false, 
      reason: '共面分析需要至少选中4个原子', 
      violatingRules: ['原子数量不足'] 
    };
  }

  // 检查是否包含双键、苯环或羰基，这些是可以共面的
  let hasValidStructure = false;
  
  // 检查是否包含双键
  for (const bond of molecule.bonds) {
    if (bond.order === 2 && atomIds.includes(bond.atom1Id) && atomIds.includes(bond.atom2Id)) {
      hasValidStructure = true;
      break;
    }
  }
  
  // 检查是否包含苯环（sp2碳环）
  if (!hasValidStructure) {
    const selectedSp2Carbons = atomIds.filter(id => {
      const atom = molecule.atoms.find((a: any) => a.id === id);
      return atom && atom.symbol === 'C' && atom.hybridization === 'sp2';
    });
    if (selectedSp2Carbons.length >= 6) {
      hasValidStructure = true;
    }
  }
  
  if (hasValidStructure) {
    return { canAdjust: true, reason: '包含双键或苯环结构，可共面', violatingRules: [] };
  }
  
  return { canAdjust: false, reason: '选中的原子不包含双键或苯环等可共面结构', violatingRules: ['无有效共面结构'] };
}

// 刚性约束检查 - 共线
export function checkRigidConstraintsForCollinear(molecule: any, atomIds: string[]): { 
  canAdjust: boolean; 
  reason: string; 
  violatingRules: string[] 
} {
  // 共线分析至少需要3个原子
  if (atomIds.length < 3) {
    return { 
      canAdjust: false, 
      reason: '共线分析需要至少选中3个原子', 
      violatingRules: ['原子数量不足'] 
    };
  }

  // 检查是否包含三键，这是可以共线的
  for (const bond of molecule.bonds) {
    if (bond.order === 3 && atomIds.includes(bond.atom1Id) && atomIds.includes(bond.atom2Id)) {
      return { canAdjust: true, reason: '包含三键结构，可共线', violatingRules: [] };
    }
  }
  
  return { canAdjust: false, reason: '选中的原子不包含三键等可共线结构', violatingRules: ['无有效共线结构'] };
}

export function adjustToCoplanar(molecule: any, atomIds: string[]): any {
  const constraintCheck = checkRigidConstraintsForCoplanar(molecule, atomIds);
  if (!constraintCheck.canAdjust) {
    return null;
  }
  
  const atoms = [...molecule.atoms];
  const selectedAtoms = atoms.filter(atom => atomIds.includes(atom.id));
  if (selectedAtoms.length < 3) return molecule;
  
  const center = { x: 0, y: 0, z: 0 };
  selectedAtoms.forEach((atom: { position: { x: number; y: number; z: number } }) => {
    center.x += atom.position.x;
    center.y += atom.position.y;
    center.z += atom.position.z;
  });
  center.x /= selectedAtoms.length;
  center.y /= selectedAtoms.length;
  center.z /= selectedAtoms.length;
  
  const p1 = selectedAtoms[0].position;
  const p2 = selectedAtoms[1].position;
  const p3 = selectedAtoms[2].position;
  
  const v1x = p2.x - p1.x, v1y = p2.y - p1.y, v1z = p2.z - p1.z;
  const v2x = p3.x - p1.x, v2y = p3.y - p1.y, v2z = p3.z - p1.z;
  
  const a = v1y * v2z - v1z * v2y;
  const b = v1z * v2x - v1x * v2z;
  const c = v1x * v2y - v1y * v2x;
  
  const norm = Math.sqrt(a * a + b * b + c * c);
  if (norm < 0.0001) return molecule;
  
  const nx = a / norm, ny = b / norm, nz = c / norm;
  
  atoms.forEach(atom => {
    if (atomIds.includes(atom.id)) {
      const p = atom.position;
      const dx = p.x - center.x, dy = p.y - center.y, dz = p.z - center.z;
      const d = nx * dx + ny * dy + nz * dz;
      
      const newX = p.x - nx * d, newY = p.y - ny * d, newZ = p.z - nz * d;
      const newDx = newX - center.x, newDy = newY - center.y, newDz = newZ - center.z;
      const newDist = Math.sqrt(newDx * newDx + newDy * newDy + newDz * newDz);
      const origDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (newDist > 0.0001 && origDist > 0.0001) {
        const scale = origDist / newDist;
        atom.position = { x: center.x + newDx * scale, y: center.y + newDy * scale, z: center.z + newDz * scale };
      }
    }
  });
  
  return { ...molecule, atoms };
}

export function adjustToCollinear(molecule: any, atomIds: string[]): any {
  const constraintCheck = checkRigidConstraintsForCollinear(molecule, atomIds);
  if (!constraintCheck.canAdjust) {
    return null;
  }
  
  const atoms = [...molecule.atoms];
  const selectedAtoms = atoms.filter(atom => atomIds.includes(atom.id));
  if (selectedAtoms.length < 3) return molecule;
  
  const center = { x: 0, y: 0, z: 0 };
  selectedAtoms.forEach((atom: { position: { x: number; y: number; z: number } }) => {
    center.x += atom.position.x;
    center.y += atom.position.y;
    center.z += atom.position.z;
  });
  center.x /= selectedAtoms.length;
  center.y /= selectedAtoms.length;
  center.z /= selectedAtoms.length;
  
  const p1 = selectedAtoms[0].position;
  const p2 = selectedAtoms[1].position;
  
  let dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 0.0001) return molecule;
  
  dx /= len; dy /= len; dz /= len;
  
  atoms.forEach(atom => {
    if (atomIds.includes(atom.id)) {
      const p = atom.position;
      const cx = p.x - center.x, cy = p.y - center.y, cz = p.z - center.z;
      const dot = cx * dx + cy * dy + cz * dz;
      atom.position = { x: center.x + dx * dot, y: center.y + dy * dot, z: center.z + dz * dot };
    }
  });
  
  return { ...molecule, atoms };
}

export function canAdjustToCoplanar(molecule: any, atomIds: string[]): { canAdjust: boolean; reason: string } {
  const check = checkRigidConstraintsForCoplanar(molecule, atomIds);
  return { canAdjust: check.canAdjust, reason: check.reason };
}

export function canAdjustToCollinear(molecule: any, atomIds: string[]): { canAdjust: boolean; reason: string } {
  const check = checkRigidConstraintsForCollinear(molecule, atomIds);
  return { canAdjust: check.canAdjust, reason: check.reason };
}

export function canInsertLineAtoms(molecule: any, atomIds: string[]): { canInsert: boolean; reason: string } {
  if (atomIds.length < 2) {
    return { canInsert: false, reason: '需要至少2个原子才能插入参考线' };
  }
  
  const selectedAtoms = molecule.atoms.filter((atom: any) => atomIds.includes(atom.id));
  
  const p1 = selectedAtoms[0].position;
  const p2 = selectedAtoms[1].position;
  
  for (let i = 2; i < selectedAtoms.length; i++) {
    const p3 = selectedAtoms[i].position;
    
    const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
    const v2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
    
    const crossX = v1.y * v2.z - v1.z * v2.y;
    const crossY = v1.z * v2.x - v1.x * v2.z;
    const crossZ = v1.x * v2.y - v1.y * v2.x;
    const crossMag = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
    
    if (crossMag > 0.0001) {
      return { canInsert: false, reason: '选中的原子不共线，无法插入参考线' };
    }
  }
  
  return { canInsert: true, reason: '选中的原子共线' };
}

export function canInsertPlaneAtoms(molecule: any, atomIds: string[]): { canInsert: boolean; reason: string } {
  if (atomIds.length < 3) {
    return { canInsert: false, reason: '需要至少3个原子才能插入参考平面' };
  }
  
  const selectedAtoms = molecule.atoms.filter((atom: any) => atomIds.includes(atom.id));
  
  for (let i = 0; i < selectedAtoms.length; i++) {
    for (let j = i + 1; j < selectedAtoms.length; j++) {
      for (let k = j + 1; k < selectedAtoms.length; k++) {
        const p1 = selectedAtoms[i].position;
        const p2 = selectedAtoms[j].position;
        const p3 = selectedAtoms[k].position;
        
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
        const v2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
        
        for (let l = k + 1; l < selectedAtoms.length; l++) {
          const p4 = selectedAtoms[l].position;
          const v3 = { x: p4.x - p1.x, y: p4.y - p1.y, z: p4.z - p1.z };
          
          const crossX = v1.y * v2.z - v1.z * v2.y;
          const crossY = v1.z * v2.x - v1.x * v2.z;
          const crossZ = v1.x * v2.y - v1.y * v2.x;
          const scalarTriple = crossX * v3.x + crossY * v3.y + crossZ * v3.z;
          
          if (Math.abs(scalarTriple) > 0.0001) {
            return { canInsert: false, reason: '选中的原子不共面，无法插入参考平面' };
          }
        }
      }
    }
  }
  
  return { canInsert: true, reason: '选中的原子共面' };
}

export function calculateLineThroughAtoms(molecule: any, atomIds: string[]): { center: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } } {
  const selectedAtoms = molecule.atoms.filter((atom: any) => atomIds.includes(atom.id));
  
  const center = { x: 0, y: 0, z: 0 };
  selectedAtoms.forEach((atom: { position: { x: number; y: number; z: number } }) => {
    center.x += atom.position.x;
    center.y += atom.position.y;
    center.z += atom.position.z;
  });
  center.x /= selectedAtoms.length;
  center.y /= selectedAtoms.length;
  center.z /= selectedAtoms.length;
  
  const p1 = selectedAtoms[0].position;
  const p2 = selectedAtoms[1].position;
  
  let direction = {
    x: p2.x - p1.x,
    y: p2.y - p1.y,
    z: p2.z - p1.z
  };
  
  const len = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
  if (len > 0.0001) {
    direction.x /= len;
    direction.y /= len;
    direction.z /= len;
  } else {
    direction = { x: 1, y: 0, z: 0 };
  }
  
  return { center, direction };
}

export function calculatePlaneThroughAtoms(molecule: any, atomIds: string[]): { center: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } } {
  const selectedAtoms = molecule.atoms.filter((atom: any) => atomIds.includes(atom.id));
  
  const center = { x: 0, y: 0, z: 0 };
  selectedAtoms.forEach((atom: { position: { x: number; y: number; z: number } }) => {
    center.x += atom.position.x;
    center.y += atom.position.y;
    center.z += atom.position.z;
  });
  center.x /= selectedAtoms.length;
  center.y /= selectedAtoms.length;
  center.z /= selectedAtoms.length;
  
  const p1 = selectedAtoms[0].position;
  const p2 = selectedAtoms[1].position;
  const p3 = selectedAtoms[2].position;
  
  const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
  const v2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
  
  let normal = {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x
  };
  
  const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
  if (len > 0.0001) {
    normal.x /= len;
    normal.y /= len;
    normal.z /= len;
  } else {
    normal = { x: 0, y: 0, z: 1 };
  }
  
  return { center, normal };
}

// ==================== 查找刚性约束组（手掌模式用） ====================

// 获取与一个原子有刚性约束关系的所有原子组
export function findRigidGroup(molecule: Molecule, startAtomId: string): string[] {
  const visited = new Set<string>();
  const group: string[] = [];
  
  // 使用DFS查找所有与起点有刚性约束关系的原子
  const dfs = (currentId: string) => {
    if (visited.has(currentId)) return;
    visited.add(currentId);
    group.push(currentId);
    
    const { connectedAtoms } = getBondInfo(molecule, currentId);
    
    for (const conn of connectedAtoms) {
      const { bonded, order } = areDirectlyBonded(molecule, currentId, conn.atomId);
      if (!bonded) continue;
      
      // 双键和三键是刚性的，必须一起移动
      if (order >= 2) {
        dfs(conn.atomId);
      }
      
      // 苯环中的键也是刚性的
      const { isInRing } = isInBenzeneRing(molecule, currentId);
      if (isInRing) {
        dfs(conn.atomId);
      }
      
      // 双键或苯环相连的原子也应该保持刚性
      const connAtom = molecule.atoms.find(a => a.id === conn.atomId);
      if (connAtom && connAtom.hybridization === 'sp2') {
        dfs(conn.atomId);
      }
    }
  };
  
  dfs(startAtomId);
  
  // 扩展到直接连接到刚性组的H原子
  const hydrogenToAdd: string[] = [];
  for (const atomId of group) {
    const { connectedAtoms } = getBondInfo(molecule, atomId);
    for (const conn of connectedAtoms) {
      const connAtom = molecule.atoms.find(a => a.id === conn.atomId);
      if (connAtom && connAtom.symbol === 'H' && !group.includes(conn.atomId)) {
        hydrogenToAdd.push(conn.atomId);
      }
    }
  }
  
  return [...group, ...hydrogenToAdd];
}

// 检查一组原子是否可以在保持刚性约束的情况下一起移动
export function canMoveRigidGroup(molecule: Molecule, atomIds: string[]): {
  canMove: boolean;
  reason: string;
} {
  // 如果只有一个原子，通常可以自由移动（除非有特殊约束）
  if (atomIds.length === 1) {
    const atom = molecule.atoms.find(a => a.id === atomIds[0]);
    if (atom && atom.symbol === 'H') {
      // H原子通常可以自由移动，只要是单键连接
      return { canMove: true, reason: '单个H原子可以自由移动' };
    }
  }
  
  // 检查是否包含双键或苯环等刚性结构
  let hasRigidStructure = false;
  
  for (const bond of molecule.bonds) {
    if (bond.atom1Id !== null && bond.atom2Id !== null && atomIds.includes(bond.atom1Id) && atomIds.includes(bond.atom2Id)) {
      if (bond.order >= 2) {
        hasRigidStructure = true;
        break;
      }
    }
  }
  
  for (const atomId of atomIds) {
    const { isInRing } = isInBenzeneRing(molecule, atomId);
    if (isInRing) {
      hasRigidStructure = true;
      break;
    }
  }
  
  if (hasRigidStructure) {
    return { canMove: true, reason: '包含刚性结构（双键/苯环），可作为整体移动' };
  }
  
  // 其他情况也允许移动
  return { canMove: true, reason: '可作为整体移动' };
}

// ==================== 分子结构验证系统 ====================

export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
  atomIds?: string[];
  bondIds?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

// 标准键长（埃）
const STANDARD_BOND_LENGTHS: Record<string, Record<number, number>> = {
  'C-C': { 1: 1.54, 2: 1.34, 3: 1.20 },
  'C-H': { 1: 1.09 },
  'C-O': { 1: 1.43, 2: 1.22 },
  'O-H': { 1: 0.96 },
  'C-N': { 1: 1.47, 2: 1.29, 3: 1.16 },
  'N-H': { 1: 1.01 },
  'O-O': { 1: 1.48 },
  'C-F': { 1: 1.35 },
  'C-Cl': { 1: 1.77 },
  'C-Br': { 1: 1.94 },
  'C-I': { 1: 2.14 },
  'S-H': { 1: 1.35 },
  'P-H': { 1: 1.42 },
};

// 标准键角（度）
const STANDARD_BOND_ANGLES: Record<string, number> = {
  'sp3': 109.5,
  'sp2': 120,
  'sp': 180,
};

function getDistance(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dz = p2.z - p1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function getAngle(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }, p3: { x: number; y: number; z: number }): number {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
  
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cosAngle = dot / (mag1 * mag2);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
}

// 获取标准键长
function getStandardBondLength(symbol1: string, symbol2: string, order: number): number {
  const key1 = `${symbol1}-${symbol2}`;
  const key2 = `${symbol2}-${symbol1}`;
  return STANDARD_BOND_LENGTHS[key1]?.[order] || STANDARD_BOND_LENGTHS[key2]?.[order] || 1.54;
}

// 根据杂化类型生成理想键方向（3D空间）
function getIdealDirections3D(hybridization: string, count: number): { x: number; y: number; z: number }[] {
  if (hybridization === 'sp3' && count === 4) {
    // 正四面体：109.5度
    return [
      { x: 1, y: 1, z: 1 },
      { x: -1, y: -1, z: 1 },
      { x: -1, y: 1, z: -1 },
      { x: 1, y: -1, z: -1 },
    ].map(d => {
      const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      return { x: d.x / len, y: d.y / len, z: d.z / len };
    });
  } else if (hybridization === 'sp3' && count === 3) {
    // 正四面体的3个顶点：109.5度间隔（取前3个四面体顶点）
    return [
      { x: 1, y: 1, z: 1 },
      { x: -1, y: -1, z: 1 },
      { x: -1, y: 1, z: -1 },
    ].map(d => {
      const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
      return { x: d.x / len, y: d.y / len, z: d.z / len };
    });
  } else if (hybridization === 'sp2' && count === 3) {
    // 平面三角形：120度间隔
    return [
      { x: 1, y: 0, z: 0 },
      { x: -0.5, y: Math.sqrt(3) / 2, z: 0 },
      { x: -0.5, y: -Math.sqrt(3) / 2, z: 0 },
    ];
  } else if (hybridization === 'sp' && count === 2) {
    // 直线：180度
    return [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
    ];
  }
  // 默认：均匀分布在球面上
  const dirs: { x: number; y: number; z: number }[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * i) / (count - 1 || 1);
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    dirs.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }
  return dirs;
}

// 计算3D旋转：将向量 fromDir 旋转到 toDir 的四元数
function computeRotationQuaternion(fromDir: { x: number; y: number; z: number }, toDir: { x: number; y: number; z: number }): { x: number; y: number; z: number; w: number } {
  const dot = fromDir.x * toDir.x + fromDir.y * toDir.y + fromDir.z * toDir.z;
  if (dot > 0.9999) return { x: 0, y: 0, z: 0, w: 1 }; // 已经对齐
  if (dot < -0.9999) {
    // 反方向：找任意垂直轴旋转180度
    const perp = Math.abs(fromDir.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const crossX = fromDir.y * perp.z - fromDir.z * perp.y;
    const crossY = fromDir.z * perp.x - fromDir.x * perp.z;
    const crossZ = fromDir.x * perp.y - fromDir.y * perp.x;
    const len = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
    return { x: crossX / len, y: crossY / len, z: crossZ / len, w: 0 };
  }
  // 叉积得到旋转轴
  const crossX = fromDir.y * toDir.z - fromDir.z * toDir.y;
  const crossY = fromDir.z * toDir.x - fromDir.x * toDir.z;
  const crossZ = fromDir.x * toDir.y - fromDir.y * toDir.x;
  const s = Math.sqrt((1 + dot) * 2);
  return { x: crossX / s, y: crossY / s, z: crossZ / s, w: s / 2 };
}

// 用四元数旋转向量
function rotateVector(v: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }): { x: number; y: number; z: number } {
  // Rodrigues' rotation formula: v' = v + 2*w*(u×v) + 2*(u×(u×v))
  // where u = (q.x, q.y, q.z), w = q.w
  const t = { x: q.y * v.z - q.z * v.y, y: q.z * v.x - q.x * v.z, z: q.x * v.y - q.y * v.x };
  const ut = { x: q.y * t.z - q.z * t.y, y: q.z * t.x - q.x * t.z, z: q.x * t.y - q.y * t.x };
  return {
    x: v.x + 2 * q.w * t.x + 2 * ut.x,
    y: v.y + 2 * q.w * t.y + 2 * ut.y,
    z: v.z + 2 * q.w * t.z + 2 * ut.z,
  };
}

// 键吸附后优化原子周围的几何结构
// 只移动H原子和空头键，重原子（非H）保持不动
// excludeAtomIds: 额外排除的原子（如公团侧已平移到位的原子）
export function optimizeGeometryAroundAtom(
  molecule: Molecule,
  centerAtomId: string,
  updateAtomPosition: (atomId: string, position: { x: number; y: number; z: number }) => void,
  updateBondPosition?: (bondId: string, params: { atom1Position?: { x: number; y: number; z: number }; atom2Position?: { x: number; y: number; z: number } }) => void,
  excludeAtomIds?: Set<string>
): void {
  const centerAtom = molecule.atoms.find(a => a.id === centerAtomId);
  if (!centerAtom) return;

  // 获取中心原子所有的键
  const atomBonds = molecule.bonds.filter(b => b.atom1Id === centerAtomId || b.atom2Id === centerAtomId);
  if (atomBonds.length < 2) return;

  // 获取所有邻居（包括原子和空头键）
  interface Neighbor {
    type: 'atom' | 'empty';
    atomId?: string;
    atom?: Atom;
    bondId: string;
    bondOrder: number;
    endpoint: 'atom1' | 'atom2';
    currentPosition: { x: number; y: number; z: number };
  }

  const neighbors: Neighbor[] = [];
  for (const bond of atomBonds) {
    if (bond.atom1Id === centerAtomId) {
      if (bond.atom2Id !== null) {
        const neighbor = molecule.atoms.find(a => a.id === bond.atom2Id);
        if (neighbor) {
          neighbors.push({
            type: 'atom', atomId: bond.atom2Id, atom: neighbor,
            bondId: bond.id, bondOrder: bond.order, endpoint: 'atom2',
            currentPosition: neighbor.position
          });
        }
      } else if (bond.atom2Position) {
        neighbors.push({
          type: 'empty', bondId: bond.id, bondOrder: bond.order, endpoint: 'atom2',
          currentPosition: bond.atom2Position
        });
      }
    } else if (bond.atom2Id === centerAtomId) {
      if (bond.atom1Id !== null) {
        const neighbor = molecule.atoms.find(a => a.id === bond.atom1Id);
        if (neighbor) {
          neighbors.push({
            type: 'atom', atomId: bond.atom1Id, atom: neighbor,
            bondId: bond.id, bondOrder: bond.order, endpoint: 'atom1',
            currentPosition: neighbor.position
          });
        }
      } else if (bond.atom1Position) {
        neighbors.push({
          type: 'empty', bondId: bond.id, bondOrder: bond.order, endpoint: 'atom1',
          currentPosition: bond.atom1Position
        });
      }
    }
  }

  if (neighbors.length < 2) return;

  // 构建排除集：外部传入的 + 所有非H原子（重原子不动）
  const allExclude = new Set<string>(excludeAtomIds || []);
  for (const n of neighbors) {
    if (n.type === 'atom' && n.atom && n.atom.symbol !== 'H') {
      allExclude.add(n.atomId!);
    }
  }

  // 第一步：修正H和空头键的键长（重原子不动）
  for (const neighbor of neighbors) {
    if (neighbor.type === 'atom' && allExclude.has(neighbor.atomId!)) continue;

    const neighborSymbol = neighbor.type === 'atom' && neighbor.atom ? neighbor.atom.symbol : 'C';
    const targetLength = getStandardBondLength(centerAtom.symbol, neighborSymbol, neighbor.bondOrder);
    const dx = neighbor.currentPosition.x - centerAtom.position.x;
    const dy = neighbor.currentPosition.y - centerAtom.position.y;
    const dz = neighbor.currentPosition.z - centerAtom.position.z;
    const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (currentLength > 0.01 && Math.abs(currentLength - targetLength) > 0.05) {
      const scale = targetLength / currentLength;
      const newPos = {
        x: centerAtom.position.x + dx * scale,
        y: centerAtom.position.y + dy * scale,
        z: centerAtom.position.z + dz * scale,
      };

      if (neighbor.type === 'atom' && neighbor.atomId) {
        updateAtomPosition(neighbor.atomId, newPos);
        if (neighbor.atom) neighbor.atom = { ...neighbor.atom, position: newPos };
      } else if (neighbor.type === 'empty' && updateBondPosition) {
        const params: { atom1Position?: { x: number; y: number; z: number }; atom2Position?: { x: number; y: number; z: number } } = {};
        params[neighbor.endpoint === 'atom1' ? 'atom1Position' : 'atom2Position'] = newPos;
        updateBondPosition(neighbor.bondId, params);
      }
      neighbor.currentPosition = newPos;
    }
  }

  // 第二步：修正键角（只移动H和空头键，重原子作为锚点不动）
  const hybridization = centerAtom.hybridization || 'sp3';
  const idealDirs = getIdealDirections3D(hybridization, neighbors.length);
  if (idealDirs.length !== neighbors.length) return;
  if (neighbors.length === 2) return;

  // 选择锚点：优先选择被排除的重原子（不动），其次选第一个邻居
  let anchorIdx = neighbors.findIndex(n =>
    n.type === 'atom' && n.atomId && allExclude.has(n.atomId)
  );
  if (anchorIdx < 0) anchorIdx = 0;

  const anchorDir = {
    x: neighbors[anchorIdx].currentPosition.x - centerAtom.position.x,
    y: neighbors[anchorIdx].currentPosition.y - centerAtom.position.y,
    z: neighbors[anchorIdx].currentPosition.z - centerAtom.position.z,
  };
  const anchorLen = Math.sqrt(anchorDir.x * anchorDir.x + anchorDir.y * anchorDir.y + anchorDir.z * anchorDir.z);
  if (anchorLen < 0.001) return;

  const anchorDirNorm = { x: anchorDir.x / anchorLen, y: anchorDir.y / anchorLen, z: anchorDir.z / anchorLen };
  const rotQuat = computeRotationQuaternion(idealDirs[anchorIdx], anchorDirNorm);
  const rotatedIdeals = idealDirs.map(d => rotateVector(d, rotQuat));

  for (let i = 0; i < neighbors.length; i++) {
    if (i === anchorIdx) continue;

    const n = neighbors[i];
    // 跳过排除的原子（重原子）
    if (n.type === 'atom' && n.atomId && allExclude.has(n.atomId)) continue;

    const neighborSymbol = n.type === 'atom' && n.atom ? n.atom.symbol : 'C';
    const targetLength = getStandardBondLength(centerAtom.symbol, neighborSymbol, n.bondOrder);
    const idealDir = rotatedIdeals[i];
    const newPos = {
      x: centerAtom.position.x + idealDir.x * targetLength,
      y: centerAtom.position.y + idealDir.y * targetLength,
      z: centerAtom.position.z + idealDir.z * targetLength,
    };

    if (n.type === 'atom' && n.atomId) {
      updateAtomPosition(n.atomId, newPos);
    } else if (n.type === 'empty' && updateBondPosition) {
      const params: { atom1Position?: { x: number; y: number; z: number }; atom2Position?: { x: number; y: number; z: number } } = {};
      params[n.endpoint === 'atom1' ? 'atom1Position' : 'atom2Position'] = newPos;
      updateBondPosition(n.bondId, params);
    }
  }
}

// 收集以 atomId 为根的刚性子树（沿单键遍历，不经过双键/三键/环内键）
// 返回子树中所有原子ID和空头键ID
function collectRigidSubtree(
  molecule: Molecule,
  rootAtomId: string,
  excludeAtomIds: Set<string>
): { atomIds: Set<string>; emptyBondIds: Set<string> } {
  const atomIds = new Set<string>();
  const emptyBondIds = new Set<string>();
  const visited = new Set<string>(excludeAtomIds);
  const queue: string[] = [rootAtomId];
  visited.add(rootAtomId);

  while (queue.length > 0) {
    const curId = queue.shift()!;
    atomIds.add(curId);
    const bonds = molecule.bonds.filter(b => b.atom1Id === curId || b.atom2Id === curId);
    for (const b of bonds) {
      const neighborId = b.atom1Id === curId ? b.atom2Id : b.atom1Id;
      if (neighborId !== null && !visited.has(neighborId)) {
        visited.add(neighborId);
        // 只沿单键遍历（双键/三键是刚性的，不旋转）
        if (b.order === 1) {
          queue.push(neighborId);
        } else {
          atomIds.add(neighborId); // 双键/三键连接的原子也属于子树，但不继续遍历
        }
      } else if (neighborId === null) {
        // 空头键
        emptyBondIds.add(b.id);
      }
    }
  }
  return { atomIds, emptyBondIds };
}

// 检测两组原子之间是否有范德华冲突
function detectCollision(
  molecule: Molecule,
  groupA: Set<string>,
  groupB: Set<string>
): boolean {
  for (const idA of groupA) {
    const atomA = molecule.atoms.find(a => a.id === idA);
    if (!atomA) continue;
    for (const idB of groupB) {
      if (groupA.has(idB)) continue; // 同组跳过
      const atomB = molecule.atoms.find(a => a.id === idB);
      if (!atomB) continue;
      const dist = getDistance(atomA.position, atomB.position);
      const vdwSum = getVdwRadius(atomA.symbol) + getVdwRadius(atomB.symbol);
      if (dist < vdwSum * 0.7) return true;
    }
  }
  return false;
}

// 绕轴旋转一个点
function rotatePointAroundAxis(
  point: { x: number; y: number; z: number },
  axisOrigin: { x: number; y: number; z: number },
  axisDir: { x: number; y: number; z: number },
  angle: number
): { x: number; y: number; z: number } {
  // 将点平移到轴原点
  const p = { x: point.x - axisOrigin.x, y: point.y - axisOrigin.y, z: point.z - axisOrigin.z };
  // 归一化轴方向
  const len = Math.sqrt(axisDir.x * axisDir.x + axisDir.y * axisDir.y + axisDir.z * axisDir.z);
  const n = { x: axisDir.x / len, y: axisDir.y / len, z: axisDir.z / len };
  // Rodrigues 旋转公式
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dot = p.x * n.x + p.y * n.y + p.z * n.z;
  const cross = {
    x: n.y * p.z - n.z * p.y,
    y: n.z * p.x - n.x * p.z,
    z: n.x * p.y - n.y * p.x,
  };
  return {
    x: axisOrigin.x + p.x * cos + cross.x * sin + n.x * dot * (1 - cos),
    y: axisOrigin.y + p.y * cos + cross.y * sin + n.y * dot * (1 - cos),
    z: axisOrigin.z + p.z * cos + cross.z * sin + n.z * dot * (1 - cos),
  };
}

// 拼接时保持官能团刚体姿态：
// 1. 沿锚点方向平移公团到标准键长
// 2. 检测空间冲突，如有冲突则绕连接键旋转母团可旋转子树以规避
export function adjustAtomPreserveSubtree(
  molecule: Molecule,
  centerAtomId: string,
  anchorAtomId: string,
  updateAtomPosition: (atomId: string, position: { x: number; y: number; z: number }) => void,
  updateBondPosition?: (bondId: string, params: { atom1Position?: { x: number; y: number; z: number }; atom2Position?: { x: number; y: number; z: number } }) => void
): void {
  const centerAtom = molecule.atoms.find(a => a.id === centerAtomId);
  const anchorAtom = molecule.atoms.find(a => a.id === anchorAtomId);
  if (!centerAtom || !anchorAtom) return;

  // 计算当前 center→anchor 方向和距离
  const dx = centerAtom.position.x - anchorAtom.position.x;
  const dy = centerAtom.position.y - anchorAtom.position.y;
  const dz = centerAtom.position.z - anchorAtom.position.z;
  const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (currentLength < 0.01) return;

  // 获取键级
  const bond = molecule.bonds.find(b =>
    (b.atom1Id === centerAtomId && b.atom2Id === anchorAtomId) ||
    (b.atom1Id === anchorAtomId && b.atom2Id === centerAtomId)
  );
  const order = bond?.order || 1;
  const targetLength = getStandardBondLength(anchorAtom.symbol, centerAtom.symbol, order);

  // 如果键长已经足够接近，跳过平移
  if (Math.abs(currentLength - targetLength) > 0.05) {
    const scale = targetLength / currentLength;
    const newCenterPos = {
      x: anchorAtom.position.x + dx * scale,
      y: anchorAtom.position.y + dy * scale,
      z: anchorAtom.position.z + dz * scale,
    };
    const offsetX = newCenterPos.x - centerAtom.position.x;
    const offsetY = newCenterPos.y - centerAtom.position.y;
    const offsetZ = newCenterPos.z - centerAtom.position.z;

    // 移动中心原子
    updateAtomPosition(centerAtomId, newCenterPos);

    // 平移公团子树（所有通过键连接的非锚点原子和空头键）
    const atomBonds = molecule.bonds.filter(b =>
      b.atom1Id === centerAtomId || b.atom2Id === centerAtomId
    );
    for (const b of atomBonds) {
      if (b.atom1Id === centerAtomId) {
        if (b.atom2Id !== null && b.atom2Id !== anchorAtomId) {
          const neighbor = molecule.atoms.find(a => a.id === b.atom2Id);
          if (neighbor) {
            updateAtomPosition(b.atom2Id, {
              x: neighbor.position.x + offsetX,
              y: neighbor.position.y + offsetY,
              z: neighbor.position.z + offsetZ,
            });
          }
        } else if (b.atom2Id === null && b.atom2Position && updateBondPosition) {
          updateBondPosition(b.id, {
            atom2Position: {
              x: b.atom2Position.x + offsetX,
              y: b.atom2Position.y + offsetY,
              z: b.atom2Position.z + offsetZ,
            },
          });
        }
      } else if (b.atom2Id === centerAtomId) {
        if (b.atom1Id !== null && b.atom1Id !== anchorAtomId) {
          const neighbor = molecule.atoms.find(a => a.id === b.atom1Id);
          if (neighbor) {
            updateAtomPosition(b.atom1Id, {
              x: neighbor.position.x + offsetX,
              y: neighbor.position.y + offsetY,
              z: neighbor.position.z + offsetZ,
            });
          }
        } else if (b.atom1Id === null && b.atom1Position && updateBondPosition) {
          updateBondPosition(b.id, {
            atom1Position: {
              x: b.atom1Position.x + offsetX,
              y: b.atom1Position.y + offsetY,
              z: b.atom1Position.z + offsetZ,
            },
          });
        }
      }
    }
  }

  // 空间冲突检测和旋转规避
  // 收集公团原子（centerAtom 及其子树，不含 anchorAtom）
  const publicAtoms = collectRigidSubtree(molecule, centerAtomId, new Set([anchorAtomId]));
  // 收集母团原子（anchorAtom 及其子树，不含 centerAtom）
  const privateAtoms = collectRigidSubtree(molecule, anchorAtomId, new Set([centerAtomId]));

  if (detectCollision(molecule, publicAtoms.atomIds, privateAtoms.atomIds)) {
    // 有冲突：以连接键为轴，旋转母团可旋转子树
    const axisDir = {
      x: centerAtom.position.x - anchorAtom.position.x,
      y: centerAtom.position.y - anchorAtom.position.y,
      z: centerAtom.position.z - anchorAtom.position.z,
    };

    // 找到母团中可旋转的子结构（通过单键连接到 anchorAtom 的重原子子树）
    const rotatableBonds = molecule.bonds.filter(b => {
      if (b.order !== 1) return false; // 只旋转单键
      if (b.atom1Id === anchorAtomId && b.atom2Id !== null && b.atom2Id !== centerAtomId) return true;
      if (b.atom2Id === anchorAtomId && b.atom1Id !== null && b.atom1Id !== centerAtomId) return true;
      return false;
    });

    // 尝试每30°旋转一次，找到无冲突的角度
    for (const rb of rotatableBonds) {
      const childId = rb.atom1Id === anchorAtomId ? rb.atom2Id : rb.atom1Id;
      if (!childId) continue;

      // 收集这个子树
      const subtree = collectRigidSubtree(molecule, childId, new Set([anchorAtomId]));

      let bestAngle = 0;
      let bestCollision = true;

      for (let deg = 30; deg < 360; deg += 30) {
        const angle = (deg * Math.PI) / 180;
        // 模拟旋转后检测冲突
        let hasCollision = false;
        for (const sid of subtree.atomIds) {
          const sAtom = molecule.atoms.find(a => a.id === sid);
          if (!sAtom) continue;
          const rotated = rotatePointAroundAxis(sAtom.position, anchorAtom.position, axisDir, angle);
          for (const pid of publicAtoms.atomIds) {
            const pAtom = molecule.atoms.find(a => a.id === pid);
            if (!pAtom) continue;
            const dist = getDistance(rotated, pAtom.position);
            const vdwSum = getVdwRadius(sAtom.symbol) + getVdwRadius(pAtom.symbol);
            if (dist < vdwSum * 0.7) { hasCollision = true; break; }
          }
          if (hasCollision) break;
        }

        if (!hasCollision) {
          bestAngle = angle;
          bestCollision = false;
          break;
        }
      }

      if (!bestCollision) {
        // 应用最佳旋转角度
        for (const sid of subtree.atomIds) {
          const sAtom = molecule.atoms.find(a => a.id === sid);
          if (!sAtom) continue;
          const rotated = rotatePointAroundAxis(sAtom.position, anchorAtom.position, axisDir, bestAngle);
          updateAtomPosition(sid, rotated);
        }
        // 旋转空头键
        if (updateBondPosition) {
          for (const ebId of subtree.emptyBondIds) {
            const eb = molecule.bonds.find(b => b.id === ebId);
            if (!eb) continue;
            if (eb.atom1Id !== null && subtree.atomIds.has(eb.atom1Id) && eb.atom2Position) {
              const rotated = rotatePointAroundAxis(eb.atom2Position, anchorAtom.position, axisDir, bestAngle);
              updateBondPosition(ebId, { atom2Position: rotated });
            } else if (eb.atom2Id !== null && subtree.atomIds.has(eb.atom2Id) && eb.atom1Position) {
              const rotated = rotatePointAroundAxis(eb.atom1Position, anchorAtom.position, axisDir, bestAngle);
              updateBondPosition(ebId, { atom1Position: rotated });
            }
          }
        }
      }
    }
  }
}

// 查找分子中所有环的原子ID集合（用于键角检查时排除环内原子）
function findRingAtomSets(molecule: Molecule): Set<string>[] {
  const atomIndexMap = new Map<string, number>();
  molecule.atoms.forEach((a, i) => atomIndexMap.set(a.id, i));
  const n = molecule.atoms.length;
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (const b of molecule.bonds) {
    if (b.atom1Id === null || b.atom2Id === null) continue;
    const i = atomIndexMap.get(b.atom1Id);
    const j = atomIndexMap.get(b.atom2Id);
    if (i !== undefined && j !== undefined) {
      adj[i].add(j);
      adj[j].add(i);
    }
  }

  const rings: Set<string>[] = [];
  const visited = new Set<number>();

  for (let start = 0; start < n; start++) {
    if (visited.has(start)) continue;
    // BFS找环：记录每个节点的父节点和深度
    const parent = new Map<number, number>();
    const depth = new Map<number, number>();
    const queue: number[] = [start];
    depth.set(start, 0);
    parent.set(start, -1);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curDepth = depth.get(cur)!;
      visited.add(cur);

      for (const nb of adj[cur]) {
        if (!depth.has(nb)) {
          depth.set(nb, curDepth + 1);
          parent.set(nb, cur);
          queue.push(nb);
        } else if (nb !== parent.get(cur)) {
          // 找到环：回溯到LCA
          const ringAtoms = new Set<string>();
          let a = cur, b = nb;
          const pathA: number[] = [], pathB: number[] = [];
          // 将两条路径回溯到相同深度
          while (depth.get(a)! > depth.get(b)!) { pathA.push(a); a = parent.get(a)!; }
          while (depth.get(b)! > depth.get(a)!) { pathB.push(b); b = parent.get(b)!; }
          // 回溯到LCA
          while (a !== b) { pathA.push(a); pathB.push(b); a = parent.get(a)!; b = parent.get(b)!; }
          pathA.push(a); // LCA
          for (const idx of pathA) ringAtoms.add(molecule.atoms[idx].id);
          for (const idx of pathB) ringAtoms.add(molecule.atoms[idx].id);
          // 去重：只添加新环
          if (!rings.some(r => r.size === ringAtoms.size && [...ringAtoms].every(id => r.has(id)))) {
            rings.push(ringAtoms);
          }
        }
      }
    }
  }

  return rings;
}

export function validateMolecule(molecule: Molecule): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  // 预计算原子对之间的拓扑距离（键路径长度），用于排除1,3/1,4/1,5-位关系的范德华误报
  const atomIndexMap = new Map<string, number>();
  molecule.atoms.forEach((a, i) => atomIndexMap.set(a.id, i));
  const n = molecule.atoms.length;
  // 邻接表
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const b of molecule.bonds) {
    if (b.atom1Id === null || b.atom2Id === null) continue;
    const i = atomIndexMap.get(b.atom1Id);
    const j = atomIndexMap.get(b.atom2Id);
    if (i !== undefined && j !== undefined) {
      adj[i].push(j);
      adj[j].push(i);
    }
  }
  // BFS计算所有原子对的拓扑距离
  const topoDist: Map<number, number>[] = [];
  for (let start = 0; start < n; start++) {
    const dist = new Map<number, number>();
    const queue: number[] = [start];
    dist.set(start, 0);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const d = dist.get(cur)!;
      for (const nb of adj[cur]) {
        if (!dist.has(nb)) {
          dist.set(nb, d + 1);
          queue.push(nb);
        }
      }
    }
    topoDist.push(dist);
  }
  
  // 1. 检查范德华半径（原子重叠）
  for (let i = 0; i < molecule.atoms.length; i++) {
    for (let j = i + 1; j < molecule.atoms.length; j++) {
      const atom1 = molecule.atoms[i];
      const atom2 = molecule.atoms[j];
      const distance = getDistance(atom1.position, atom2.position);
      const vdwSum = getVdwRadius(atom1.symbol) + getVdwRadius(atom2.symbol);
      
      const bondDist = topoDist[i].get(j) ?? Infinity;
      // 排除1,2到1,6关系的近距离接触（正常分子几何的必然结果）
      if (bondDist <= 5) continue;
      if (distance < vdwSum * 0.8) {
        issues.push({
          type: 'error',
          message: `范德华冲突：${atom1.symbol}与${atom2.symbol}距离过近 (${distance.toFixed(2)} Å < ${(vdwSum * 0.8).toFixed(2)} Å)`,
          atomIds: [atom1.id, atom2.id]
        });
      } else if (distance < vdwSum) {
        issues.push({
          type: 'warning',
          message: `范德华接触：${atom1.symbol}与${atom2.symbol}距离较近 (${distance.toFixed(2)} Å < ${vdwSum.toFixed(2)} Å)`,
          atomIds: [atom1.id, atom2.id]
        });
      }
    }
  }
  
  // 2. 检查键长
  for (const bond of molecule.bonds) {
    const atom1 = molecule.atoms.find(a => a.id === bond.atom1Id);
    const atom2 = molecule.atoms.find(a => a.id === bond.atom2Id);
    
    if (!atom1 || !atom2) continue;
    
    const distance = getDistance(atom1.position, atom2.position);
    const key = `${atom1.symbol}-${atom2.symbol}`;
    const reverseKey = `${atom2.symbol}-${atom1.symbol}`;
    
    let expectedLength = STANDARD_BOND_LENGTHS[key]?.[bond.order] || STANDARD_BOND_LENGTHS[reverseKey]?.[bond.order];
    
    if (expectedLength) {
      const deviation = Math.abs(distance - expectedLength) / expectedLength * 100;
      
      if (deviation > 20) {
        issues.push({
          type: 'error',
          message: `键长异常：${atom1.symbol}-${atom2.symbol}键长${distance.toFixed(2)} Å，预期${expectedLength} Å，偏差${deviation.toFixed(1)}%`,
          bondIds: [bond.id]
        });
      } else if (deviation > 10) {
        issues.push({
          type: 'warning',
          message: `键长偏差：${atom1.symbol}-${atom2.symbol}键长${distance.toFixed(2)} Å，预期${expectedLength} Å，偏差${deviation.toFixed(1)}%`,
          bondIds: [bond.id]
        });
      }
    }
  }
  
  // 3. 检查键角（基于杂化类型）
  // 预计算环内原子集合，环内键角由环大小决定，不由杂化类型决定
  const ringAtomSets = findRingAtomSets(molecule);
  
  for (const atom of molecule.atoms) {
    if (atom.symbol !== 'C' && atom.symbol !== 'N' && atom.symbol !== 'O') continue;
    
    const hybridization = atom.hybridization;
    if (!hybridization) continue;
    
    const expectedAngle = STANDARD_BOND_ANGLES[hybridization];
    if (!expectedAngle) continue;
    
    const bonds = molecule.bonds.filter(
      b => b.atom1Id === atom.id || b.atom2Id === atom.id
    );
    
    if (bonds.length < 2) continue;
    
    const connectedAtoms = bonds.map(b => 
      molecule.atoms.find(a => a.id === (b.atom1Id === atom.id ? b.atom2Id : b.atom1Id))
    ).filter(Boolean);
    
    if (connectedAtoms.length < 2) continue;
    
    // 检查所有相邻键之间的角度
    for (let i = 0; i < connectedAtoms.length; i++) {
      for (let j = i + 1; j < connectedAtoms.length; j++) {
        // 如果三个原子都在同一个环内，跳过键角检查（环内键角由环大小决定）
        const allInSameRing = ringAtomSets.some(ringSet =>
          ringSet.has(atom.id) && ringSet.has(connectedAtoms[i]!.id) && ringSet.has(connectedAtoms[j]!.id)
        );
        if (allInSameRing) continue;

        const angle = getAngle(
          connectedAtoms[i]!.position,
          atom.position,
          connectedAtoms[j]!.position
        );
        
        const deviation = Math.abs(angle - expectedAngle);
        
        if (deviation > 30) {
          issues.push({
            type: 'error',
            message: `${atom.symbol}(${hybridization})键角异常：${connectedAtoms[i]!.symbol}-${atom.symbol}-${connectedAtoms[j]!.symbol}角度${angle.toFixed(1)}°，预期${expectedAngle}°，偏差${deviation.toFixed(1)}°`,
            atomIds: [connectedAtoms[i]!.id, atom.id, connectedAtoms[j]!.id]
          });
        } else if (deviation > 15) {
          issues.push({
            type: 'warning',
            message: `${atom.symbol}(${hybridization})键角偏差：${connectedAtoms[i]!.symbol}-${atom.symbol}-${connectedAtoms[j]!.symbol}角度${angle.toFixed(1)}°，预期${expectedAngle}°，偏差${deviation.toFixed(1)}°`,
            atomIds: [connectedAtoms[i]!.id, atom.id, connectedAtoms[j]!.id]
          });
        }
      }
    }
  }
  
  // 4. 检查双键原子是否共面
  for (const bond of molecule.bonds) {
    if (bond.order !== 2) continue;
    
    const atom1 = molecule.atoms.find(a => a.id === bond.atom1Id);
    const atom2 = molecule.atoms.find(a => a.id === bond.atom2Id);
    
    if (!atom1 || !atom2) continue;
    
    const connectedToAtom1 = molecule.bonds
      .filter(b => b.atom1Id === atom1.id && b.atom2Id !== atom2.id)
      .map(b => molecule.atoms.find(a => a.id === b.atom2Id))
      .filter(Boolean);
    
    const connectedToAtom2 = molecule.bonds
      .filter(b => b.atom1Id === atom2.id && b.atom2Id !== atom1.id)
      .map(b => molecule.atoms.find(a => a.id === b.atom2Id))
      .filter(Boolean);
    
    // 检查双键两端原子的取代基是否共面
    if (connectedToAtom1.length >= 1 && connectedToAtom2.length >= 1) {
      const planeCheck = checkCoplanarity(molecule.atoms, [
        connectedToAtom1[0]!.id,
        atom1.id,
        atom2.id,
        connectedToAtom2[0]!.id
      ]);
      
      if (!planeCheck.isCoplanar) {
        issues.push({
          type: 'warning',
          message: `${atom1.symbol}=${atom2.symbol}双键相关原子不共面`,
          atomIds: [connectedToAtom1[0]!.id, atom1.id, atom2.id, connectedToAtom2[0]!.id]
        });
      }
    }
  }
  
  return {
    isValid: issues.every(i => i.type === 'warning'),
    issues
  };
}

export function printValidationResult(result: ValidationResult): void {
  console.log('=== 分子结构验证结果 ===');
  console.log(`整体状态: ${result.isValid ? '✓ 验证通过' : '✗ 存在错误'}`);
  console.log('');
  
  if (result.issues.length === 0) {
    console.log('没有发现问题');
    return;
  }
  
  const errors = result.issues.filter(i => i.type === 'error');
  const warnings = result.issues.filter(i => i.type === 'warning');
  
  if (errors.length > 0) {
    console.log(`错误 (${errors.length}):`);
    errors.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.message}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log(`警告 (${warnings.length}):`);
    warnings.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.message}`);
    });
  }
}
