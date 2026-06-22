import type { Atom, Bond, Molecule } from '../types';
import { getDefaultValence, getValences } from './elements';

export interface StructuralUnit {
  id: string;
  type: 'ring' | 'fused_ring_system' | 'chain_segment' | 'functional_group' | 'metal_ion' | 'aromatic_ring';
  atomIndices: number[];
  subUnits?: StructuralUnit[];
  connectingPoints: number[];
  parentUnitId?: string;
  description: string;
}

export interface FusedRingSystem extends StructuralUnit {
  type: 'fused_ring_system';
  rings: number[][];
  sharedBonds: Array<{ a1: number; a2: number }>;
}

export interface MoleculeStructure {
  units: StructuralUnit[];
  connections: Array<{ fromUnitId: string; fromAtomIndex: number; toUnitId: string; toAtomIndex: number }>;
  mainChain: number[];
}

export interface RingInfo {
  atoms: number[];
  isAromatic: boolean;
  isHeterocyclic: boolean;
}

function getAtomIndexById(parsedAtoms: ParsedAtom[], id: string): number {
  return parsedAtoms.findIndex(a => a.id === id);
}

function getAtomNeighbors(
  atomIndex: number, 
  parsedAtoms: ParsedAtom[], 
  parsedBonds: { a1: number; a2: number; order: number }[]
): number[] {
  const neighbors: number[] = [];
  parsedBonds.forEach(b => {
    if (b.a1 === atomIndex) neighbors.push(b.a2);
    if (b.a2 === atomIndex) neighbors.push(b.a1);
  });
  return neighbors;
}

function sortRingAtoms(
  ringAtoms: number[],
  parsedBonds: { a1: number; a2: number; order: number }[]
): number[] {
  if (ringAtoms.length <= 2) return ringAtoms;
  
  const ringSet = new Set(ringAtoms);
  const sorted: number[] = [ringAtoms[0]];
  let current = ringAtoms[0];
  let prev = -1;
  
  while (sorted.length < ringAtoms.length) {
    const neighbors: number[] = [];
    parsedBonds.forEach(b => {
      if (b.a1 === current && ringSet.has(b.a2)) neighbors.push(b.a2);
      if (b.a2 === current && ringSet.has(b.a1)) neighbors.push(b.a1);
    });
    
    const next = neighbors.find(n => n !== prev);
    
    if (next === undefined) break;
    
    sorted.push(next);
    prev = current;
    current = next;
  }
  
  return sorted;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ParsedAtom {
  id: string;
  symbol: string;
  bonds: Map<string, number>;
  aromatic: boolean;
  branch: number;
  ringClosures: { id: string; order: number }[];
  implicitH?: number;
  explicitH?: number; // 显式氢数量，来自 [nH]、[NH2] 等
  charge?: number;
}

export interface FunctionalGroup {
  type: string;
  atomIndices: number[];
  rigid: boolean;
  description: string;
}

const METAL_IONS = ['Na', 'Mg', 'Al', 'K', 'Ca'];

export function calculateImplicitHydrogens(
  atom: ParsedAtom, 
  parsedAtoms: ParsedAtom[] = [], 
  parsedBonds: { a1: number; a2: number; order: number }[] = []
): number {
  const symbol = atom.symbol;
  
  console.log(`[calculateImplicitHydrogens] 处理原子: ${symbol}, aromatic: ${atom.aromatic}, explicitH: ${atom.explicitH || 0}`);
  console.log(`  bonds:`, Object.fromEntries(atom.bonds));
  
  if (METAL_IONS.includes(symbol)) {
    console.log(`  是金属离子，返回0`);
    return 0;
  }
  
  if (symbol === 'O') {
    if (atom.charge !== undefined && atom.charge !== 0) {
      console.log(`  是氧且有电荷，返回0`);
      return 0;
    }
  }
  
  // 使用 atom.explicitH，如果没有则为0
  const explicitH = atom.explicitH || 0;
  const baseElement = symbol;
  
  const valence = getDefaultValence(baseElement);
  console.log(`  化合价: ${valence}, 基础元素: ${baseElement}, 显式H: ${explicitH}`);
  
  if (atom.aromatic && baseElement === 'C') {
    // SMILES中[cH]已明确指定H数量，直接返回explicitH
    if (explicitH > 0) {
      console.log(`  是芳香族碳，SMILES指定显式H: ${explicitH}, 返回氢原子数: ${explicitH}`);
      return explicitH;
    }
    const neighborCount = atom.bonds.size;
    const hCount = Math.max(0, 3 - neighborCount);
    console.log(`  是芳香族碳，邻居数: ${neighborCount}, 返回氢原子数: ${hCount}`);
    return hCount;
  }
  
  if (atom.aromatic && baseElement === 'N') {
    // SMILES中[nH]已明确指定H数量，直接返回explicitH
    // 不能用 3-totalBondOrder 计算，因为Kekulé键序对吡咯型N不准确
    // （吡咯型N的π电子来自孤对电子，不是双键，但Kekulé表示仍分配了双键）
    if (explicitH > 0) {
      console.log(`  是芳香族氮，SMILES指定显式H: ${explicitH}, 返回氢原子数: ${explicitH}`);
      return explicitH;
    }
    let totalBondOrder = 0;
    atom.bonds.forEach((order) => { totalBondOrder += order; });
    const hCount = Math.max(0, 3 - totalBondOrder);
    console.log(`  是芳香族氮，总键序: ${totalBondOrder}, 返回氢原子数: ${hCount}`);
    return hCount;
  }
  
  let totalBondOrder = 0;
  atom.bonds.forEach((order) => { totalBondOrder += order; });
  console.log(`  总键序: ${totalBondOrder}`);
  
  let effectiveValence = valence;
  if (atom.charge !== undefined) {
    effectiveValence -= atom.charge;
  }
  console.log(`  有效化合价: ${effectiveValence}`);
  
  // explicitH来自SMILES如[nH]，表示该原子有显式H，需要被创建
  // 所以应该加到结果上，而不是减去
  const hCount = Math.max(0, effectiveValence - totalBondOrder) + explicitH;
  console.log(`  返回氢原子数: ${hCount} (隐式=${Math.max(0, effectiveValence - totalBondOrder)}, 显式=${explicitH})`);
  return hCount;
}

export function getHybridization(
  atom: ParsedAtom, 
  bondOrders: Map<string, Map<string, number>>
): 'sp' | 'sp2' | 'sp3' | 'sp3d' | 'sp3d2' | 'sp3d3' {
  const neighbors = atom.bonds.size;
  const totalBondOrder = Array.from(atom.bonds.entries())
    .reduce((sum, [nId, order]) => sum + order, 0);
  // 使用最大键级来判断杂化类型，避免隐式H未计入导致误判
  const maxBondOrder = Array.from(atom.bonds.values()).reduce((max, o) => Math.max(max, o), 1);

  console.log(`[getHybridization] 原子: symbol=${atom.symbol}, aromatic=${atom.aromatic}, neighbors=${neighbors}, totalBondOrder=${totalBondOrder}, maxBondOrder=${maxBondOrder}`);

  if (atom.symbol === 'H') return 'sp3';

  if (atom.symbol === 'O' || atom.symbol === 'S') {
    // O/S 有双键时为 sp2（如乙醛的 C=O 中的 O）
    if (maxBondOrder >= 2) return 'sp2';
    return 'sp3';
  }

  if (atom.symbol === 'N') {
    if (atom.aromatic) return 'sp2';
    if (maxBondOrder >= 3) return 'sp';
    if (maxBondOrder >= 2) return 'sp2';
    return 'sp3';
  }

  if (atom.symbol === 'C') {
    if (atom.aromatic) return 'sp2';
    // 有三键的碳是sp杂化
    if (maxBondOrder >= 3) return 'sp';
    // 有双键的碳是sp2杂化（如乙醛的 -CH=O）
    if (maxBondOrder >= 2) return 'sp2';
    return 'sp3';
  }

  if (atom.symbol === 'Cl' || atom.symbol === 'Br' || atom.symbol === 'I' || atom.symbol === 'P' || atom.symbol === 'S') {
    if (neighbors >= 7) return 'sp3d3';
    if (neighbors === 6) return 'sp3d2';
    if (neighbors === 5) return 'sp3d';
  }

  // 其他原子
  if (neighbors >= 7) return 'sp3d3';
  if (neighbors === 6) return 'sp3d2';
  if (neighbors === 5) return 'sp3d';
  if (maxBondOrder >= 3) return 'sp';
  if (maxBondOrder >= 2) return 'sp2';
  return 'sp3';
}

export function identifyFunctionalGroups(
  parsedAtoms: ParsedAtom[], 
  parsedBonds: { a1: number; a2: number; order: number }[]
): FunctionalGroup[] {
  const groups: FunctionalGroup[] = [];
  
  for (let i = 0; i < parsedAtoms.length; i++) {
    const atom = parsedAtoms[i];
    
    const neighbors: number[] = [];
    parsedBonds.forEach(b => {
      if (b.a1 === i) neighbors.push(b.a2);
      if (b.a2 === i) neighbors.push(b.a1);
    });
    
    if (atom.symbol === 'C' && neighbors.length === 3) {
      const doubleBondNeighbor = neighbors.find(n => {
        const bond = parsedBonds.find(b => 
          (b.a1 === i && b.a2 === n) || (b.a2 === i && b.a1 === n)
        );
        return bond && bond.order === 2;
      });
      
      if (doubleBondNeighbor !== undefined) {
        const oxygenNeighbor = neighbors.find(n => parsedAtoms[n].symbol === 'O');
        if (oxygenNeighbor !== undefined) {
          groups.push({
            type: 'carbonyl',
            atomIndices: [i, oxygenNeighbor],
            rigid: true,
            description: '羰基 C=O (平面结构)'
          });
        }
      }
    }
    
    if (atom.symbol === 'C') {
      const neighborSymbols = neighbors.map(n => parsedAtoms[n].symbol);
      const oCount = neighborSymbols.filter(s => s === 'O').length;
      
      if (oCount >= 2) {
        const oxygenNeighbors = neighbors.filter(n => parsedAtoms[n].symbol === 'O');
        const singleBondO = oxygenNeighbors.find(n => {
          const bond = parsedBonds.find(b => 
            (b.a1 === i && b.a2 === n) || (b.a2 === i && b.a1 === n)
          );
          return bond && bond.order === 1;
        });
        const doubleBondO = oxygenNeighbors.find(n => {
          const bond = parsedBonds.find(b => 
            (b.a1 === i && b.a2 === n) || (b.a2 === i && b.a1 === n)
          );
          return bond && bond.order === 2;
        });
        
        if (singleBondO !== undefined && doubleBondO !== undefined) {
          groups.push({
            type: 'carboxyl',
            atomIndices: [i, doubleBondO, singleBondO],
            rigid: true,
            description: '羧基 -COOH (平面结构)'
          });
        }
      }
    }
  }
  
  return groups;
}

export interface BondAngleConstraint {
  atom1Id: string;
  atom2Id: string;
  atom3Id: string;
  angle: number;
  tolerance: number;
  type: 'ideal' | 'rigid' | 'flexible';
}

export interface DistanceConstraint {
  atom1Id: string;
  atom2Id: string;
  distance: number;
  tolerance: number;
  type: 'bond' | 'nonbond';
}

export interface DihedralConstraint {
  atom1Id: string;
  atom2Id: string;
  atom3Id: string;
  atom4Id: string;
  angle: number;
  tolerance: number;
  type: 'rigid' | 'rotatable' | 'free';
}

export interface RigidGroup {
  atomIds: string[];
  type: 'coplanar' | 'collinear' | 'tetrahedral' | 'custom';
  description: string;
}

export interface ConstraintValidation {
  isValid: boolean;
  violations: ConstraintViolation[];
  warnings: string[];
}

export interface ConstraintViolation {
  type: 'bond_length' | 'bond_angle' | 'dihedral' | 'overlap' | 'valence';
  description: string;
  severity: 'error' | 'warning';
}

const HYBRIDIZATION_BOND_ANGLES: Record<string, number> = {
  'sp': 180,
  'sp2': 120,
  'sp3': 109.5
};

const STANDARD_BOND_LENGTHS: Record<string, Record<number, number>> = {
  'C-C': { 1: 1.54, 2: 1.34, 3: 1.20 },
  'C-H': { 1: 1.09 },
  'C-O': { 1: 1.43, 2: 1.22 },
  'C=O': { 2: 1.22 },
  'O-H': { 1: 0.96 },
  'C-N': { 1: 1.47, 2: 1.29, 3: 1.16 },
  'N-H': { 1: 1.01 },
  'C=O_amide': { 2: 1.24 },
  'N-C_amide': { 1: 1.32 },
  'C-Cl': { 1: 1.77 },
  'C-Br': { 1: 1.94 },
  'C-I': { 1: 2.14 },
  'C-F': { 1: 1.35 },
  'C-S': { 1: 1.82, 2: 1.60 },
  'N-N': { 1: 1.45, 2: 1.25 },
  'N-K': { 1: 2.70 },
};

export function getBondLength(symbol1: string, symbol2: string, order: number = 1): number {
  const key1 = `${symbol1}-${symbol2}`;
  const key2 = `${symbol2}-${symbol1}`;
  const table = STANDARD_BOND_LENGTHS[key1] || STANDARD_BOND_LENGTHS[key2];
  if (table && table[order]) return table[order];
  if (table && table[1]) return table[1];
  return 1.5;
}

export function getIdealBondAngle(hybridization: string): number {
  return HYBRIDIZATION_BOND_ANGLES[hybridization] || 109.5;
}

export function vectorAdd(v1: Vector3D, v2: Vector3D): Vector3D {
  return { x: v1.x + v2.x, y: v1.y + v2.y, z: v1.z + v2.z };
}

export function vectorSubtract(v1: Vector3D, v2: Vector3D): Vector3D {
  return { x: v1.x - v2.x, y: v1.y - v2.y, z: v1.z - v2.z };
}

export function vectorScale(v: Vector3D, scalar: number): Vector3D {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

export function vectorDot(v1: Vector3D, v2: Vector3D): number {
  return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

export function vectorCross(v1: Vector3D, v2: Vector3D): Vector3D {
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x
  };
}

export function vectorLength(v: Vector3D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vectorNormalize(v: Vector3D): Vector3D {
  const len = vectorLength(v);
  if (len < 0.0001) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function calculateBondAngle(pos1: Vector3D, pos2: Vector3D, pos3: Vector3D): number {
  const v1 = vectorSubtract(pos1, pos2);
  const v2 = vectorSubtract(pos3, pos2);
  const dot = vectorDot(v1, v2);
  const len1 = vectorLength(v1);
  const len2 = vectorLength(v2);
  if (len1 < 0.0001 || len2 < 0.0001) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (len1 * len2)));
  return Math.acos(cosAngle) * 180 / Math.PI;
}

export function calculateDihedralAngle(
  pos1: Vector3D, pos2: Vector3D, pos3: Vector3D, pos4: Vector3D
): number {
  const b1 = vectorSubtract(pos2, pos1);
  const b2 = vectorSubtract(pos3, pos2);
  const b3 = vectorSubtract(pos4, pos3);
  
  const n1 = vectorNormalize(vectorCross(b1, b2));
  const n2 = vectorNormalize(vectorCross(b2, b3));
  
  const m1 = vectorCross(n1, vectorNormalize(b2));
  
  const x = vectorDot(n1, n2);
  const y = vectorDot(m1, n2);
  
  return Math.atan2(y, x) * 180 / Math.PI;
}

export function calculateDistance(pos1: Vector3D, pos2: Vector3D): number {
  return vectorLength(vectorSubtract(pos1, pos2));
}

export function getAtomById(molecule: Molecule, atomId: string): Atom | undefined {
  return molecule.atoms.find(a => a.id === atomId);
}

export function getBondBetweenAtoms(molecule: Molecule, atom1Id: string, atom2Id: string): Bond | undefined {
  return molecule.bonds.find(b => 
    (b.atom1Id === atom1Id && b.atom2Id === atom2Id) ||
    (b.atom1Id === atom2Id && b.atom2Id === atom1Id)
  );
}

export function getConnectedAtoms(molecule: Molecule, atomId: string): Atom[] {
  const connectedIds = molecule.bonds
    .filter(b => b.atom1Id === atomId || b.atom2Id === atomId)
    .map(b => b.atom1Id === atomId ? b.atom2Id : b.atom1Id)
    .filter((id): id is string => id !== null);
  
  return connectedIds
    .map(id => getAtomById(molecule, id))
    .filter((a): a is Atom => a !== undefined);
}

export function getBondOrder(molecule: Molecule, atom1Id: string, atom2Id: string): number {
  const bond = getBondBetweenAtoms(molecule, atom1Id, atom2Id);
  return bond?.order || 0;
}

export function getHybridizationForAtom(molecule: Molecule, atom: Atom): 'sp' | 'sp2' | 'sp3' {
  if (atom.hybridization) return atom.hybridization as 'sp' | 'sp2' | 'sp3';
  
  const neighbors = getConnectedAtoms(molecule, atom.id);
  const totalBondOrder = neighbors.reduce((sum, n) => {
    return sum + getBondOrder(molecule, atom.id, n.id);
  }, 0);
  
  if (atom.symbol === 'H') return 'sp3';
  
  if (atom.symbol === 'C') {
    if (neighbors.length === 2 && totalBondOrder === 3) return 'sp';
    if (neighbors.length === 2 && totalBondOrder === 4) return 'sp2';
    if (neighbors.length === 3) return 'sp2';
    return 'sp3';
  }
  
  if (atom.symbol === 'N') {
    if (neighbors.length === 2 && totalBondOrder === 2) return 'sp';
    if (neighbors.length === 3) return 'sp2';
    return 'sp3';
  }
  
  if (atom.symbol === 'O' || atom.symbol === 'S') {
    return 'sp3';
  }
  
  return 'sp3';
}

export function isAtomInRing(molecule: Molecule, atomId: string, ringSize: number = 6): boolean {
  const visited = new Set<string>();
  const queue: string[] = [atomId];
  let ringCount = 0;
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    
    const neighbors = getConnectedAtoms(molecule, current);
    for (const neighbor of neighbors) {
      if (neighbor.id === atomId) {
        ringCount++;
        if (ringCount >= ringSize) return true;
      } else {
        queue.push(neighbor.id);
      }
    }
  }
  
  return false;
}

export function identifyBenzeneRing(molecule: Molecule): string[] | null {
  const carbons = molecule.atoms.filter(a => a.symbol === 'C');
  
  for (const carbon of carbons) {
    const neighbors = getConnectedAtoms(molecule, carbon.id);
    if (neighbors.length !== 3) continue;
    
    let ringAtoms = [carbon.id];
    let currentAtom = carbon;
    let prevAtomId = '';
    
    for (let i = 0; i < 5; i++) {
      const nextNeighbors = getConnectedAtoms(molecule, currentAtom.id)
        .filter(n => n.id !== prevAtomId && n.symbol === 'C');
      
      if (nextNeighbors.length === 0) break;
      
      const nextAtom = nextNeighbors[0];
      ringAtoms.push(nextAtom.id);
      prevAtomId = currentAtom.id;
      currentAtom = nextAtom;
    }
    
    if (ringAtoms.length === 6) {
      const firstAtom = getAtomById(molecule, ringAtoms[0]);
      const lastNeighbors = getConnectedAtoms(molecule, currentAtom.id);
      if (lastNeighbors.some(n => n.id === ringAtoms[0])) {
        return ringAtoms;
      }
    }
  }
  
  return null;
}

export function identifyAmideGroup(molecule: Molecule): { carbonId: string; nitrogenId: string }[] {
  const amides: { carbonId: string; nitrogenId: string }[] = [];
  
  const carbonylCarbons = molecule.atoms.filter(a => {
    if (a.symbol !== 'C') return false;
    const neighbors = getConnectedAtoms(molecule, a.id);
    const doubleBondO = neighbors.find(n => {
      const bond = getBondBetweenAtoms(molecule, a.id, n.id);
      return bond?.order === 2 && n.symbol === 'O';
    });
    return !!doubleBondO;
  });
  
  for (const carbonylCarbon of carbonylCarbons) {
    const neighbors = getConnectedAtoms(molecule, carbonylCarbon.id);
    const nitrogen = neighbors.find(n => n.symbol === 'N');
    if (nitrogen) {
      amides.push({ carbonId: carbonylCarbon.id, nitrogenId: nitrogen.id });
    }
  }
  
  return amides;
}

export function identifyCarbonylGroup(molecule: Molecule): { carbonId: string; oxygenId: string }[] {
  return molecule.atoms
    .filter(a => a.symbol === 'C')
    .map(carbon => {
      const neighbors = getConnectedAtoms(molecule, carbon.id);
      const oxygen = neighbors.find(n => {
        const bond = getBondBetweenAtoms(molecule, carbon.id, n.id);
        return bond?.order === 2 && n.symbol === 'O';
      });
      return oxygen ? { carbonId: carbon.id, oxygenId: oxygen.id } : null;
    })
    .filter((g): g is { carbonId: string; oxygenId: string } => g !== null);
}

export function isPlanarGroup(molecule: Molecule, atomIds: string[]): boolean {
  if (atomIds.length < 3) return true;
  
  const atoms = atomIds.map(id => getAtomById(molecule, id)).filter((a): a is Atom => a !== undefined);
  if (atoms.length < 3) return true;
  
  const p1 = atoms[0].position;
  const p2 = atoms[1].position;
  const p3 = atoms[2].position;
  
  const v1 = vectorSubtract(p2, p1);
  const v2 = vectorSubtract(p3, p1);
  const normal = vectorCross(v1, v2);
  
  for (let i = 3; i < atoms.length; i++) {
    const v = vectorSubtract(atoms[i].position, p1);
    const dot = Math.abs(vectorDot(v, normal));
    if (dot > 0.01) return false;
  }
  
  return true;
}

export function isCollinear(molecule: Molecule, atomIds: string[]): boolean {
  if (atomIds.length < 3) return true;
  
  const atoms = atomIds.map(id => getAtomById(molecule, id)).filter((a): a is Atom => a !== undefined);
  if (atoms.length < 3) return true;
  
  const v1 = vectorSubtract(atoms[1].position, atoms[0].position);
  const len1 = vectorLength(v1);
  if (len1 < 0.0001) return false;
  
  for (let i = 2; i < atoms.length; i++) {
    const v2 = vectorSubtract(atoms[i].position, atoms[0].position);
    const cross = vectorLength(vectorCross(v1, v2));
    if (cross > 0.01) return false;
  }
  
  return true;
}

export function checkValenceConstraint(molecule: Molecule, atom: Atom): ConstraintValidation {
  const violations: ConstraintViolation[] = [];
  const warnings: string[] = [];
  
  const valence = getDefaultValence(atom.symbol);
  const knownValences = getValences(atom.symbol);
  if (!knownValences || knownValences.length === 0) {
    warnings.push(`未知元素 ${atom.symbol} 的化合价`);
    return { isValid: true, violations, warnings };
  }
  
  const neighbors = getConnectedAtoms(molecule, atom.id);
  const totalBondOrder = neighbors.reduce((sum, n) => {
    return sum + getBondOrder(molecule, atom.id, n.id);
  }, 0);
  
  if (totalBondOrder > valence) {
    violations.push({
      type: 'valence',
      description: `${atom.symbol} 原子的总键序 ${totalBondOrder} 超过了化合价 ${valence}`,
      severity: 'error'
    });
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    warnings
  };
}

export function checkBondLengthConstraint(
  molecule: Molecule, 
  atom1Id: string, 
  atom2Id: string
): ConstraintValidation {
  const violations: ConstraintViolation[] = [];
  const warnings: string[] = [];
  
  const atom1 = getAtomById(molecule, atom1Id);
  const atom2 = getAtomById(molecule, atom2Id);
  if (!atom1 || !atom2) {
    return { isValid: false, violations: [{ type: 'bond_length', description: '原子不存在', severity: 'error' }], warnings };
  }
  
  const bond = getBondBetweenAtoms(molecule, atom1Id, atom2Id);
  if (!bond) {
    violations.push({
      type: 'bond_length',
      description: `${atom1.symbol} 和 ${atom2.symbol} 之间没有化学键`,
      severity: 'error'
    });
    return { isValid: false, violations, warnings };
  }
  
  const idealLength = getBondLength(atom1.symbol, atom2.symbol, bond.order);
  const actualLength = calculateDistance(atom1.position, atom2.position);
  const tolerance = idealLength * 0.15;
  
  if (Math.abs(actualLength - idealLength) > tolerance) {
    const deviation = ((actualLength - idealLength) / idealLength * 100).toFixed(1);
    violations.push({
      type: 'bond_length',
      description: `${atom1.symbol}-${atom2.symbol} 键长 ${actualLength.toFixed(3)}Å 偏离理想值 ${idealLength.toFixed(3)}Å (${deviation}%)`,
      severity: Math.abs(actualLength - idealLength) > tolerance * 2 ? 'error' : 'warning'
    });
  }
  
  return {
    isValid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
    warnings
  };
}

export function checkBondAngleConstraint(
  molecule: Molecule,
  atom1Id: string,
  atom2Id: string,
  atom3Id: string
): ConstraintValidation {
  const violations: ConstraintViolation[] = [];
  const warnings: string[] = [];
  
  const atom1 = getAtomById(molecule, atom1Id);
  const atom2 = getAtomById(molecule, atom2Id);
  const atom3 = getAtomById(molecule, atom3Id);
  
  if (!atom1 || !atom2 || !atom3) {
    return { isValid: false, violations: [{ type: 'bond_angle', description: '原子不存在', severity: 'error' }], warnings };
  }
  
  const actualAngle = calculateBondAngle(atom1.position, atom2.position, atom3.position);
  const hybridization = getHybridizationForAtom(molecule, atom2);
  const idealAngle = getIdealBondAngle(hybridization);
  const tolerance = 5;
  
  if (Math.abs(actualAngle - idealAngle) > tolerance) {
    const deviation = (actualAngle - idealAngle).toFixed(1);
    violations.push({
      type: 'bond_angle',
      description: `${atom2.symbol} 的键角 ${actualAngle.toFixed(1)}° 偏离理想值 ${idealAngle.toFixed(1)}° (${deviation}°)`,
      severity: Math.abs(actualAngle - idealAngle) > tolerance * 2 ? 'error' : 'warning'
    });
  }
  
  return {
    isValid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
    warnings
  };
}

export function checkCoplanarity(molecule: Molecule, atomIds: string[]): ConstraintValidation {
  const violations: ConstraintViolation[] = [];
  const warnings: string[] = [];
  
  if (atomIds.length < 4) {
    warnings.push('共面检查需要至少4个原子');
    return { isValid: true, violations, warnings };
  }
  
  const hasDoubleBond = atomIds.some(id => {
    const neighbors = getConnectedAtoms(molecule, id);
    return neighbors.some(n => {
      const bond = getBondBetweenAtoms(molecule, id, n.id);
      return bond?.order === 2;
    });
  });
  
  const benzeneRing = identifyBenzeneRing(molecule);
  const hasBenzene = benzeneRing && benzeneRing.every(id => atomIds.includes(id));
  
  const carbonyls = identifyCarbonylGroup(molecule);
  const hasCarbonyl = carbonyls.some(g => 
    atomIds.includes(g.carbonId) && atomIds.includes(g.oxygenId)
  );
  
  if (!hasDoubleBond && !hasBenzene && !hasCarbonyl) {
    warnings.push('选中的原子不包含双键、苯环或羰基等共面结构');
  }
  
  if (!isPlanarGroup(molecule, atomIds)) {
    const deviation = calculatePlanarityDeviation(molecule, atomIds);
    if (deviation > 0.1) {
      violations.push({
        type: 'dihedral',
        description: `选中的原子不在同一平面上，平均偏离 ${deviation.toFixed(3)}Å`,
        severity: 'error'
      });
    }
  }
  
  return {
    isValid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
    warnings
  };
}

export function calculatePlanarityDeviation(molecule: Molecule, atomIds: string[]): number {
  const atoms = atomIds.map(id => getAtomById(molecule, id)).filter((a): a is Atom => a !== undefined);
  if (atoms.length < 3) return 0;
  
  const p1 = atoms[0].position;
  const p2 = atoms[1].position;
  const p3 = atoms[2].position;
  
  const v1 = vectorSubtract(p2, p1);
  const v2 = vectorSubtract(p3, p1);
  const normal = vectorNormalize(vectorCross(v1, v2));
  
  let totalDeviation = 0;
  for (const atom of atoms) {
    const v = vectorSubtract(atom.position, p1);
    const distance = Math.abs(vectorDot(v, normal));
    totalDeviation += distance;
  }
  
  return totalDeviation / atoms.length;
}

export function findRigidGroups(molecule: Molecule): RigidGroup[] {
  const groups: RigidGroup[] = [];
  
  const benzeneRing = identifyBenzeneRing(molecule);
  if (benzeneRing) {
    groups.push({
      atomIds: benzeneRing,
      type: 'coplanar',
      description: '苯环 - 所有原子共面，平面刚性结构'
    });
  }
  
  const amides = identifyAmideGroup(molecule);
  for (const amide of amides) {
    const carbonAtoms = getConnectedAtoms(molecule, amide.carbonId);
    const amideAtoms = [amide.carbonId, amide.nitrogenId, ...carbonAtoms.map(a => a.id)];
    
    groups.push({
      atomIds: amideAtoms,
      type: 'coplanar',
      description: '酰胺基团 - 肽键平面结构'
    });
  }
  
  const carbonyls = identifyCarbonylGroup(molecule);
  for (const carbonyl of carbonyls) {
    const carbonNeighbors = getConnectedAtoms(molecule, carbonyl.carbonId);
    const carbonylAtoms = [carbonyl.carbonId, carbonyl.oxygenId, ...carbonNeighbors.map(a => a.id)];
    
    groups.push({
      atomIds: carbonylAtoms,
      type: 'coplanar',
      description: '羰基 - C=O双键平面结构'
    });
  }
  
  const spCarbons = molecule.atoms.filter(a => getHybridizationForAtom(molecule, a) === 'sp');
  for (const spCarbon of spCarbons) {
    const neighbors = getConnectedAtoms(molecule, spCarbon.id);
    if (neighbors.length === 2) {
      const tripleBondPartner = neighbors.find(n => {
        const bond = getBondBetweenAtoms(molecule, spCarbon.id, n.id);
        return bond?.order === 3;
      });
      
      if (tripleBondPartner) {
        groups.push({
          atomIds: [neighbors[0].id, spCarbon.id, neighbors[1].id],
          type: 'collinear',
          description: '三键 - sp杂化共线结构'
        });
      }
    }
  }
  
  return groups;
}

export function canRotateAroundBond(
  molecule: Molecule,
  atom1Id: string,
  atom2Id: string
): { canRotate: boolean; reason: string } {
  const bond = getBondBetweenAtoms(molecule, atom1Id, atom2Id);
  if (!bond) {
    return { canRotate: false, reason: '原子间没有化学键' };
  }
  
  if (bond.order === 3) {
    return { canRotate: false, reason: '三键不能旋转' };
  }
  
  if (bond.order === 2) {
    const atom1 = getAtomById(molecule, atom1Id)!;
    const atom2 = getAtomById(molecule, atom2Id)!;
    
    const benzene = identifyBenzeneRing(molecule);
    if (benzene && benzene.includes(atom1Id) && benzene.includes(atom2Id)) {
      return { canRotate: false, reason: '苯环中的键不能旋转' };
    }
    
    const amides = identifyAmideGroup(molecule);
    for (const amide of amides) {
      if ((amide.carbonId === atom1Id && amide.nitrogenId === atom2Id) ||
          (amide.carbonId === atom2Id && amide.nitrogenId === atom1Id)) {
        return { canRotate: false, reason: '酰胺键（肽键）不能旋转' };
      }
    }
  }
  
  const atom1Neighbors = getConnectedAtoms(molecule, atom1Id);
  const atom2Neighbors = getConnectedAtoms(molecule, atom2Id);
  
  const rigidGroups = findRigidGroups(molecule);
  
  for (const group of rigidGroups) {
    const atom1InGroup = group.atomIds.includes(atom1Id);
    const atom2InGroup = group.atomIds.includes(atom2Id);
    
    if (atom1InGroup && atom2InGroup) {
      return { canRotate: false, reason: `该键属于刚性基团: ${group.description}` };
    }
  }
  
  return { canRotate: true, reason: '单键可以旋转' };
}

export function validateMoleculeConstraints(molecule: Molecule): ConstraintValidation {
  const allViolations: ConstraintViolation[] = [];
  const allWarnings: string[] = [];
  
  for (const atom of molecule.atoms) {
    const valenceResult = checkValenceConstraint(molecule, atom);
    allViolations.push(...valenceResult.violations);
    allWarnings.push(...valenceResult.warnings);
  }
  
  for (const bond of molecule.bonds) {
    if (bond.atom1Id === null || bond.atom2Id === null) continue;
    const bondResult = checkBondLengthConstraint(molecule, bond.atom1Id, bond.atom2Id);
    allViolations.push(...bondResult.violations);
    allWarnings.push(...bondResult.warnings);
  }
  
  for (const atom of molecule.atoms) {
    const neighbors = getConnectedAtoms(molecule, atom.id);
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        const angleResult = checkBondAngleConstraint(molecule, neighbors[i].id, atom.id, neighbors[j].id);
        allViolations.push(...angleResult.violations);
        allWarnings.push(...angleResult.warnings);
      }
    }
  }
  
  const rigidGroups = findRigidGroups(molecule);
  for (const group of rigidGroups) {
    if (group.type === 'coplanar' && !isPlanarGroup(molecule, group.atomIds)) {
      allViolations.push({
        type: 'dihedral',
        description: `${group.description} - 原子不共面`,
        severity: 'error'
      });
    }
  }
  
  return {
    isValid: allViolations.filter(v => v.severity === 'error').length === 0,
    violations: allViolations,
    warnings: allWarnings
  };
}

export function adjustToIdealGeometry(
  molecule: Molecule,
  atomId: string,
  targetPosition: Vector3D
): Molecule {
  const atom = getAtomById(molecule, atomId);
  if (!atom) return molecule;
  
  const neighbors = getConnectedAtoms(molecule, atomId);
  const hybridization = getHybridizationForAtom(molecule, atom);
  const idealAngle = getIdealBondAngle(hybridization);
  
  const newAtoms = molecule.atoms.map(a => {
    if (a.id === atomId) {
      return { ...a, position: targetPosition };
    }
    return a;
  });
  
  return { ...molecule, atoms: newAtoms };
}

export function getRotatableBonds(molecule: Molecule): { atom1Id: string; atom2Id: string; reason: string }[] {
  const rotatableBonds: { atom1Id: string; atom2Id: string; reason: string }[] = [];
  
  for (const bond of molecule.bonds) {
    if (bond.order === 1 && bond.atom1Id !== null && bond.atom2Id !== null) {
      const result = canRotateAroundBond(molecule, bond.atom1Id, bond.atom2Id);
      if (result.canRotate) {
        rotatableBonds.push({
          atom1Id: bond.atom1Id,
          atom2Id: bond.atom2Id,
          reason: result.reason
        });
      }
    }
  }
  
  return rotatableBonds;
}

export function calculateMolecularConformation(
  molecule: Molecule,
  focusAtomId?: string
): {
  rotatableBonds: number;
  rigidGroups: number;
  planarityScore: number;
  strainEnergy: number;
} {
  const rotatableBonds = getRotatableBonds(molecule);
  const rigidGroups = findRigidGroups(molecule);
  
  let totalPlanarityDeviation = 0;
  for (const group of rigidGroups.filter(g => g.type === 'coplanar')) {
    totalPlanarityDeviation += calculatePlanarityDeviation(molecule, group.atomIds);
  }
  const planarityScore = rigidGroups.length > 0 
    ? 1 - (totalPlanarityDeviation / rigidGroups.length)
    : 1;
  
  const validation = validateMoleculeConstraints(molecule);
  const strainEnergy = validation.violations.reduce((sum, v) => {
    return sum + (v.severity === 'error' ? 10 : 1);
  }, 0);
  
  return {
    rotatableBonds: rotatableBonds.length,
    rigidGroups: rigidGroups.length,
    planarityScore: Math.max(0, planarityScore),
    strainEnergy
  };
}

export function findAllRings(
  parsedAtoms: ParsedAtom[], 
  parsedBonds: { a1: number; a2: number; order: number }[]
): RingInfo[] {
  const rings: RingInfo[] = [];
  const visitedAtomCombinations = new Set<string>();

  function dfs(
    start: number, 
    current: number, 
    path: number[], 
    visited: Set<number>
  ) {
    // 如果当前原子是金属离子，不能参与环的形成
    if (METAL_IONS.includes(parsedAtoms[current].symbol)) return;
    
    if (path.length > 0 && current === start && path.length >= 3) {
      // 检查路径中的所有原子是否都不是金属离子
      const hasMetal = path.some(i => METAL_IONS.includes(parsedAtoms[i].symbol));
      if (hasMetal) return;
      
      const sortedPath = [...path].sort((a, b) => a - b);
      const key = sortedPath.join('-');
      
      if (!visitedAtomCombinations.has(key) && path.length <= 8) {
        visitedAtomCombinations.add(key);
        
        const isAromatic = path.every(i => parsedAtoms[i].aromatic);
        const isHeterocyclic = path.some(i => parsedAtoms[i].symbol !== 'C');
        
        const sortedRingAtoms = sortRingAtoms([...path], parsedBonds);
        
        rings.push({
          atoms: sortedRingAtoms,
          isAromatic,
          isHeterocyclic
        });
      }
      return;
    }
    
    if (visited.has(current)) return;
    
    visited.add(current);
    path.push(current);
    
    const neighbors = getAtomNeighbors(current, parsedAtoms, parsedBonds);
    for (const neighbor of neighbors) {
      // 不能连接到金属离子
      if (METAL_IONS.includes(parsedAtoms[neighbor].symbol)) continue;
      if (path.length > 0 && neighbor === path[path.length - 1]) continue;
      dfs(start, neighbor, [...path], new Set(visited));
    }
  }

  for (let i = 0; i < parsedAtoms.length; i++) {
    // 跳过金属离子，不把它们作为环的起点
    if (METAL_IONS.includes(parsedAtoms[i].symbol)) continue;
    dfs(i, i, [], new Set<number>());
  }

  const uniqueRings: RingInfo[] = [];
  const seen = new Set<string>();
  
  for (const ring of rings) {
    const sorted = [...ring.atoms].sort((a, b) => a - b).join('-');
    if (!seen.has(sorted)) {
      seen.add(sorted);
      uniqueRings.push(ring);
    }
  }

  return uniqueRings;
}

export function identifyFusedRingSystems(
  rings: RingInfo[]
): RingInfo[][] {
  const systems: RingInfo[][] = [];
  const assignedToSystem = new Set<number>();

  function shareBond(ring1: RingInfo, ring2: RingInfo): boolean {
    const set1 = new Set(ring1.atoms);
    let sharedCount = 0;
    for (const atom of ring2.atoms) {
      if (set1.has(atom)) sharedCount++;
    }
    return sharedCount >= 2;
  }

  for (let i = 0; i < rings.length; i++) {
    if (assignedToSystem.has(i)) continue;

    const system: RingInfo[] = [rings[i]];
    assignedToSystem.add(i);
    let changed = true;

    while (changed) {
      changed = false;
      for (let j = 0; j < rings.length; j++) {
        if (assignedToSystem.has(j)) continue;

        const canAdd = system.some(r => shareBond(r, rings[j]));
        if (canAdd) {
          system.push(rings[j]);
          assignedToSystem.add(j);
          changed = true;
        }
      }
    }

    systems.push(system);
  }

  return systems;
}

export function identifyMetalIons(
  parsedAtoms: ParsedAtom[]
): StructuralUnit[] {
  const units: StructuralUnit[] = [];
  
  for (let i = 0; i < parsedAtoms.length; i++) {
    const atom = parsedAtoms[i];
    if (METAL_IONS.includes(atom.symbol)) {
      units.push({
        id: `metal_${i}`,
        type: 'metal_ion',
        atomIndices: [i],
        connectingPoints: [i],
        description: `${atom.symbol} 金属离子`
      });
    }
  }

  return units;
}

export function identifyChainSegments(
  parsedAtoms: ParsedAtom[], 
  parsedBonds: { a1: number; a2: number; order: number }[], 
  ringAtoms: Set<number>, 
  functionalGroupAtoms: Set<number>
): StructuralUnit[] {
  const units: StructuralUnit[] = [];
  const visited = new Set<number>();

  function isChainAtom(index: number): boolean {
    if (ringAtoms.has(index)) return false;
    if (functionalGroupAtoms.has(index)) return false;
    return true;
  }

  function traceChain(start: number): number[] {
    const chain: number[] = [];
    const chainVisited = new Set<number>();
    let current = start;
    
    while (current !== -1 && !chainVisited.has(current)) {
      chainVisited.add(current);
      chain.push(current);
      
      const neighbors = getAtomNeighbors(current, parsedAtoms, parsedBonds);
      const unvisitedNeighbors = neighbors.filter(n => 
        isChainAtom(n) && !chainVisited.has(n) && !visited.has(n)
      );
      
      if (unvisitedNeighbors.length > 0) {
        current = unvisitedNeighbors[0];
      } else {
        current = -1;
      }
    }

    return chain;
  }

  for (let i = 0; i < parsedAtoms.length; i++) {
    if (visited.has(i)) continue;
    if (!isChainAtom(i)) continue;

    const chain = traceChain(i);
    if (chain.length > 0) {
      chain.forEach(index => visited.add(index));
      
      const connectingPoints = chain.filter(index => {
        const neighbors = getAtomNeighbors(index, parsedAtoms, parsedBonds);
        return neighbors.some(n => !chain.includes(n));
      });

      units.push({
        id: `chain_${units.length}`,
        type: 'chain_segment',
        atomIndices: chain,
        connectingPoints: connectingPoints.length > 0 ? connectingPoints : [chain[0]],
        description: `碳链段 (${chain.length}个原子)`
      });
    }
  }

  return units;
}

export function analyzeMoleculeStructure(
  parsedAtoms: ParsedAtom[], 
  parsedBonds: { a1: number; a2: number; order: number }[]
): MoleculeStructure {
  const units: StructuralUnit[] = [];
  
  const allRings = findAllRings(parsedAtoms, parsedBonds);
  const fusedSystems = identifyFusedRingSystems(allRings);
  
  const ringAtomSet = new Set<number>();
  
  for (let sysIdx = 0; sysIdx < fusedSystems.length; sysIdx++) {
    const system = fusedSystems[sysIdx];
    
    if (system.length === 1) {
      const ring = system[0];
      ring.atoms.forEach(a => ringAtomSet.add(a));
      units.push({
        id: `ring_${sysIdx}`,
        type: ring.isAromatic ? 'aromatic_ring' : 'ring',
        atomIndices: ring.atoms,
        connectingPoints: ring.atoms.filter(index => {
          const neighbors = getAtomNeighbors(index, parsedAtoms, parsedBonds);
          return neighbors.some(n => !ring.atoms.includes(n));
        }),
        description: ring.isAromatic ? 
          `${ring.atoms.length}元芳香环` : 
          `${ring.atoms.length}元脂环`
      });
    } else {
      const allAtomsInSystem: number[] = [];
      system.forEach(r => r.atoms.forEach(a => {
        allAtomsInSystem.push(a);
        ringAtomSet.add(a);
      }));
      
      const uniqueAtoms = [...new Set(allAtomsInSystem)];
      
      units.push({
        id: `fused_${sysIdx}`,
        type: 'fused_ring_system',
        atomIndices: uniqueAtoms,
        rings: system.map(r => r.atoms),
        sharedBonds: [] as Array<{ a1: number; a2: number }>,
        connectingPoints: uniqueAtoms.filter(index => {
          const neighbors = getAtomNeighbors(index, parsedAtoms, parsedBonds);
          return neighbors.some(n => !uniqueAtoms.includes(n));
        }),
        description: `稠环系统 (${system.length}个环)`
      } as FusedRingSystem);
    }
  }

  const funcGroups = identifyFunctionalGroups(parsedAtoms, parsedBonds);
  const funcGroupAtomSet = new Set<number>();
  
  funcGroups.forEach((group, idx) => {
    group.atomIndices.forEach(a => funcGroupAtomSet.add(a));
    units.push({
      id: `func_${idx}`,
      type: 'functional_group',
      atomIndices: group.atomIndices,
      connectingPoints: group.atomIndices.filter(index => {
        const neighbors = getAtomNeighbors(index, parsedAtoms, parsedBonds);
        return neighbors.some(n => !group.atomIndices.includes(n));
      }),
      description: group.description
    });
  });

  const metalUnits = identifyMetalIons(parsedAtoms);
  units.push(...metalUnits);

  const chainUnits = identifyChainSegments(
    parsedAtoms, 
    parsedBonds, 
    ringAtomSet, 
    funcGroupAtomSet
  );
  units.push(...chainUnits);

  const connections: Array<{
    fromUnitId: string; 
    fromAtomIndex: number; 
    toUnitId: string; 
    toAtomIndex: number;
  }> = [];

  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const unit1 = units[i];
      const unit2 = units[j];
      
      for (const a1 of unit1.atomIndices) {
        for (const a2 of unit2.atomIndices) {
          const hasBond = parsedBonds.some(b => 
            (b.a1 === a1 && b.a2 === a2) || (b.a1 === a2 && b.a2 === a1)
          );
          
          if (hasBond) {
            connections.push({
              fromUnitId: unit1.id,
              fromAtomIndex: a1,
              toUnitId: unit2.id,
              toAtomIndex: a2
            });
          }
        }
      }
    }
  }

  const mainChain = findMainChain(parsedAtoms, parsedBonds, units);

  return {
    units,
    connections,
    mainChain
  };
}

function findMainChain(
  parsedAtoms: ParsedAtom[], 
  parsedBonds: { a1: number; a2: number; order: number }[],
  units: StructuralUnit[]
): number[] {
  let longestPath: number[] = [];
  
  for (const unit of units) {
    if (unit.type === 'chain_segment' || unit.type === 'fused_ring_system' || unit.type === 'aromatic_ring') {
      if (unit.atomIndices.length > longestPath.length) {
        longestPath = unit.atomIndices;
      }
    }
  }

  return longestPath;
}

export function generateStructureUnitId(
  type: string, 
  index: number
): string {
  return `${type}_${index}`;
}
