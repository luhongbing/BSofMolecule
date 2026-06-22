export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Atom {
  id: string;
  symbol: string;
  position: Vector3;
  atomicNumber: number;
  hybridization?: 'sp' | 'sp2' | 'sp3' | 'sp3d' | 'sp3d2' | 'sp3d3';
  color?: string;
  radius?: number;
}

export interface Bond {
  id: string;
  atom1Id: string | null;
  atom2Id: string | null;
  order: number;
  // 空头的位置（当对应 atomId 为 null 时使用）
  atom1Position?: Vector3;
  atom2Position?: Vector3;
}

export interface Molecule {
  atoms: Atom[];
  bonds: Bond[];
  name?: string;
  smiles?: string;
  formula?: string;
  molecularWeight?: number;
  unsaturation?: number;
}

export type ToolType =
  | 'edit'
  | 'analyze'
  | 'text'
  | 'atom'
  | 'bond_single'
  | 'bond_double'
  | 'bond_triple'
  | 'wedge'
  | 'dash';

// 化学分子结构约束类型
export interface BondAngleConstraint {
  description: string;
  atoms: string[]; // 参与键角的三个原子ID: [中心原子, 原子1, 原子2]
  idealAngle: number; // 理想键角（度）
  tolerance: number; // 允许的偏差（度）
}

export interface SkeletonConstraint {
  type: 'rigid' | 'collinear' | 'coplanar' | 'sp' | 'sp2' | 'sp3';
  description: string;
  atoms: string[]; // 受约束的原子ID列表
  bonds?: string[]; // 相关键ID列表
}

// 常用键角约束值
export const BOND_ANGLES = {
  // sp杂化（直线型）
  SP: 180,
  // sp2杂化（平面三角形）
  SP2: 120,
  // sp3杂化（四面体）
  SP3: 109.5,
  // 水分子
  WATER: 104.5,
  // 氨分子
  AMMONIA: 107,
  // 苯环
  BENZENE: 120,
  // 乙烯
  ETHYLENE: 120,
  // 乙炔
  ACETYLENE: 180,
} as const;

export type RenderMode = 'ball-stick' | 'space-fill' | 'wireframe';

export type ViewMode = '3d' | '2d';

export interface HybridizationAnalysis {
  sp: string[];
  sp2: string[];
  sp3: string[];
  sp3d: string[];
  sp3d2: string[];
  sp3d3: string[];
}

export interface CollinearityResult {
  isCollinear: boolean;
  atoms: string[];
  explanation: string;
}

export interface CoplanarityResult {
  isCoplanar: boolean;
  atoms: string[];
  explanation: string;
  planeEquation?: { a: number; b: number; c: number; d: number };
}

export interface AnalysisResult {
  collinearGroups: string[][];
  coplanarGroups: string[][];
  hybridization: HybridizationAnalysis;
}

export interface PresetMolecule {
  name: string;
  smiles: string;
  description: string;
}
