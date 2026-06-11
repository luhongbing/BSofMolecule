import type { Molecule } from '../types';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const ELEMENT_COLORS: Record<string, string> = {
  'H': '#FFFFFF',
  'C': '#666666',
  'N': '#3355FF',
  'O': '#FF3333',
  'F': '#88FF88',
  'Cl': '#22DD22',
  'Br': '#AA4422',
  'I': '#660066',
  'S': '#FFFF22',
  'P': '#FFAA00',
};

const getElementColor = (symbol: string): string => {
  return ELEMENT_COLORS[symbol] || '#FF00FF';
};

// 甲烷分子 - CH4
export function createMethaneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const bondLength = 1.09;
  const phi = Math.acos(-1 / 3);
  
  const cId = generateUUID();
  atoms.push({
    id: cId,
    symbol: 'C',
    position: { x: 0, y: 0, z: 0 },
    atomicNumber: 6,
    color: getElementColor('C'),
    hybridization: 'sp3'
  });
  
  const tetraAngles = [
    { x: 0, y: 0, z: 1 },
    { x: Math.sin(phi), y: 0, z: Math.cos(phi) },
    { x: Math.sin(phi) * Math.cos(2 * Math.PI / 3), y: Math.sin(phi) * Math.sin(2 * Math.PI / 3), z: Math.cos(phi) },
    { x: Math.sin(phi) * Math.cos(4 * Math.PI / 3), y: Math.sin(phi) * Math.sin(4 * Math.PI / 3), z: Math.cos(phi) }
  ];
  
  tetraAngles.forEach((dir) => {
    const hId = generateUUID();
    atoms.push({
      id: hId,
      symbol: 'H',
      position: { x: dir.x * bondLength, y: dir.y * bondLength, z: dir.z * bondLength },
      atomicNumber: 1,
      color: getElementColor('H')
    });
    bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: hId, order: 1 });
  });
  
  return { atoms, bonds };
}

// 乙烷分子 - C2H6
export function createEthaneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const ccBondLength = 1.54;
  const chBondLength = 1.09;
  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  
  const c1Id = generateUUID();
  const c2Id = generateUUID();
  
  const c1Pos = { x: -ccBondLength / 2, y: 0, z: 0 };
  const c2Pos = { x: ccBondLength / 2, y: 0, z: 0 };
  
  atoms.push({ id: c1Id, symbol: 'C', position: c1Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: c2Id, symbol: 'C', position: c2Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  
  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: c2Id, order: 1 });
  
  // 添加甲基H原子，angleOffset用于控制交叉式构象
  // 乙烷中C1和C2的H原子需要错开60°（π/3）形成staggered构象
  const addMethylHydrogens = (cPos: {x:number,y:number,z:number}, cId: string, direction: number, angleOffset: number = 0) => {
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI / 3) + angleOffset;
      const hId = generateUUID();
      atoms.push({
        id: hId,
        symbol: 'H',
        position: {
          x: cPos.x + direction * chBondLength * (-cosPhi),
          y: cPos.y + chBondLength * sinPhi * Math.cos(angle),
          z: cPos.z + chBondLength * sinPhi * Math.sin(angle)
        },
        atomicNumber: 1,
        color: getElementColor('H')
      });
      bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: hId, order: 1 });
    }
  };
  
  addMethylHydrogens(c1Pos, c1Id, -1, 0);
  addMethylHydrogens(c2Pos, c2Id, 1, Math.PI / 3);
  
  return { atoms, bonds };
}

// 乙烯分子 - C2H4
export function createEthyleneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const ccBondLength = 1.34;
  const chBondLength = 1.08;
  
  const c1Id = generateUUID();
  const c2Id = generateUUID();
  
  const c1Pos = { x: -ccBondLength / 2, y: 0, z: 0 };
  const c2Pos = { x: ccBondLength / 2, y: 0, z: 0 };
  
  atoms.push({ id: c1Id, symbol: 'C', position: c1Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: c2Id, symbol: 'C', position: c2Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  
  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: c2Id, order: 2 });
  
  // 乙烯是平面结构，120度键角
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);
  
  // C1的两个H原子：相对于C2的方向（+x方向）呈120度和-120度
  const h1Id = generateUUID();
  atoms.push({ id: h1Id, symbol: 'H', position: { 
    x: c1Pos.x + chBondLength * cos120, 
    y: c1Pos.y + chBondLength * sin120, 
    z: 0 
  }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: h1Id, order: 1 });
  
  const h2Id = generateUUID();
  atoms.push({ id: h2Id, symbol: 'H', position: { 
    x: c1Pos.x + chBondLength * cos120, 
    y: c1Pos.y - chBondLength * sin120, 
    z: 0 
  }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: h2Id, order: 1 });
  
  // C2的两个H原子：相对于C1的方向（-x方向）呈120度和-120度
  const h3Id = generateUUID();
  atoms.push({ id: h3Id, symbol: 'H', position: { 
    x: c2Pos.x - chBondLength * cos120, 
    y: c2Pos.y + chBondLength * sin120, 
    z: 0 
  }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: h3Id, order: 1 });
  
  const h4Id = generateUUID();
  atoms.push({ id: h4Id, symbol: 'H', position: { 
    x: c2Pos.x - chBondLength * cos120, 
    y: c2Pos.y - chBondLength * sin120, 
    z: 0 
  }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: h4Id, order: 1 });
  
  return { atoms, bonds };
}

// 乙炔分子 - C2H2
export function createAcetyleneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const ccBondLength = 1.20;
  const chBondLength = 1.06;
  
  const c1Id = generateUUID();
  const c2Id = generateUUID();
  
  atoms.push({ id: c1Id, symbol: 'C', position: { x: -ccBondLength / 2, y: 0, z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp' });
  atoms.push({ id: c2Id, symbol: 'C', position: { x: ccBondLength / 2, y: 0, z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp' });
  
  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: c2Id, order: 3 });
  
  const h1Id = generateUUID();
  atoms.push({ id: h1Id, symbol: 'H', position: { x: -ccBondLength / 2 - chBondLength, y: 0, z: 0 }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: h1Id, order: 1 });
  
  const h2Id = generateUUID();
  atoms.push({ id: h2Id, symbol: 'H', position: { x: ccBondLength / 2 + chBondLength, y: 0, z: 0 }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: h2Id, order: 1 });
  
  return { atoms, bonds };
}

// 丙烷分子 - C3H8
export function createPropaneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const cIds = [generateUUID(), generateUUID(), generateUUID()];
  const ccBondLength = 1.54;
  const chBondLength = 1.09;
  
  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  
  // 标准正四面体四个顶点（归一化后）
  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: cosPhi },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: cosPhi },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: cosPhi }
  ];
  
  // 旋转函数，将四面体方向向量旋转到指定主方向
  const rotateTetraToDirection = (mainDir: { x: number, y: number, z: number }) => {
    const len = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
    const nDir = { x: mainDir.x / len, y: mainDir.y / len, z: mainDir.z / len };
    
    const up = { x: 0, y: 0, z: 1 };
    let axis = { x: up.y * nDir.z - up.z * nDir.y, y: up.z * nDir.x - up.x * nDir.z, z: up.x * nDir.y - up.y * nDir.x };
    const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (axisLen < 0.001) { axis = { x: 1, y: 0, z: 0 }; }
    else { axis = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }; }
    
    const cosTheta = up.x * nDir.x + up.y * nDir.y + up.z * nDir.z;
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    
    return tetraDirs.map(p => ({
      x: p.x * cos + (axis.y * p.z - axis.z * p.y) * sin + axis.x * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      y: p.y * cos + (axis.z * p.x - axis.x * p.z) * sin + axis.y * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      z: p.z * cos + (axis.x * p.y - axis.y * p.x) * sin + axis.z * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos)
    }));
  };
  
  // 中心碳
  const c2Pos = { x: 0, y: 0, z: 0 };
  
  // 中心碳的四个四面体方向
  const c2Tetra = tetraDirs; // 不需要旋转，直接使用标准四面体
  
  // 左C在第一个方向，右C在第二个方向
  const c1Pos = {
    x: c2Pos.x + c2Tetra[0].x * ccBondLength,
    y: c2Pos.y + c2Tetra[0].y * ccBondLength,
    z: c2Pos.z + c2Tetra[0].z * ccBondLength
  };
  
  const c3Pos = {
    x: c2Pos.x + c2Tetra[1].x * ccBondLength,
    y: c2Pos.y + c2Tetra[1].y * ccBondLength,
    z: c2Pos.z + c2Tetra[1].z * ccBondLength
  };
  
  const cPositions = [c1Pos, c2Pos, c3Pos];
  
  cPositions.forEach((pos, idx) => {
    atoms.push({ id: cIds[idx], symbol: 'C', position: pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  });
  
  bonds.push({ id: generateUUID(), atom1Id: cIds[0], atom2Id: cIds[1], order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: cIds[1], atom2Id: cIds[2], order: 1 });
  
  // 端基碳的甲基H原子
  // rotateTetraToDirection后H原子与中心C的其他键形成重叠式构象
  // 需要绕C-C键轴额外旋转60°实现交叉式（staggered）构象
  const addMethylHydrogens = (cPos: { x: number, y: number, z: number }, cId: string, mainDir: { x: number, y: number, z: number }) => {
    const tetra = rotateTetraToDirection(mainDir);
    const mainDirLen = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
    const axis = { x: mainDir.x / mainDirLen, y: mainDir.y / mainDirLen, z: mainDir.z / mainDirLen };
    const staggerAngle = Math.PI / 3;
    const cosS = Math.cos(staggerAngle);
    const sinS = Math.sin(staggerAngle);

    tetra.slice(1, 4).forEach(dir => {
      // Rodrigues旋转：绕mainDir轴旋转60°
      const dot = axis.x * dir.x + axis.y * dir.y + axis.z * dir.z;
      const rotatedDir = {
        x: dir.x * cosS + (axis.y * dir.z - axis.z * dir.y) * sinS + axis.x * dot * (1 - cosS),
        y: dir.y * cosS + (axis.z * dir.x - axis.x * dir.z) * sinS + axis.y * dot * (1 - cosS),
        z: dir.z * cosS + (axis.x * dir.y - axis.y * dir.x) * sinS + axis.z * dot * (1 - cosS)
      };
      const hId = generateUUID();
      atoms.push({
        id: hId,
        symbol: 'H',
        position: {
          x: cPos.x + rotatedDir.x * chBondLength,
          y: cPos.y + rotatedDir.y * chBondLength,
          z: cPos.z + rotatedDir.z * chBondLength
        },
        atomicNumber: 1,
        color: getElementColor('H')
      });
      bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: hId, order: 1 });
    });
  };
  
  // 中心碳的两个H原子，使用第三、第四个四面体方向
  [2, 3].forEach(idx => {
    const dir = c2Tetra[idx];
    const hId = generateUUID();
    atoms.push({
      id: hId,
      symbol: 'H',
      position: {
        x: c2Pos.x + dir.x * chBondLength,
        y: c2Pos.y + dir.y * chBondLength,
        z: c2Pos.z + dir.z * chBondLength
      },
      atomicNumber: 1,
      color: getElementColor('H')
    });
    bonds.push({ id: generateUUID(), atom1Id: cIds[1], atom2Id: hId, order: 1 });
  });
  
  // 添加两个端基碳的H原子
  // mainDir应为从端基C指向中心C的方向（C-C键方向），
  // 这样rotateTetraToDirection后tetra[0]沿C-C键方向，tetra[1,2,3]在109.47°处放置H原子
  const c1ToC2Dir = {
    x: c2Pos.x - c1Pos.x,
    y: c2Pos.y - c1Pos.y,
    z: c2Pos.z - c1Pos.z
  };
  addMethylHydrogens(c1Pos, cIds[0], c1ToC2Dir);

  const c3ToC2Dir = {
    x: c2Pos.x - c3Pos.x,
    y: c2Pos.y - c3Pos.y,
    z: c2Pos.z - c3Pos.z
  };
  addMethylHydrogens(c3Pos, cIds[2], c3ToC2Dir);
  
  return { atoms, bonds };
}

// 环丙烷分子 - C3H6
export function createCyclopropaneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const ccBondLength = 1.51;
  const chBondLength = 1.09;
  
  const cIds = [generateUUID(), generateUUID(), generateUUID()];
  const radius = ccBondLength / (2 * Math.sin(Math.PI / 3));
  
  // C原子在XY平面形成正三角形
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * 2 * Math.PI;
    atoms.push({ id: cIds[i], symbol: 'C', position: { x: radius * Math.cos(angle), y: radius * Math.sin(angle), z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  }
  
  // C-C键
  bonds.push({ id: generateUUID(), atom1Id: cIds[0], atom2Id: cIds[1], order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: cIds[1], atom2Id: cIds[2], order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: cIds[2], atom2Id: cIds[0], order: 1 });
  
  // H原子：每个C的两个H分别在环平面的上下两侧
  for (let i = 0; i < 3; i++) {
    const cPos = atoms[i].position;
    const prevC = atoms[(i - 1 + 3) % 3].position;
    const nextC = atoms[(i + 1) % 3].position;
    
    // 计算C-C-C角的角平分线方向
    const v1 = { x: prevC.x - cPos.x, y: prevC.y - cPos.y, z: 0 };
    const v2 = { x: nextC.x - cPos.x, y: nextC.y - cPos.y, z: 0 };
    
    // 归一化
    const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const n1 = { x: v1.x / len1, y: v1.y / len1, z: 0 };
    const n2 = { x: v2.x / len2, y: v2.y / len2, z: 0 };
    
    // 角平分线（向内）
    const bisect = { x: (n1.x + n2.x) * -1, y: (n1.y + n2.y) * -1, z: 0 };
    const bisectLen = Math.sqrt(bisect.x * bisect.x + bisect.y * bisect.y);
    const bisectNorm = { x: bisect.x / bisectLen, y: bisect.y / bisectLen, z: 0 };
    
    // 环平面的法向量（z轴方向）
    const normal = { x: 0, y: 0, z: 1 };
    
    // 计算两个H的位置：在环平面的两侧，垂直于C-C-C平面
    const h1Dir = { 
      x: bisectNorm.x * 0.5 + normal.x * 0.866, 
      y: bisectNorm.y * 0.5 + normal.y * 0.866, 
      z: normal.z * 0.866 
    };
    const h2Dir = { 
      x: bisectNorm.x * 0.5 - normal.x * 0.866, 
      y: bisectNorm.y * 0.5 - normal.y * 0.866, 
      z: -normal.z * 0.866 
    };
    
    // 归一化方向向量
    const h1Len = Math.sqrt(h1Dir.x * h1Dir.x + h1Dir.y * h1Dir.y + h1Dir.z * h1Dir.z);
    const h2Len = Math.sqrt(h2Dir.x * h2Dir.x + h2Dir.y * h2Dir.y + h2Dir.z * h2Dir.z);
    const h1Norm = { x: h1Dir.x / h1Len, y: h1Dir.y / h1Len, z: h1Dir.z / h1Len };
    const h2Norm = { x: h2Dir.x / h2Len, y: h2Dir.y / h2Len, z: h2Dir.z / h2Len };
    
    const h1Id = generateUUID();
    atoms.push({ id: h1Id, symbol: 'H', position: { 
      x: cPos.x + h1Norm.x * chBondLength, 
      y: cPos.y + h1Norm.y * chBondLength, 
      z: cPos.z + h1Norm.z * chBondLength 
    }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cIds[i], atom2Id: h1Id, order: 1 });
    
    const h2Id = generateUUID();
    atoms.push({ id: h2Id, symbol: 'H', position: { 
      x: cPos.x + h2Norm.x * chBondLength, 
      y: cPos.y + h2Norm.y * chBondLength, 
      z: cPos.z + h2Norm.z * chBondLength 
    }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cIds[i], atom2Id: h2Id, order: 1 });
  }
  
  return { atoms, bonds };
}

// 苯分子 - C6H6
export function createBenzeneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const ccBondLength = 1.39;
  const hexRadius = ccBondLength / (2 * Math.sin(Math.PI / 6));
  const chBondLength = 1.08;
  
  const cIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const cId = generateUUID();
    cIds.push(cId);
    atoms.push({ id: cId, symbol: 'C', position: { x: hexRadius * Math.cos(angle), y: hexRadius * Math.sin(angle), z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  }
  
  for (let i = 0; i < 6; i++) {
    const order = i % 2 === 0 ? 2 : 1;
    bonds.push({ id: generateUUID(), atom1Id: cIds[i], atom2Id: cIds[(i + 1) % 6], order: order });
  }
  
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: hexRadius * Math.cos(angle) + chBondLength * Math.cos(angle), y: hexRadius * Math.sin(angle) + chBondLength * Math.sin(angle), z: 0 }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cIds[i], atom2Id: hId, order: 1 });
  }
  
  return { atoms, bonds };
}

// 甲苯分子 - C6H5CH3
export function createTolueneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const ccBondLength = 1.39;
  const hexRadius = ccBondLength / (2 * Math.sin(Math.PI / 6));
  const chBondLength = 1.08;
  const methylCCBondLength = 1.51;

  const cRingIds: string[] = [];

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const cId = generateUUID();
    cRingIds.push(cId);
    atoms.push({ id: cId, symbol: 'C', position: { x: hexRadius * Math.cos(angle), y: hexRadius * Math.sin(angle), z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  }

  for (let i = 0; i < 6; i++) {
    const order = i % 2 === 0 ? 2 : 1;
    bonds.push({ id: generateUUID(), atom1Id: cRingIds[i], atom2Id: cRingIds[(i + 1) % 6], order: order });
  }

  for (let i = 1; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: hexRadius * Math.cos(angle) + chBondLength * Math.cos(angle), y: hexRadius * Math.sin(angle) + chBondLength * Math.sin(angle), z: 0 }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cRingIds[i], atom2Id: hId, order: 1 });
  }

  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const methylCPos = { x: hexRadius + methylCCBondLength, y: 0, z: 0 };
  const methylCId = generateUUID();
  atoms.push({ id: methylCId, symbol: 'C', position: methylCPos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  bonds.push({ id: generateUUID(), atom1Id: cRingIds[0], atom2Id: methylCId, order: 1 });

  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: methylCPos.x - chBondLength * cosPhi, y: methylCPos.y + chBondLength * sinPhi * Math.cos(angle), z: methylCPos.z + chBondLength * sinPhi * Math.sin(angle) }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: methylCId, atom2Id: hId, order: 1 });
  }

  return { atoms, bonds };
}

// 丙酮分子 - CH3COCH3
export function createAcetoneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const c1Id = generateUUID();
  const c2Id = generateUUID();
  const c3Id = generateUUID();
  const oId = generateUUID();

  const ccBondLength = 1.51;
  const coBondLength = 1.22;
  const chBondLength = 1.09;

  // C2是sp2，三个键(C1, C3, O)互成120°
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);
  const c2Pos = { x: 0, y: 0, z: 0 };
  // C1在-120°方向，C3在120°方向，O在0°(正上方)
  const c1Pos = { x: c2Pos.x + ccBondLength * cos120, y: c2Pos.y + ccBondLength * (-sin120), z: 0 };
  const c3Pos = { x: c2Pos.x + ccBondLength * cos120, y: c2Pos.y + ccBondLength * sin120, z: 0 };
  const oPos = { x: c2Pos.x + coBondLength, y: c2Pos.y, z: 0 };

  atoms.push({ id: c1Id, symbol: 'C', position: c1Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: c2Id, symbol: 'C', position: c2Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: c3Id, symbol: 'C', position: c3Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: oId, symbol: 'O', position: oPos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp2' });

  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: c2Id, order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: c3Id, order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: oId, order: 2 });

  // 甲基H原子：使用rotateTetraToDirectionLocal + Rodrigues旋转实现交叉式
  const c1ToC2Dir = { x: c2Pos.x - c1Pos.x, y: c2Pos.y - c1Pos.y, z: 0 };
  const c3ToC2Dir = { x: c2Pos.x - c3Pos.x, y: c2Pos.y - c3Pos.y, z: 0 };
  const sinPhi = Math.sin(Math.acos(-1 / 3));
  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: Math.cos(Math.acos(-1 / 3)) },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: Math.cos(Math.acos(-1 / 3)) },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: Math.cos(Math.acos(-1 / 3)) }
  ];

  // C1甲基
  const c1Tetra = rotateTetraToDirectionLocal(tetraDirs, c1ToC2Dir);
  const c1AxisLen = Math.sqrt(c1ToC2Dir.x * c1ToC2Dir.x + c1ToC2Dir.y * c1ToC2Dir.y);
  const c1Axis = { x: c1ToC2Dir.x / c1AxisLen, y: c1ToC2Dir.y / c1AxisLen, z: 0 };
  c1Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotateLocal(dir, c1Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c1Pos.x + rotatedDir.x * chBondLength, y: c1Pos.y + rotatedDir.y * chBondLength, z: c1Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: hId, order: 1 });
  });

  // C3甲基
  const c3Tetra = rotateTetraToDirectionLocal(tetraDirs, c3ToC2Dir);
  const c3AxisLen = Math.sqrt(c3ToC2Dir.x * c3ToC2Dir.x + c3ToC2Dir.y * c3ToC2Dir.y);
  const c3Axis = { x: c3ToC2Dir.x / c3AxisLen, y: c3ToC2Dir.y / c3AxisLen, z: 0 };
  c3Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotateLocal(dir, c3Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c3Pos.x + rotatedDir.x * chBondLength, y: c3Pos.y + rotatedDir.y * chBondLength, z: c3Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c3Id, atom2Id: hId, order: 1 });
  });

  return { atoms, bonds };
}

// 丙苯分子 - C6H5-CH2CH2CH3
export function createPropylbenzeneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const ccBondLength = 1.39;
  const hexRadius = ccBondLength / (2 * Math.sin(Math.PI / 6));
  const chBondLength = 1.08;
  const methylCCBondLength = 1.51;

  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // 标准正四面体方向
  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: cosPhi },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: cosPhi },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: cosPhi }
  ];

  const rotateTetraToDirection = (mainDir: { x: number, y: number, z: number }) => {
    const len = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
    const nDir = { x: mainDir.x / len, y: mainDir.y / len, z: mainDir.z / len };
    const up = { x: 0, y: 0, z: 1 };
    let axis = { x: up.y * nDir.z - up.z * nDir.y, y: up.z * nDir.x - up.x * nDir.z, z: up.x * nDir.y - up.y * nDir.x };
    const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (axisLen < 0.001) { axis = { x: 1, y: 0, z: 0 }; }
    else { axis = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }; }
    const cosTheta = up.x * nDir.x + up.y * nDir.y + up.z * nDir.z;
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return tetraDirs.map(p => ({
      x: p.x * cos + (axis.y * p.z - axis.z * p.y) * sin + axis.x * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      y: p.y * cos + (axis.z * p.x - axis.x * p.z) * sin + axis.y * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      z: p.z * cos + (axis.x * p.y - axis.y * p.x) * sin + axis.z * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos)
    }));
  };

  const rodriguesRotate = (v: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number }, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
    return {
      x: v.x * cos + (axis.y * v.z - axis.z * v.y) * sin + axis.x * dot * (1 - cos),
      y: v.y * cos + (axis.z * v.x - axis.x * v.z) * sin + axis.y * dot * (1 - cos),
      z: v.z * cos + (axis.x * v.y - axis.y * v.x) * sin + axis.z * dot * (1 - cos)
    };
  };

  // 苯环
  const cRingIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const cId = generateUUID();
    cRingIds.push(cId);
    atoms.push({ id: cId, symbol: 'C', position: { x: hexRadius * Math.cos(angle), y: hexRadius * Math.sin(angle), z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  }

  for (let i = 0; i < 6; i++) {
    const order = i % 2 === 0 ? 2 : 1;
    bonds.push({ id: generateUUID(), atom1Id: cRingIds[i], atom2Id: cRingIds[(i + 1) % 6], order: order });
  }

  for (let i = 1; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: hexRadius * Math.cos(angle) + chBondLength * Math.cos(angle), y: hexRadius * Math.sin(angle) + chBondLength * Math.sin(angle), z: 0 }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cRingIds[i], atom2Id: hId, order: 1 });
  }

  // 丙基链：C7(sp3)-C8(sp3)-C9(sp3)，锯齿形构象
  const cos109 = -1 / 3;
  const sin109 = Math.sqrt(8) / 3;

  const c7Pos = { x: hexRadius + methylCCBondLength, y: 0, z: 0 };
  const c7Id = generateUUID();
  atoms.push({ id: c7Id, symbol: 'C', position: c7Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  bonds.push({ id: generateUUID(), atom1Id: cRingIds[0], atom2Id: c7Id, order: 1 });

  // C8: 从C7出发，与C7→苯环方向形成109.5°角，向上偏转
  const c8Pos = { x: c7Pos.x + methylCCBondLength * (-cos109), y: c7Pos.y + methylCCBondLength * sin109, z: 0 };
  const c8Id = generateUUID();
  atoms.push({ id: c8Id, symbol: 'C', position: c8Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  bonds.push({ id: generateUUID(), atom1Id: c7Id, atom2Id: c8Id, order: 1 });

  // C9: 锯齿形，C8→C9方向与C7→C0方向平行（水平向右），与C8→C7形成109.5°角
  const c9Pos = { x: c8Pos.x + methylCCBondLength, y: c8Pos.y, z: 0 };
  const c9Id = generateUUID();
  atoms.push({ id: c9Id, symbol: 'C', position: c9Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  bonds.push({ id: generateUUID(), atom1Id: c8Id, atom2Id: c9Id, order: 1 });

  // C7亚甲基H：邻居是苯环C0和C8，使用四面体零和性质
  const c7ToC0Dir = { x: hexRadius * Math.cos(0) - c7Pos.x, y: hexRadius * Math.sin(0) - c7Pos.y, z: 0 };
  const c7ToC8Dir = { x: c8Pos.x - c7Pos.x, y: c8Pos.y - c7Pos.y, z: 0 };
  const addMethyleneH = (cPos: { x: number, y: number, z: number }, cId: string, d1Raw: { x: number, y: number, z: number }, d2Raw: { x: number, y: number, z: number }) => {
    const d1Len = Math.sqrt(d1Raw.x * d1Raw.x + d1Raw.y * d1Raw.y + d1Raw.z * d1Raw.z);
    const d2Len = Math.sqrt(d2Raw.x * d2Raw.x + d2Raw.y * d2Raw.y + d2Raw.z * d2Raw.z);
    const d1 = { x: d1Raw.x / d1Len, y: d1Raw.y / d1Len, z: d1Raw.z / d1Len };
    const d2 = { x: d2Raw.x / d2Len, y: d2Raw.y / d2Len, z: d2Raw.z / d2Len };
    const halfSum = { x: -(d1.x + d2.x) / 2, y: -(d1.y + d2.y) / 2, z: -(d1.z + d2.z) / 2 };
    const normal = { x: d1.y * d2.z - d1.z * d2.y, y: d1.z * d2.x - d1.x * d2.z, z: d1.x * d2.y - d1.y * d2.x };
    const nLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    const n = { x: normal.x / nLen, y: normal.y / nLen, z: normal.z / nLen };
    const t = Math.sqrt(2 / 3);
    const h1Dir = { x: halfSum.x + t * n.x, y: halfSum.y + t * n.y, z: halfSum.z + t * n.z };
    const h2Dir = { x: halfSum.x - t * n.x, y: halfSum.y - t * n.y, z: halfSum.z - t * n.z };
    const h1Len = Math.sqrt(h1Dir.x * h1Dir.x + h1Dir.y * h1Dir.y + h1Dir.z * h1Dir.z);
    const h2Len = Math.sqrt(h2Dir.x * h2Dir.x + h2Dir.y * h2Dir.y + h2Dir.z * h2Dir.z);
    const h1 = { x: h1Dir.x / h1Len, y: h1Dir.y / h1Len, z: h1Dir.z / h1Len };
    const h2 = { x: h2Dir.x / h2Len, y: h2Dir.y / h2Len, z: h2Dir.z / h2Len };
    const h1Id = generateUUID();
    atoms.push({ id: h1Id, symbol: 'H', position: { x: cPos.x + h1.x * chBondLength, y: cPos.y + h1.y * chBondLength, z: cPos.z + h1.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: h1Id, order: 1 });
    const h2Id = generateUUID();
    atoms.push({ id: h2Id, symbol: 'H', position: { x: cPos.x + h2.x * chBondLength, y: cPos.y + h2.y * chBondLength, z: cPos.z + h2.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: h2Id, order: 1 });
  };

  addMethyleneH(c7Pos, c7Id, c7ToC0Dir, c7ToC8Dir);

  // C8亚甲基H：邻居是C7和C9
  const c8ToC7Dir = { x: c7Pos.x - c8Pos.x, y: c7Pos.y - c8Pos.y, z: 0 };
  const c8ToC9Dir = { x: c9Pos.x - c8Pos.x, y: c9Pos.y - c8Pos.y, z: 0 };
  addMethyleneH(c8Pos, c8Id, c8ToC7Dir, c8ToC9Dir);

  // C9端基甲基H：基于C-C键方向旋转四面体+60°交叉式
  const c9ToC8Dir = { x: c8Pos.x - c9Pos.x, y: c8Pos.y - c9Pos.y, z: 0 };
  const c9Tetra = rotateTetraToDirection(c9ToC8Dir);
  const c9AxisLen = Math.sqrt(c9ToC8Dir.x * c9ToC8Dir.x + c9ToC8Dir.y * c9ToC8Dir.y + c9ToC8Dir.z * c9ToC8Dir.z);
  const c9Axis = { x: c9ToC8Dir.x / c9AxisLen, y: c9ToC8Dir.y / c9AxisLen, z: c9ToC8Dir.z / c9AxisLen };
  c9Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotate(dir, c9Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c9Pos.x + rotatedDir.x * chBondLength, y: c9Pos.y + rotatedDir.y * chBondLength, z: c9Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c9Id, atom2Id: hId, order: 1 });
  });

  return { atoms, bonds };
}

// 异丙苯分子 - C6H5-CH(CH3)2
export function createCumeneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const ccBondLength = 1.39;
  const hexRadius = ccBondLength / (2 * Math.sin(Math.PI / 6));
  const chBondLength = 1.08;
  const methylCCBondLength = 1.51;

  const phi = Math.acos(-1 / 3);

  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: Math.sin(phi), y: 0, z: Math.cos(phi) },
    { x: Math.sin(phi) * Math.cos(2 * Math.PI / 3), y: Math.sin(phi) * Math.sin(2 * Math.PI / 3), z: Math.cos(phi) },
    { x: Math.sin(phi) * Math.cos(4 * Math.PI / 3), y: Math.sin(phi) * Math.sin(4 * Math.PI / 3), z: Math.cos(phi) }
  ];

  const rotateTetraToDirection = (mainDir: { x: number, y: number, z: number }): { x: number, y: number, z: number }[] => {
    const len = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
    const nDir = { x: mainDir.x / len, y: mainDir.y / len, z: mainDir.z / len };
    const up = { x: 0, y: 0, z: 1 };
    let axis = { x: up.y * nDir.z - up.z * nDir.y, y: up.z * nDir.x - up.x * nDir.z, z: up.x * nDir.y - up.y * nDir.x };
    const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (axisLen < 0.001) { axis = { x: 1, y: 0, z: 0 }; }
    else { axis = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }; }
    const cosTheta = up.x * nDir.x + up.y * nDir.y + up.z * nDir.z;
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return tetraDirs.map(dir => ({
      x: dir.x * cos + (axis.y * dir.z - axis.z * dir.y) * sin + axis.x * (axis.x * dir.x + axis.y * dir.y + axis.z * dir.z) * (1 - cos),
      y: dir.y * cos + (axis.z * dir.x - axis.x * dir.z) * sin + axis.y * (axis.x * dir.x + axis.y * dir.y + axis.z * dir.z) * (1 - cos),
      z: dir.z * cos + (axis.x * dir.y - axis.y * dir.x) * sin + axis.z * (axis.x * dir.x + axis.y * dir.y + axis.z * dir.z) * (1 - cos)
    }));
  };

  const cRingIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const cId = generateUUID();
    cRingIds.push(cId);
    atoms.push({ id: cId, symbol: 'C', position: { x: hexRadius * Math.cos(angle), y: hexRadius * Math.sin(angle), z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  }

  for (let i = 0; i < 6; i++) {
    const order = i % 2 === 0 ? 2 : 1;
    bonds.push({ id: generateUUID(), atom1Id: cRingIds[i], atom2Id: cRingIds[(i + 1) % 6], order: order });
  }

  for (let i = 1; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: hexRadius * Math.cos(angle) + chBondLength * Math.cos(angle), y: hexRadius * Math.sin(angle) + chBondLength * Math.sin(angle), z: 0 }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cRingIds[i], atom2Id: hId, order: 1 });
  }

  const c7Pos = { x: hexRadius + methylCCBondLength, y: 0, z: 0 };
  const c7Id = generateUUID();
  atoms.push({ id: c7Id, symbol: 'C', position: c7Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  bonds.push({ id: generateUUID(), atom1Id: cRingIds[0], atom2Id: c7Id, order: 1 });

  const c8Dir = rotateTetraToDirection({ x: -1, y: 0, z: 0 })[1];
  const c8Pos = { x: c7Pos.x + c8Dir.x * methylCCBondLength, y: c7Pos.y + c8Dir.y * methylCCBondLength, z: c7Pos.z + c8Dir.z * methylCCBondLength };
  const c8Id = generateUUID();
  atoms.push({ id: c8Id, symbol: 'C', position: c8Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  bonds.push({ id: generateUUID(), atom1Id: c7Id, atom2Id: c8Id, order: 1 });

  const c9Dir = rotateTetraToDirection({ x: -1, y: 0, z: 0 })[2];
  const c9Pos = { x: c7Pos.x + c9Dir.x * methylCCBondLength, y: c7Pos.y + c9Dir.y * methylCCBondLength, z: c7Pos.z + c9Dir.z * methylCCBondLength };
  const c9Id = generateUUID();
  atoms.push({ id: c9Id, symbol: 'C', position: c9Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  bonds.push({ id: generateUUID(), atom1Id: c7Id, atom2Id: c9Id, order: 1 });

  const h7Dir = rotateTetraToDirection({ x: -1, y: 0, z: 0 })[3];
  const h7Id = generateUUID();
  atoms.push({ id: h7Id, symbol: 'H', position: { x: c7Pos.x + h7Dir.x * chBondLength, y: c7Pos.y + h7Dir.y * chBondLength, z: c7Pos.z + h7Dir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c7Id, atom2Id: h7Id, order: 1 });

  const c8ToC7Dir = { x: c7Pos.x - c8Pos.x, y: c7Pos.y - c8Pos.y, z: c7Pos.z - c8Pos.z };
  const c8Tetra = rotateTetraToDirection(c8ToC7Dir);
  const c8AxisLen = Math.sqrt(c8ToC7Dir.x * c8ToC7Dir.x + c8ToC7Dir.y * c8ToC7Dir.y + c8ToC7Dir.z * c8ToC7Dir.z);
  const c8Axis = { x: c8ToC7Dir.x / c8AxisLen, y: c8ToC7Dir.y / c8AxisLen, z: c8ToC7Dir.z / c8AxisLen };
  const rodriguesRotate = (v: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number }, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
    return {
      x: v.x * cos + (axis.y * v.z - axis.z * v.y) * sin + axis.x * dot * (1 - cos),
      y: v.y * cos + (axis.z * v.x - axis.x * v.z) * sin + axis.y * dot * (1 - cos),
      z: v.z * cos + (axis.x * v.y - axis.y * v.x) * sin + axis.z * dot * (1 - cos)
    };
  };
  c8Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotate(dir, c8Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c8Pos.x + rotatedDir.x * chBondLength, y: c8Pos.y + rotatedDir.y * chBondLength, z: c8Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c8Id, atom2Id: hId, order: 1 });
  });

  const c9ToC7Dir = { x: c7Pos.x - c9Pos.x, y: c7Pos.y - c9Pos.y, z: c7Pos.z - c9Pos.z };
  const c9Tetra = rotateTetraToDirection(c9ToC7Dir);
  const c9AxisLen = Math.sqrt(c9ToC7Dir.x * c9ToC7Dir.x + c9ToC7Dir.y * c9ToC7Dir.y + c9ToC7Dir.z * c9ToC7Dir.z);
  const c9Axis = { x: c9ToC7Dir.x / c9AxisLen, y: c9ToC7Dir.y / c9AxisLen, z: c9ToC7Dir.z / c9AxisLen };
  c9Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotate(dir, c9Axis, -Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c9Pos.x + rotatedDir.x * chBondLength, y: c9Pos.y + rotatedDir.y * chBondLength, z: c9Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c9Id, atom2Id: hId, order: 1 });
  });

  return { atoms, bonds };
}

// 均三甲苯（1,3,5-三甲基苯）分子
export function createMesityleneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const ccBondLength = 1.39;
  const hexRadius = ccBondLength / (2 * Math.sin(Math.PI / 6));
  const chBondLength = 1.08;
  const methylCCBondLength = 1.51;

  const cRingIds: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 2 * Math.PI;
    const cId = generateUUID();
    cRingIds.push(cId);
    atoms.push({ id: cId, symbol: 'C', position: { x: hexRadius * Math.cos(angle), y: hexRadius * Math.sin(angle), z: 0 }, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  }

  for (let i = 0; i < 6; i++) {
    const order = i % 2 === 0 ? 2 : 1;
    bonds.push({ id: generateUUID(), atom1Id: cRingIds[i], atom2Id: cRingIds[(i + 1) % 6], order: order });
  }

  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const addMethylGroup = (ringCPos: {x:number,y:number,z:number}, ringCId: string, angle: number) => {
    const methylCPos = {
      x: ringCPos.x + methylCCBondLength * Math.cos(angle),
      y: ringCPos.y + methylCCBondLength * Math.sin(angle),
      z: 0
    };
    const methylCId = generateUUID();
    atoms.push({ id: methylCId, symbol: 'C', position: methylCPos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
    bonds.push({ id: generateUUID(), atom1Id: ringCId, atom2Id: methylCId, order: 1 });

    for (let i = 0; i < 3; i++) {
      const hAngle = (i * 2 * Math.PI / 3);
      const hId = generateUUID();
      atoms.push({ id: hId, symbol: 'H', position: {
        x: methylCPos.x - chBondLength * cosPhi * Math.cos(angle) + chBondLength * sinPhi * Math.cos(hAngle) * Math.sin(angle),
        y: methylCPos.y - chBondLength * cosPhi * Math.sin(angle) - chBondLength * sinPhi * Math.cos(hAngle) * Math.cos(angle),
        z: chBondLength * sinPhi * Math.sin(hAngle)
      }, atomicNumber: 1, color: getElementColor('H') });
      bonds.push({ id: generateUUID(), atom1Id: methylCId, atom2Id: hId, order: 1 });
    }
  };

  addMethylGroup(atoms[0].position, cRingIds[0], 0);
  addMethylGroup(atoms[2].position, cRingIds[2], (2 / 6) * 2 * Math.PI);
  addMethylGroup(atoms[4].position, cRingIds[4], (4 / 6) * 2 * Math.PI);

  return { atoms, bonds };
}

// 水分子 - H2O
export function createWaterMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const ohBondLength = 0.96;
  const bondAngle = 104.5 * Math.PI / 180;
  
  const oId = generateUUID();
  atoms.push({ id: oId, symbol: 'O', position: { x: 0, y: 0, z: 0 }, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp3' });
  
  const h1Id = generateUUID();
  atoms.push({ id: h1Id, symbol: 'H', position: { x: -ohBondLength * Math.sin(bondAngle / 2), y: ohBondLength * Math.cos(bondAngle / 2), z: 0 }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: oId, atom2Id: h1Id, order: 1 });
  
  const h2Id = generateUUID();
  atoms.push({ id: h2Id, symbol: 'H', position: { x: ohBondLength * Math.sin(bondAngle / 2), y: ohBondLength * Math.cos(bondAngle / 2), z: 0 }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: oId, atom2Id: h2Id, order: 1 });
  
  return { atoms, bonds };
}

// 氨分子 - NH3
export function createAmmoniaMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];
  
  const nhBondLength = 1.01;
  const bondAngle = 107.8 * Math.PI / 180;
  
  const nId = generateUUID();
  atoms.push({ id: nId, symbol: 'N', position: { x: 0, y: 0, z: 0 }, atomicNumber: 7, color: getElementColor('N'), hybridization: 'sp3' });
  
  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: nhBondLength * Math.sin(bondAngle) * Math.cos(angle), y: nhBondLength * Math.sin(bondAngle) * Math.sin(angle), z: -nhBondLength * Math.cos(bondAngle) }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: nId, atom2Id: hId, order: 1 });
  }
  
  return { atoms, bonds };
}

// 乙酸分子 - CH3COOH
export function createAceticAcidMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const c1Id = generateUUID();
  const c2Id = generateUUID();
  const o1Id = generateUUID();
  const o2Id = generateUUID();
  const ohId = generateUUID();

  const ccBondLength = 1.54;
  const coBondLength = 1.22;
  const coSingleBondLength = 1.36;
  const ohBondLength = 0.96;
  const chBondLength = 1.09;
  
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);
  
  // O-H键与O-C键的夹角约为104.5°
  const ohAngle = 104.5 * Math.PI / 180;

  // C2（羧基碳，sp²）在原点
  const c2Pos = { x: 0, y: 0, z: 0 };
  
  // O1（双键氧）在+x方向
  const o1Pos = { x: coBondLength, y: 0, z: 0 };
  
  // O2（羟基氧）在120°方向
  const o2Pos = { 
    x: coSingleBondLength * cos120, 
    y: coSingleBondLength * sin120, 
    z: 0 
  };
  
  // 羟基H：在O2的另一侧，与O-C键成104.5°角
  // 使用旋转矩阵将O2-C2方向旋转104.5°
  const o2Angle = Math.atan2(o2Pos.y, o2Pos.x);
  const ohAngleFromO2 = o2Angle + Math.PI - ohAngle;
  const ohPos = {
    x: o2Pos.x + ohBondLength * Math.cos(ohAngleFromO2),
    y: o2Pos.y + ohBondLength * Math.sin(ohAngleFromO2),
    z: 0
  };
  
  // C1（甲基碳）在-120°方向（第三个sp²键）
  const c1Pos = { 
    x: ccBondLength * Math.cos(-120 * Math.PI / 180), 
    y: ccBondLength * Math.sin(-120 * Math.PI / 180), 
    z: 0 
  };

  atoms.push({ id: c2Id, symbol: 'C', position: c2Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: o1Id, symbol: 'O', position: o1Pos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp2' });
  atoms.push({ id: o2Id, symbol: 'O', position: o2Pos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp3' });
  atoms.push({ id: ohId, symbol: 'H', position: ohPos, atomicNumber: 1, color: getElementColor('H') });
  atoms.push({ id: c1Id, symbol: 'C', position: c1Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });

  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: o1Id, order: 2 });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: o2Id, order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: o2Id, atom2Id: ohId, order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: c1Id, order: 1 });

  // 甲基H：围绕C1形成四面体结构，远离羧基平面
  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // 找到从C1到C2的方向向量（作为四面体的一个轴）
  const c1c2Dir = { x: c2Pos.x - c1Pos.x, y: c2Pos.y - c1Pos.y, z: 0 };
  const c1c2Len = Math.sqrt(c1c2Dir.x * c1c2Dir.x + c1c2Dir.y * c1c2Dir.y);
  const c1c2Norm = { x: c1c2Dir.x / c1c2Len, y: c1c2Dir.y / c1c2Len, z: 0 };
  
  // 垂直于c1c2Dir的向量（在xy平面内）
  const perpDir = { x: -c1c2Norm.y, y: c1c2Norm.x, z: 0 };

  for (let i = 0; i < 3; i++) {
    const angle = (i * 2 * Math.PI / 3);
    const hId = generateUUID();
    // 三个H原子分布在垂直于C1-C2键的平面上，形成三角锥
    atoms.push({ id: hId, symbol: 'H', position: { 
      x: c1Pos.x + chBondLength * cosPhi * c1c2Norm.x + chBondLength * sinPhi * perpDir.x * Math.cos(angle), 
      y: c1Pos.y + chBondLength * cosPhi * c1c2Norm.y + chBondLength * sinPhi * perpDir.y * Math.cos(angle), 
      z: c1Pos.z + chBondLength * sinPhi * Math.sin(angle) 
    }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: hId, order: 1 });
  }

  return { atoms, bonds };
}

// 甲醇分子 - CH3OH
export function createMethanolMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const cId = generateUUID();
  const oId = generateUUID();

  const coBondLength = 1.43;
  const ohBondLength = 0.96;
  const chBondLength = 1.09;

  const cPos = { x: 0, y: 0, z: 0 };
  const oPos = { x: coBondLength, y: 0, z: 0 };

  atoms.push({ id: cId, symbol: 'C', position: cPos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: oId, symbol: 'O', position: oPos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp3' });

  bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: oId, order: 1 });

  // O-H键：O有2个邻居(C和H)，使用四面体方向
  // O→C方向是(-1,0,0)，H应在四面体剩余方向
  const phi = Math.acos(-1 / 3);
  const sinPhi = Math.sin(phi);
  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: Math.cos(phi) },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: Math.cos(phi) },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: Math.cos(phi) }
  ];
  const oToCDir = { x: cPos.x - oPos.x, y: cPos.y - oPos.y, z: 0 };
  const oTetra = rotateTetraToDirectionLocal(tetraDirs, oToCDir);
  const oAxisLen = Math.sqrt(oToCDir.x * oToCDir.x + oToCDir.y * oToCDir.y);
  const oAxis = { x: oToCDir.x / oAxisLen, y: oToCDir.y / oAxisLen, z: 0 };
  // O的H：取tetra[1]方向绕C-O键旋转60°
  const ohDir = rodriguesRotateLocal(oTetra[1], oAxis, Math.PI / 3);
  const ohPos = { x: oPos.x + ohDir.x * ohBondLength, y: oPos.y + ohDir.y * ohBondLength, z: oPos.z + ohDir.z * ohBondLength };
  const ohId = generateUUID();
  atoms.push({ id: ohId, symbol: 'H', position: ohPos, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: oId, atom2Id: ohId, order: 1 });

  // C的3个H原子（甲基）
  const cosPhi = Math.cos(phi);
  const cToODir = { x: oPos.x - cPos.x, y: oPos.y - cPos.y, z: 0 };
  const cTetra = rotateTetraToDirectionLocal(tetraDirs, cToODir);
  const cAxisLen = Math.sqrt(cToODir.x * cToODir.x + cToODir.y * cToODir.y);
  const cAxis = { x: cToODir.x / cAxisLen, y: cToODir.y / cAxisLen, z: 0 };
  cTetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotateLocal(dir, cAxis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: cPos.x + rotatedDir.x * chBondLength, y: cPos.y + rotatedDir.y * chBondLength, z: cPos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: hId, order: 1 });
  });

  return { atoms, bonds };
}

// 甲醛分子 - HCHO
export function createFormaldehydeMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const cId = generateUUID();
  const oId = generateUUID();

  const coBondLength = 1.22;
  const chBondLength = 1.10;
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);

  const cPos = { x: 0, y: 0, z: 0 };
  const oPos = { x: coBondLength, y: 0, z: 0 };

  atoms.push({ id: cId, symbol: 'C', position: cPos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: oId, symbol: 'O', position: oPos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp2' });

  bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: oId, order: 2 });

  // 醛基的两个H原子，与C=O双键呈120度角
  const h1Id = generateUUID();
  atoms.push({ id: h1Id, symbol: 'H', position: { 
    x: cPos.x + chBondLength * cos120, 
    y: cPos.y + chBondLength * sin120, 
    z: 0 
  }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: h1Id, order: 1 });

  const h2Id = generateUUID();
  atoms.push({ id: h2Id, symbol: 'H', position: { 
    x: cPos.x + chBondLength * cos120, 
    y: cPos.y - chBondLength * sin120, 
    z: 0 
  }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: h2Id, order: 1 });

  return { atoms, bonds };
}

// 甲酸分子 - HCOOH
export function createFormicAcidMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const cId = generateUUID();
  const o1Id = generateUUID();
  const o2Id = generateUUID();

  const coBondLength = 1.22;
  const coSingleBondLength = 1.36;
  const ohBondLength = 0.96;
  const chBondLength = 1.10;
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);
  
  // O-H键与O-C键的夹角约为104.5°
  const ohAngle = 104.5 * Math.PI / 180;

  const cPos = { x: 0, y: 0, z: 0 };
  const o1Pos = { x: coBondLength, y: 0, z: 0 };
  
  // O2与O1呈120度角
  const o2Pos = { 
    x: coSingleBondLength * cos120, 
    y: coSingleBondLength * sin120, 
    z: 0 
  };
  
  // 羟基H：与O-C键成104.5°角
  const o2Angle = Math.atan2(o2Pos.y, o2Pos.x);
  const ohAngleFromO2 = o2Angle + Math.PI - ohAngle;
  const ohPos = {
    x: o2Pos.x + ohBondLength * Math.cos(ohAngleFromO2),
    y: o2Pos.y + ohBondLength * Math.sin(ohAngleFromO2),
    z: 0
  };

  atoms.push({ id: cId, symbol: 'C', position: cPos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: o1Id, symbol: 'O', position: o1Pos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp2' });
  atoms.push({ id: o2Id, symbol: 'O', position: o2Pos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp3' });
  atoms.push({ id: generateUUID(), symbol: 'H', position: ohPos, atomicNumber: 1, color: getElementColor('H') });

  bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: o1Id, order: 2 });
  bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: o2Id, order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: o2Id, atom2Id: atoms[3].id, order: 1 });

  // 醛基的H原子，与C=O双键呈120度角（-120度方向）
  const hId = generateUUID();
  atoms.push({ id: hId, symbol: 'H', position: { 
    x: cPos.x + chBondLength * Math.cos(-120 * Math.PI / 180), 
    y: cPos.y + chBondLength * Math.sin(-120 * Math.PI / 180), 
    z: 0 
  }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: hId, order: 1 });

  return { atoms, bonds };
}

// 丁烷分子 - C4H10
export function createButaneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const ccBondLength = 1.54;
  const chBondLength = 1.09;
  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const cIds = [generateUUID(), generateUUID(), generateUUID(), generateUUID()];

  // 标准正四面体四个顶点（归一化后）
  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: cosPhi },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: cosPhi },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: cosPhi }
  ];

  // 旋转函数，将四面体方向向量旋转到指定主方向
  const rotateTetraToDirection = (mainDir: { x: number, y: number, z: number }) => {
    const len = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
    const nDir = { x: mainDir.x / len, y: mainDir.y / len, z: mainDir.z / len };

    const up = { x: 0, y: 0, z: 1 };
    let axis = { x: up.y * nDir.z - up.z * nDir.y, y: up.z * nDir.x - up.x * nDir.z, z: up.x * nDir.y - up.y * nDir.x };
    const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (axisLen < 0.001) { axis = { x: 1, y: 0, z: 0 }; }
    else { axis = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }; }

    const cosTheta = up.x * nDir.x + up.y * nDir.y + up.z * nDir.z;
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    return tetraDirs.map(p => ({
      x: p.x * cos + (axis.y * p.z - axis.z * p.y) * sin + axis.x * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      y: p.y * cos + (axis.z * p.x - axis.x * p.z) * sin + axis.y * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      z: p.z * cos + (axis.x * p.y - axis.y * p.x) * sin + axis.z * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos)
    }));
  };

  // 使用锯齿形构象，sp3杂化C原子键角109.5°
  const cos109 = -1 / 3;
  const sin109 = Math.sqrt(8) / 3;
  const cPositions = [
    { x: -ccBondLength, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    // C1→C2方向应与C1→C0方向(-x)形成109.5°角，所以x分量为-cos109=1/3
    { x: ccBondLength * (-cos109), y: ccBondLength * sin109, z: 0 },
    { x: ccBondLength * (-cos109) + ccBondLength, y: ccBondLength * sin109, z: 0 }
  ];

  cPositions.forEach((pos, idx) => {
    atoms.push({ id: cIds[idx], symbol: 'C', position: pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  });

  bonds.push({ id: generateUUID(), atom1Id: cIds[0], atom2Id: cIds[1], order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: cIds[1], atom2Id: cIds[2], order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: cIds[2], atom2Id: cIds[3], order: 1 });

  // Rodrigues旋转：绕axis轴旋转angle角
  const rodriguesRotate = (v: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number }, angle: number) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
    return {
      x: v.x * cos + (axis.y * v.z - axis.z * v.y) * sin + axis.x * dot * (1 - cos),
      y: v.y * cos + (axis.z * v.x - axis.x * v.z) * sin + axis.y * dot * (1 - cos),
      z: v.z * cos + (axis.x * v.y - axis.y * v.x) * sin + axis.z * dot * (1 - cos)
    };
  };

  // 添加端基甲基H原子：基于C-C键方向旋转四面体，再绕C-C键轴旋转60°实现交叉式构象
  const addMethylHydrogens = (cPos: { x: number, y: number, z: number }, cId: string, ccBondDir: { x: number, y: number, z: number }) => {
    const tetra = rotateTetraToDirection(ccBondDir);
    const axisLen = Math.sqrt(ccBondDir.x * ccBondDir.x + ccBondDir.y * ccBondDir.y + ccBondDir.z * ccBondDir.z);
    const axis = { x: ccBondDir.x / axisLen, y: ccBondDir.y / axisLen, z: ccBondDir.z / axisLen };

    tetra.slice(1, 4).forEach(dir => {
      const rotatedDir = rodriguesRotate(dir, axis, Math.PI / 3);
      const hId = generateUUID();
      atoms.push({
        id: hId,
        symbol: 'H',
        position: {
          x: cPos.x + rotatedDir.x * chBondLength,
          y: cPos.y + rotatedDir.y * chBondLength,
          z: cPos.z + rotatedDir.z * chBondLength
        },
        atomicNumber: 1,
        color: getElementColor('H')
      });
      bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: hId, order: 1 });
    });
  };

  // 添加亚甲基H原子：基于四面体零和性质 d1+d2+h1+h2=0
  const addMethyleneHydrogens = (cPos: { x: number, y: number, z: number }, cId: string, leftDir: { x: number, y: number, z: number }, rightDir: { x: number, y: number, z: number }) => {
    const leftLen = Math.sqrt(leftDir.x * leftDir.x + leftDir.y * leftDir.y + leftDir.z * leftDir.z);
    const rightLen = Math.sqrt(rightDir.x * rightDir.x + rightDir.y * rightDir.y + rightDir.z * rightDir.z);
    const d1 = { x: leftDir.x / leftLen, y: leftDir.y / leftLen, z: leftDir.z / leftLen };
    const d2 = { x: rightDir.x / rightLen, y: rightDir.y / rightLen, z: rightDir.z / rightLen };

    // 四面体零和：h1 + h2 = -(d1 + d2)
    // h1 = -(d1+d2)/2 + t*n, h2 = -(d1+d2)/2 - t*n
    // 其中n是d1-d2平面的法向量，t = sqrt(2/3)保证|hi|=1且hi·d1=-1/3
    const halfSum = { x: -(d1.x + d2.x) / 2, y: -(d1.y + d2.y) / 2, z: -(d1.z + d2.z) / 2 };

    const normal = {
      x: d1.y * d2.z - d1.z * d2.y,
      y: d1.z * d2.x - d1.x * d2.z,
      z: d1.x * d2.y - d1.y * d2.x
    };
    const normalLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    const n = { x: normal.x / normalLen, y: normal.y / normalLen, z: normal.z / normalLen };

    const t = Math.sqrt(2 / 3);

    const h1Dir = { x: halfSum.x + t * n.x, y: halfSum.y + t * n.y, z: halfSum.z + t * n.z };
    const h2Dir = { x: halfSum.x - t * n.x, y: halfSum.y - t * n.y, z: halfSum.z - t * n.z };

    // 归一化
    const h1Len = Math.sqrt(h1Dir.x * h1Dir.x + h1Dir.y * h1Dir.y + h1Dir.z * h1Dir.z);
    const h1 = { x: h1Dir.x / h1Len, y: h1Dir.y / h1Len, z: h1Dir.z / h1Len };
    const h2Len = Math.sqrt(h2Dir.x * h2Dir.x + h2Dir.y * h2Dir.y + h2Dir.z * h2Dir.z);
    const h2 = { x: h2Dir.x / h2Len, y: h2Dir.y / h2Len, z: h2Dir.z / h2Len };

    const h1Id = generateUUID();
    atoms.push({ id: h1Id, symbol: 'H', position: {
      x: cPos.x + h1.x * chBondLength,
      y: cPos.y + h1.y * chBondLength,
      z: cPos.z + h1.z * chBondLength
    }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: h1Id, order: 1 });

    const h2Id = generateUUID();
    atoms.push({ id: h2Id, symbol: 'H', position: {
      x: cPos.x + h2.x * chBondLength,
      y: cPos.y + h2.y * chBondLength,
      z: cPos.z + h2.z * chBondLength
    }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cId, atom2Id: h2Id, order: 1 });
  };

  // C0端基甲基：C-C键方向从C0指向C1
  const c0ToC1Dir = { x: cPositions[1].x - cPositions[0].x, y: cPositions[1].y - cPositions[0].y, z: cPositions[1].z - cPositions[0].z };
  addMethylHydrogens(cPositions[0], cIds[0], c0ToC1Dir);

  // C1亚甲基：邻居C0和C2
  const c1ToC0 = { x: cPositions[0].x - cPositions[1].x, y: cPositions[0].y - cPositions[1].y, z: cPositions[0].z - cPositions[1].z };
  const c1ToC2 = { x: cPositions[2].x - cPositions[1].x, y: cPositions[2].y - cPositions[1].y, z: cPositions[2].z - cPositions[1].z };
  addMethyleneHydrogens(cPositions[1], cIds[1], c1ToC0, c1ToC2);

  // C2亚甲基：邻居C1和C3
  const c2ToC1 = { x: cPositions[1].x - cPositions[2].x, y: cPositions[1].y - cPositions[2].y, z: cPositions[1].z - cPositions[2].z };
  const c2ToC3 = { x: cPositions[3].x - cPositions[2].x, y: cPositions[3].y - cPositions[2].y, z: cPositions[3].z - cPositions[2].z };
  addMethyleneHydrogens(cPositions[2], cIds[2], c2ToC1, c2ToC3);

  // C3端基甲基：C-C键方向从C3指向C2
  const c3ToC2Dir = { x: cPositions[2].x - cPositions[3].x, y: cPositions[2].y - cPositions[3].y, z: cPositions[2].z - cPositions[3].z };
  addMethylHydrogens(cPositions[3], cIds[3], c3ToC2Dir);

  return { atoms, bonds };
}

// 1-丁烯分子 - CH2=CH-CH2-CH3
export function createButeneMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const ccSingleBondLength = 1.51;
  const ccDoubleBondLength = 1.34;
  const chBondLength = 1.09;
  const phi = Math.acos(-1 / 3);
  const sinPhi = Math.sin(phi);

  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: Math.cos(phi) },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: Math.cos(phi) },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: Math.cos(phi) }
  ];

  const rotateTetraToDirection = (mainDir: { x: number, y: number, z: number }) => {
    const len = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
    const nDir = { x: mainDir.x / len, y: mainDir.y / len, z: mainDir.z / len };
    const up = { x: 0, y: 0, z: 1 };
    let axis = { x: up.y * nDir.z - up.z * nDir.y, y: up.z * nDir.x - up.x * nDir.z, z: up.x * nDir.y - up.y * nDir.x };
    const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (axisLen < 0.001) { axis = { x: 1, y: 0, z: 0 }; }
    else { axis = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }; }
    const cosTheta = up.x * nDir.x + up.y * nDir.y + up.z * nDir.z;
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const cos = Math.cos(theta); const sin = Math.sin(theta);
    return tetraDirs.map(p => ({
      x: p.x * cos + (axis.y * p.z - axis.z * p.y) * sin + axis.x * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      y: p.y * cos + (axis.z * p.x - axis.x * p.z) * sin + axis.y * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      z: p.z * cos + (axis.x * p.y - axis.y * p.x) * sin + axis.z * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos)
    }));
  };

  const rodriguesRotate = (v: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number }, angle: number) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
    return { x: v.x * cos + (axis.y * v.z - axis.z * v.y) * sin + axis.x * dot * (1 - cos), y: v.y * cos + (axis.z * v.x - axis.x * v.z) * sin + axis.y * dot * (1 - cos), z: v.z * cos + (axis.x * v.y - axis.y * v.x) * sin + axis.z * dot * (1 - cos) };
  };

  const cIds = [generateUUID(), generateUUID(), generateUUID(), generateUUID()];

  // C0(sp3)-C1(sp2)=C2(sp2)-C3(sp3)
  // C1=C2双键沿x轴，C0和C3分别在120°方向
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);

  const c1Pos = { x: -ccDoubleBondLength / 2, y: 0, z: 0 };
  const c2Pos = { x: ccDoubleBondLength / 2, y: 0, z: 0 };
  const c0Pos = { x: c1Pos.x + ccSingleBondLength * cos120, y: c1Pos.y + ccSingleBondLength * sin120, z: 0 };
  const c3Pos = { x: c2Pos.x + ccSingleBondLength * Math.cos(-60 * Math.PI / 180), y: c2Pos.y + ccSingleBondLength * Math.sin(-60 * Math.PI / 180), z: 0 };

  atoms.push({ id: cIds[0], symbol: 'C', position: c0Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: cIds[1], symbol: 'C', position: c1Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: cIds[2], symbol: 'C', position: c2Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: cIds[3], symbol: 'C', position: c3Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });

  bonds.push({ id: generateUUID(), atom1Id: cIds[0], atom2Id: cIds[1], order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: cIds[1], atom2Id: cIds[2], order: 2 });
  bonds.push({ id: generateUUID(), atom1Id: cIds[2], atom2Id: cIds[3], order: 1 });

  // C0端基甲基H
  const c0ToC1Dir = { x: c1Pos.x - c0Pos.x, y: c1Pos.y - c0Pos.y, z: 0 };
  const c0Tetra = rotateTetraToDirection(c0ToC1Dir);
  const c0AxisLen = Math.sqrt(c0ToC1Dir.x * c0ToC1Dir.x + c0ToC1Dir.y * c0ToC1Dir.y);
  const c0Axis = { x: c0ToC1Dir.x / c0AxisLen, y: c0ToC1Dir.y / c0AxisLen, z: 0 };
  c0Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotate(dir, c0Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c0Pos.x + rotatedDir.x * chBondLength, y: c0Pos.y + rotatedDir.y * chBondLength, z: c0Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cIds[0], atom2Id: hId, order: 1 });
  });

  // C1 sp2碳的H：sp2零和 d1+d2+h=0
  const c1u0 = normalize({ x: c0Pos.x - c1Pos.x, y: c0Pos.y - c1Pos.y, z: 0 });
  const c1u2 = normalize({ x: c2Pos.x - c1Pos.x, y: c2Pos.y - c1Pos.y, z: 0 });
  const c1hDir = normalize({ x: -(c1u0.x + c1u2.x), y: -(c1u0.y + c1u2.y), z: 0 });
  const h1Id = generateUUID();
  atoms.push({ id: h1Id, symbol: 'H', position: { x: c1Pos.x + c1hDir.x * chBondLength, y: c1Pos.y + c1hDir.y * chBondLength, z: 0 }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: cIds[1], atom2Id: h1Id, order: 1 });

  // C2 sp2碳的H
  const c2u1 = normalize({ x: c1Pos.x - c2Pos.x, y: c1Pos.y - c2Pos.y, z: 0 });
  const c2u3 = normalize({ x: c3Pos.x - c2Pos.x, y: c3Pos.y - c2Pos.y, z: 0 });
  const c2hDir = normalize({ x: -(c2u1.x + c2u3.x), y: -(c2u1.y + c2u3.y), z: 0 });
  const h2Id = generateUUID();
  atoms.push({ id: h2Id, symbol: 'H', position: { x: c2Pos.x + c2hDir.x * chBondLength, y: c2Pos.y + c2hDir.y * chBondLength, z: 0 }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: cIds[2], atom2Id: h2Id, order: 1 });

  // C3端基甲基H
  const c3ToC2Dir = { x: c2Pos.x - c3Pos.x, y: c2Pos.y - c3Pos.y, z: 0 };
  const c3Tetra = rotateTetraToDirection(c3ToC2Dir);
  const c3AxisLen = Math.sqrt(c3ToC2Dir.x * c3ToC2Dir.x + c3ToC2Dir.y * c3ToC2Dir.y);
  const c3Axis = { x: c3ToC2Dir.x / c3AxisLen, y: c3ToC2Dir.y / c3AxisLen, z: 0 };
  c3Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotate(dir, c3Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c3Pos.x + rotatedDir.x * chBondLength, y: c3Pos.y + rotatedDir.y * chBondLength, z: c3Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: cIds[3], atom2Id: hId, order: 1 });
  });

  return { atoms, bonds };
}

function normalize(v: { x: number, y: number, z: number }): { x: number, y: number, z: number } {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function rotateTetraToDirectionLocal(
  tetraDirs: { x: number, y: number, z: number }[],
  mainDir: { x: number, y: number, z: number }
): { x: number, y: number, z: number }[] {
  const len = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
  const nDir = { x: mainDir.x / len, y: mainDir.y / len, z: mainDir.z / len };
  const up = { x: 0, y: 0, z: 1 };
  let axis = { x: up.y * nDir.z - up.z * nDir.y, y: up.z * nDir.x - up.x * nDir.z, z: up.x * nDir.y - up.y * nDir.x };
  const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
  if (axisLen < 0.001) { axis = { x: 1, y: 0, z: 0 }; }
  else { axis = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }; }
  const cosTheta = up.x * nDir.x + up.y * nDir.y + up.z * nDir.z;
  const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
  const cos = Math.cos(theta); const sin = Math.sin(theta);
  return tetraDirs.map(p => ({
    x: p.x * cos + (axis.y * p.z - axis.z * p.y) * sin + axis.x * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
    y: p.y * cos + (axis.z * p.x - axis.x * p.z) * sin + axis.y * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
    z: p.z * cos + (axis.x * p.y - axis.y * p.x) * sin + axis.z * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos)
  }));
}

function rodriguesRotateLocal(v: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number }, angle: number): { x: number, y: number, z: number } {
  const cos = Math.cos(angle); const sin = Math.sin(angle);
  const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
  return {
    x: v.x * cos + (axis.y * v.z - axis.z * v.y) * sin + axis.x * dot * (1 - cos),
    y: v.y * cos + (axis.z * v.x - axis.x * v.z) * sin + axis.y * dot * (1 - cos),
    z: v.z * cos + (axis.x * v.y - axis.y * v.x) * sin + axis.z * dot * (1 - cos)
  };
}

// 乙醛分子 - CH3CHO
export function createAcetaldehydeMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const c1Id = generateUUID();
  const c2Id = generateUUID();
  const oId = generateUUID();

  const ccBondLength = 1.51;
  const coBondLength = 1.22;
  const chBondLength = 1.09;

  const c1Pos = { x: -ccBondLength, y: 0, z: 0 };
  const c2Pos = { x: 0, y: 0, z: 0 };
  // C2是sp2，O应与C2→C1方向成120°角
  // C2→C1方向为(-1,0,0)，垂直方向为(0,1,0)
  // sp2方向: cos120°*u + sin120°*perp，其中u=C2→C1方向
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);
  const c2ToC1Dir = { x: -1, y: 0, z: 0 }; // C2→C1的单位向量
  const perp = { x: 0, y: 1, z: 0 }; // 垂直于C2→C1的方向
  const oDir = { x: cos120 * c2ToC1Dir.x + sin120 * perp.x, y: cos120 * c2ToC1Dir.y + sin120 * perp.y, z: 0 };
  const oPos = { x: c2Pos.x + coBondLength * oDir.x, y: c2Pos.y + coBondLength * oDir.y, z: 0 };

  atoms.push({ id: c1Id, symbol: 'C', position: c1Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: c2Id, symbol: 'C', position: c2Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp2' });
  atoms.push({ id: oId, symbol: 'O', position: oPos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp2' });

  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: c2Id, order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: oId, order: 2 });

  // 醛基的H原子：sp2零和 d1+d2+h=0
  const c2u1 = normalize({ x: c1Pos.x - c2Pos.x, y: c1Pos.y - c2Pos.y, z: 0 });
  const c2uO = normalize({ x: oPos.x - c2Pos.x, y: oPos.y - c2Pos.y, z: 0 });
  const c2hDir = normalize({ x: -(c2u1.x + c2uO.x), y: -(c2u1.y + c2uO.y), z: 0 });
  const aldehydeHId = generateUUID();
  atoms.push({ id: aldehydeHId, symbol: 'H', position: { x: c2Pos.x + c2hDir.x * chBondLength, y: c2Pos.y + c2hDir.y * chBondLength, z: 0 }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: aldehydeHId, order: 1 });

  // 甲基的3个H原子
  const c1ToC2Dir = { x: c2Pos.x - c1Pos.x, y: c2Pos.y - c1Pos.y, z: 0 };
  const sinPhi = Math.sin(Math.acos(-1 / 3));
  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: Math.cos(Math.acos(-1 / 3)) },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: Math.cos(Math.acos(-1 / 3)) },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: Math.cos(Math.acos(-1 / 3)) }
  ];
  const c1Tetra = rotateTetraToDirectionLocal(tetraDirs, c1ToC2Dir);
  const c1AxisLen = Math.sqrt(c1ToC2Dir.x * c1ToC2Dir.x + c1ToC2Dir.y * c1ToC2Dir.y);
  const c1Axis = { x: c1ToC2Dir.x / c1AxisLen, y: c1ToC2Dir.y / c1AxisLen, z: 0 };
  c1Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotateLocal(dir, c1Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c1Pos.x + rotatedDir.x * chBondLength, y: c1Pos.y + rotatedDir.y * chBondLength, z: c1Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: hId, order: 1 });
  });

  return { atoms, bonds };
}

// 乙醇分子 - CH3CH2OH
export function createEthanolMolecule(): Molecule {
  const atoms: Molecule['atoms'] = [];
  const bonds: Molecule['bonds'] = [];

  const ccBondLength = 1.51;
  const coBondLength = 1.43;
  const ohBondLength = 0.96;
  const chBondLength = 1.09;
  const phi = Math.acos(-1 / 3);
  const sinPhi = Math.sin(phi);

  const tetraDirs = [
    { x: 0, y: 0, z: 1 },
    { x: sinPhi, y: 0, z: Math.cos(phi) },
    { x: sinPhi * Math.cos(2 * Math.PI / 3), y: sinPhi * Math.sin(2 * Math.PI / 3), z: Math.cos(phi) },
    { x: sinPhi * Math.cos(4 * Math.PI / 3), y: sinPhi * Math.sin(4 * Math.PI / 3), z: Math.cos(phi) }
  ];

  const rotateTetraToDirection = (mainDir: { x: number, y: number, z: number }) => {
    const len = Math.sqrt(mainDir.x * mainDir.x + mainDir.y * mainDir.y + mainDir.z * mainDir.z);
    const nDir = { x: mainDir.x / len, y: mainDir.y / len, z: mainDir.z / len };
    const up = { x: 0, y: 0, z: 1 };
    let axis = { x: up.y * nDir.z - up.z * nDir.y, y: up.z * nDir.x - up.x * nDir.z, z: up.x * nDir.y - up.y * nDir.x };
    const axisLen = Math.sqrt(axis.x * axis.x + axis.y * axis.y + axis.z * axis.z);
    if (axisLen < 0.001) { axis = { x: 1, y: 0, z: 0 }; }
    else { axis = { x: axis.x / axisLen, y: axis.y / axisLen, z: axis.z / axisLen }; }
    const cosTheta = up.x * nDir.x + up.y * nDir.y + up.z * nDir.z;
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    const cos = Math.cos(theta); const sin = Math.sin(theta);
    return tetraDirs.map(p => ({
      x: p.x * cos + (axis.y * p.z - axis.z * p.y) * sin + axis.x * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      y: p.y * cos + (axis.z * p.x - axis.x * p.z) * sin + axis.y * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos),
      z: p.z * cos + (axis.x * p.y - axis.y * p.x) * sin + axis.z * (axis.x * p.x + axis.y * p.y + axis.z * p.z) * (1 - cos)
    }));
  };

  const rodriguesRotate = (v: { x: number, y: number, z: number }, axis: { x: number, y: number, z: number }, angle: number) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle);
    const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
    return { x: v.x * cos + (axis.y * v.z - axis.z * v.y) * sin + axis.x * dot * (1 - cos), y: v.y * cos + (axis.z * v.x - axis.x * v.z) * sin + axis.y * dot * (1 - cos), z: v.z * cos + (axis.x * v.y - axis.y * v.x) * sin + axis.z * dot * (1 - cos) };
  };

  const c1Id = generateUUID();
  const c2Id = generateUUID();
  const oId = generateUUID();

  // 锯齿形构象：C1-C2-O，C2-O键与C2-C1键形成109.5°角
  const cos109 = -1 / 3;
  const sin109 = Math.sqrt(8) / 3;

  const c1Pos = { x: -ccBondLength, y: 0, z: 0 };
  const c2Pos = { x: 0, y: 0, z: 0 };
  const oPos = { x: c2Pos.x + coBondLength * (-cos109), y: c2Pos.y + coBondLength * sin109, z: 0 };

  atoms.push({ id: c1Id, symbol: 'C', position: c1Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: c2Id, symbol: 'C', position: c2Pos, atomicNumber: 6, color: getElementColor('C'), hybridization: 'sp3' });
  atoms.push({ id: oId, symbol: 'O', position: oPos, atomicNumber: 8, color: getElementColor('O'), hybridization: 'sp3' });

  bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: c2Id, order: 1 });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: oId, order: 1 });

  // O-H键：O有2个邻居(C2和H)，sp3四面体，H在四面体剩余方向
  const oToC2Dir = { x: c2Pos.x - oPos.x, y: c2Pos.y - oPos.y, z: 0 };
  const oTetra = rotateTetraToDirection(oToC2Dir);
  const oAxisLen = Math.sqrt(oToC2Dir.x * oToC2Dir.x + oToC2Dir.y * oToC2Dir.y);
  const oAxis = { x: oToC2Dir.x / oAxisLen, y: oToC2Dir.y / oAxisLen, z: 0 };
  // O的H原子：取tetra[1]方向，绕C-O键旋转60°交叉式
  const ohDir = rodriguesRotate(oTetra[1], oAxis, Math.PI / 3);
  const hId = generateUUID();
  const ohPos = { x: oPos.x + ohDir.x * ohBondLength, y: oPos.y + ohDir.y * ohBondLength, z: oPos.z + ohDir.z * ohBondLength };
  atoms.push({ id: hId, symbol: 'H', position: ohPos, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: oId, atom2Id: hId, order: 1 });

  // C1端基甲基H
  const c1ToC2Dir = { x: c2Pos.x - c1Pos.x, y: c2Pos.y - c1Pos.y, z: 0 };
  const c1Tetra = rotateTetraToDirection(c1ToC2Dir);
  const c1AxisLen = Math.sqrt(c1ToC2Dir.x * c1ToC2Dir.x + c1ToC2Dir.y * c1ToC2Dir.y);
  const c1Axis = { x: c1ToC2Dir.x / c1AxisLen, y: c1ToC2Dir.y / c1AxisLen, z: 0 };
  c1Tetra.slice(1, 4).forEach(dir => {
    const rotatedDir = rodriguesRotate(dir, c1Axis, Math.PI / 3);
    const hId = generateUUID();
    atoms.push({ id: hId, symbol: 'H', position: { x: c1Pos.x + rotatedDir.x * chBondLength, y: c1Pos.y + rotatedDir.y * chBondLength, z: c1Pos.z + rotatedDir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
    bonds.push({ id: generateUUID(), atom1Id: c1Id, atom2Id: hId, order: 1 });
  });

  // C2亚甲基H：四面体零和性质
  const c2ToC1Dir = { x: c1Pos.x - c2Pos.x, y: c1Pos.y - c2Pos.y, z: 0 };
  const c2ToODir = { x: oPos.x - c2Pos.x, y: oPos.y - c2Pos.y, z: 0 };
  const d1 = normalize(c2ToC1Dir);
  const d2 = normalize(c2ToODir);
  const halfSum = { x: -(d1.x + d2.x) / 2, y: -(d1.y + d2.y) / 2, z: -(d1.z + d2.z) / 2 };
  const normal = { x: d1.y * d2.z - d1.z * d2.y, y: d1.z * d2.x - d1.x * d2.z, z: d1.x * d2.y - d1.y * d2.x };
  const nLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z) || 1;
  const n = { x: normal.x / nLen, y: normal.y / nLen, z: normal.z / nLen };
  const t = Math.sqrt(2 / 3);
  const h1Dir = normalize({ x: halfSum.x + t * n.x, y: halfSum.y + t * n.y, z: halfSum.z + t * n.z });
  const h2Dir = normalize({ x: halfSum.x - t * n.x, y: halfSum.y - t * n.y, z: halfSum.z - t * n.z });
  const c2h1Id = generateUUID();
  atoms.push({ id: c2h1Id, symbol: 'H', position: { x: c2Pos.x + h1Dir.x * chBondLength, y: c2Pos.y + h1Dir.y * chBondLength, z: c2Pos.z + h1Dir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: c2h1Id, order: 1 });
  const c2h2Id = generateUUID();
  atoms.push({ id: c2h2Id, symbol: 'H', position: { x: c2Pos.x + h2Dir.x * chBondLength, y: c2Pos.y + h2Dir.y * chBondLength, z: c2Pos.z + h2Dir.z * chBondLength }, atomicNumber: 1, color: getElementColor('H') });
  bonds.push({ id: generateUUID(), atom1Id: c2Id, atom2Id: c2h2Id, order: 1 });

  return { atoms, bonds };
}

// 预设分子映射
export const MOLECULE_CREATORS: Record<string, () => Molecule> = {
  '甲烷': createMethaneMolecule,
  '乙烷': createEthaneMolecule,
  '乙烯': createEthyleneMolecule,
  '乙炔': createAcetyleneMolecule,
  '丙烷': createPropaneMolecule,
  '环丙烷': createCyclopropaneMolecule,
  '丁烷': createButaneMolecule,
  '1-丁烯': createButeneMolecule,
  '苯': createBenzeneMolecule,
  '甲苯': createTolueneMolecule,
  '均三甲苯': createMesityleneMolecule,
  '丙苯': createPropylbenzeneMolecule,
  '异丙苯': createCumeneMolecule,
  '水': createWaterMolecule,
  '氨': createAmmoniaMolecule,
  '甲醛': createFormaldehydeMolecule,
  '乙醛': createAcetaldehydeMolecule,
  '丙酮': createAcetoneMolecule,
  '甲酸': createFormicAcidMolecule,
  '乙酸': createAceticAcidMolecule,
  '甲醇': createMethanolMolecule,
  '乙醇': createEthanolMolecule,
};
