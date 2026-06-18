import type { Molecule, Atom, Bond } from '../types';
import {
  getBondLength,
  calculateBondAngle,
  identifyBenzeneRing,
  identifyAmideGroup,
  identifyCarbonylGroup,
  validateMoleculeConstraints,
  calculateMolecularConformation,
  getRotatableBonds,
  findRigidGroups,
  canRotateAroundBond,
  checkValenceConstraint,
  checkBondLengthConstraint,
  checkBondAngleConstraint,
  Vector3D,
  calculateImplicitHydrogens,
  getHybridization,
  identifyFunctionalGroups,
  findAllRings,
  identifyFusedRingSystems,
  analyzeMoleculeStructure,
  type ParsedAtom as ParsedAtomType,
  type FunctionalGroup,
  type RingInfo,
  type StructuralUnit,
  type MoleculeStructure
} from './molecularConstraints';
import {
  FUSED_RING_FRAGMENTS,
  matchFusedRingFragment,
  applyFusedRingFragment,
  type FusedRingFragment,
  type FusedRingAtom
} from './fusedRingFragments';
import { ELEMENTS_SET, getElementColor as getElementColorFromLib, getElement as getElementFromLib } from './elements';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const getElementColor = (symbol: string): string => {
  return getElementColorFromLib(symbol);
};

const MIN_ATOM_DISTANCE = 1.0;

function distance(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function findNearestAtom(
  pos: { x: number; y: number; z: number },
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  excludeIds?: string | string[]
): { id: string; dist: number } | null {
  let minDist = Infinity;
  let nearestId: string | null = null;
  const excludeSet = excludeIds ? (Array.isArray(excludeIds) ? new Set(excludeIds) : new Set([excludeIds])) : new Set<string>();
  
  atomPositions.forEach((p, id) => {
    if (excludeSet.has(id)) return;
    const d = distance(pos, p);
    if (d < minDist) {
      minDist = d;
      nearestId = id;
    }
  });
  
  return nearestId ? { id: nearestId, dist: minDist } : null;
}

function avoidAtomOverlap(
  pos: { x: number; y: number; z: number },
  symbol: string,
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  bondLength: number,
  excludeIds?: string | string[]
): { x: number; y: number; z: number } {
  const nearest = findNearestAtom(pos, atomPositions, excludeIds);

  if (nearest && nearest.dist < MIN_ATOM_DISTANCE) {
    const nearestPos = atomPositions.get(nearest.id)!;
    let dx = pos.x - nearestPos.x;
    let dy = pos.y - nearestPos.y;
    let dz = pos.z - nearestPos.z;

    if (nearest.dist < 0.01) {
      const angle1 = Math.random() * 2 * Math.PI;
      const angle2 = Math.random() * Math.PI - Math.PI / 2;
      dx = Math.cos(angle2) * Math.cos(angle1);
      dy = Math.cos(angle2) * Math.sin(angle1);
      dz = Math.sin(angle2);
    } else {
      const len = nearest.dist;
      dx /= len;
      dy /= len;
      dz /= len;
    }

    const pushDist = MIN_ATOM_DISTANCE - nearest.dist + 0.2;

    return {
      x: pos.x + dx * pushDist,
      y: pos.y + dy * pushDist,
      z: pos.z + dz * pushDist,
    };
  }

  return pos;
}

// ============ 基于可旋转键的空间冲突检测与矫正 ============

/** 检测指定原子集合与已有原子之间的空间冲突 */
function detectConflicts(
  atomIds: string[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  excludeIds: string[] = []
): { id: string; conflictingWith: string; dist: number }[] {
  const conflicts: { id: string; conflictingWith: string; dist: number }[] = [];
  const excludeSet = new Set(excludeIds);
  const atomIdSet = new Set(atomIds);

  for (const id of atomIds) {
    const pos = atomPositions.get(id);
    if (!pos) continue;

    atomPositions.forEach((otherPos, otherId) => {
      if (atomIdSet.has(otherId)) return;       // 同组内不检测
      if (excludeSet.has(otherId)) return;       // 排除列表
      const dx = pos.x - otherPos.x;
      const dy = pos.y - otherPos.y;
      const dz = pos.z - otherPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < MIN_ATOM_DISTANCE) {
        conflicts.push({ id, conflictingWith: otherId, dist });
      }
    });
  }

  return conflicts;
}

/** 获取从键的一端出发，不经过该键可达的所有原子索引（BFS） */
function getGroupOnSide(
  startIdx: number,
  bridgeIdx: number,
  parsedBonds: { a1: number; a2: number; order: number }[],
  totalAtoms: number
): number[] {
  const visited = new Set<number>();
  visited.add(bridgeIdx); // 不经过桥原子
  const queue: number[] = [startIdx];
  visited.add(startIdx);
  const group: number[] = [startIdx];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const b of parsedBonds) {
      let next = -1;
      if (b.a1 === cur) next = b.a2;
      else if (b.a2 === cur) next = b.a1;
      if (next >= 0 && !visited.has(next)) {
        visited.add(next);
        group.push(next);
        queue.push(next);
      }
    }
  }

  return group;
}

/** 判断键是否可旋转（解析阶段版本，使用 parsedAtoms/parsedBonds） */
function isBondRotatable(
  a1Idx: number,
  a2Idx: number,
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  ringAtomIndices: Set<number>
): boolean {
  // 找到键的 order
  const bond = parsedBonds.find(b =>
    (b.a1 === a1Idx && b.a2 === a2Idx) || (b.a1 === a2Idx && b.a2 === a1Idx)
  );
  if (!bond) return false;
  // 双键、三键不可旋转
  if (bond.order >= 2) return false;
  // 如果两个原子都在同一个环中，不可旋转
  if (ringAtomIndices.has(a1Idx) && ringAtomIndices.has(a2Idx)) return false;
  return true;
}

/** 在驳接体原子集合中查找所有可旋转键 */
function findRotatableBondsInGroup(
  groupAtomIndices: number[],
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  ringAtomIndices: Set<number>
): { a1: number; a2: number }[] {
  const groupSet = new Set(groupAtomIndices);
  const rotatable: { a1: number; a2: number }[] = [];

  for (const b of parsedBonds) {
    // 键的两端都在 group 内
    if (!groupSet.has(b.a1) || !groupSet.has(b.a2)) continue;
    if (!isBondRotatable(b.a1, b.a2, parsedAtoms, parsedBonds, ringAtomIndices)) continue;
    rotatable.push({ a1: b.a1, a2: b.a2 });
  }

  return rotatable;
}

/** 绕指定键旋转一组原子，返回旋转后的新位置 Map（仅包含旋转的原子） */
function rotateGroupAroundBond(
  atomIndices: number[],
  pivotIdx: number,
  anchorIdx: number,
  angle: number,
  parsedAtoms: ParsedAtom[],
  atomPositions: Map<string, { x: number; y: number; z: number }>
): Map<string, { x: number; y: number; z: number }> {
  const pivotPos = atomPositions.get(parsedAtoms[pivotIdx].id);
  const anchorPos = atomPositions.get(parsedAtoms[anchorIdx].id);
  if (!pivotPos || !anchorPos) return new Map();

  // 旋转轴：从 pivot 到 anchor 的方向
  const ax = anchorPos.x - pivotPos.x;
  const ay = anchorPos.y - pivotPos.y;
  const az = anchorPos.z - pivotPos.z;
  const aLen = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  const nx = ax / aLen, ny = ay / aLen, nz = az / aLen;

  // Rodrigues 旋转公式
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const result = new Map<string, { x: number; y: number; z: number }>();
  const rotateSet = new Set(atomIndices);

  for (const idx of atomIndices) {
    const pos = atomPositions.get(parsedAtoms[idx].id);
    if (!pos) continue;

    // 平移到 pivot 为原点
    const px = pos.x - pivotPos.x;
    const py = pos.y - pivotPos.y;
    const pz = pos.z - pivotPos.z;

    // Rodrigues: v' = v*cos(a) + (n×v)*sin(a) + n*(n·v)*(1-cos(a))
    const dot = nx * px + ny * py + nz * pz;
    const crossX = ny * pz - nz * py;
    const crossY = nz * px - nx * pz;
    const crossZ = nx * py - ny * px;

    const rx = px * cosA + crossX * sinA + nx * dot * (1 - cosA);
    const ry = py * cosA + crossY * sinA + ny * dot * (1 - cosA);
    const rz = pz * cosA + crossZ * sinA + nz * dot * (1 - cosA);

    result.set(parsedAtoms[idx].id, {
      x: rx + pivotPos.x,
      y: ry + pivotPos.y,
      z: rz + pivotPos.z
    });
  }

  return result;
}

/**
 * 基于可旋转键的空间冲突矫正
 *
 * 策略：
 * 1. 驳接键可旋转 → 绕驳接键旋转驳接体（角度最小化，5°步长采样）
 * 2. 驳接键不可旋转或旋转无法解决 → 找驳接体内最近可旋转键旋转
 * 3. 仍有残留冲突 → 保持最优姿态，记录警告
 *
 * @param attachmentAtomIdx 驳接点原子索引（受体侧）
 * @param attachedGroupIdxs 驳接体原子索引集合
 * @param parsedAtoms / parsedBonds / atomPositions / ringAtomIndices 上下文
 * @param excludeIds 排除检测的原子ID列表
 */
function resolveConflictByRotation(
  attachmentAtomIdx: number,
  attachedGroupIdxs: number[],
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  ringAtomIndices: Set<number>,
  excludeIds: string[] = []
): void {
  const attachedIds = attachedGroupIdxs.map(i => parsedAtoms[i].id);

  // Step 0: 检测初始冲突
  const initialConflicts = detectConflicts(attachedIds, atomPositions, excludeIds);
  if (initialConflicts.length === 0) {
    console.log('[resolveConflictByRotation] 无冲突，跳过');
    return;
  }
  console.log(`[resolveConflictByRotation] 检测到 ${initialConflicts.length} 个冲突`);

  // 找出驳接体中与驳接点直接相连的原子（驳接键的另一端）
  const directBondedIdxs = attachedGroupIdxs.filter(idx => {
    return parsedBonds.some(b =>
      (b.a1 === attachmentAtomIdx && b.a2 === idx) ||
      (b.a2 === attachmentAtomIdx && b.a1 === idx)
    );
  });

  // ---- Step 1: 尝试绕驳接键旋转 ----
  for (const bondedIdx of directBondedIdxs) {
    if (!isBondRotatable(attachmentAtomIdx, bondedIdx, parsedAtoms, parsedBonds, ringAtomIndices)) {
      console.log(`[resolveConflictByRotation] 驳接键 ${attachmentAtomIdx}-${bondedIdx} 不可旋转，跳过Step1`);
      continue;
    }

    // 驳接键可旋转，采样旋转角度
    const bestResult = sampleBestRotation(
      attachedGroupIdxs, bondedIdx, attachmentAtomIdx,
      parsedAtoms, parsedBonds, atomPositions, excludeIds
    );

    if (bestResult && bestResult.conflictCount < initialConflicts.length) {
      // 应用旋转
      applyRotation(bestResult.positions, atomPositions);
      const newConflicts = detectConflicts(attachedIds, atomPositions, excludeIds);
      console.log(`[resolveConflictByRotation] Step1: 绕驳接键 ${attachmentAtomIdx}-${bondedIdx} 旋转 ${bestResult.angle.toFixed(1)}°, 冲突 ${initialConflicts.length}→${newConflicts.length}`);
      if (newConflicts.length === 0) return;
    }
  }

  // ---- Step 2: 在驳接体内寻找可旋转键 ----
  const rotatableBonds = findRotatableBondsInGroup(
    attachedGroupIdxs, parsedAtoms, parsedBonds, ringAtomIndices
  );

  // 按距驳接点的距离排序（近的优先）
  const attachmentPos = atomPositions.get(parsedAtoms[attachmentAtomIdx].id);
  rotatableBonds.sort((a, b) => {
    const midA = midpoint(a.a1, a.a2, parsedAtoms, atomPositions);
    const midB = midpoint(b.a1, b.a2, parsedAtoms, atomPositions);
    const distA = attachmentPos ? distance(midA, attachmentPos) : 0;
    const distB = attachmentPos ? distance(midB, attachmentPos) : 0;
    return distA - distB;
  });

  for (const rb of rotatableBonds) {
    // 确定旋转哪一侧：选择不包含驳接点的那一侧
    const side1 = getGroupOnSide(rb.a1, rb.a2, parsedBonds, parsedAtoms.length);
    const side2 = getGroupOnSide(rb.a2, rb.a1, parsedBonds, parsedAtoms.length);

    // 选择包含驳接体原子更多的一侧（即远离受体的一侧）
    const attachedSet = new Set(attachedGroupIdxs);
    const side1InGroup = side1.filter(i => attachedSet.has(i)).length;
    const side2InGroup = side2.filter(i => attachedSet.has(i)).length;

    // 旋转远离驳接点的那一侧（包含较少驳接体原子的那侧）
    let rotateIndices: number[];
    let pivotIdx: number, anchorIdx: number;

    if (side1InGroup <= side2InGroup) {
      rotateIndices = side1.filter(i => attachedSet.has(i));
      pivotIdx = rb.a1;
      anchorIdx = rb.a2;
    } else {
      rotateIndices = side2.filter(i => attachedSet.has(i));
      pivotIdx = rb.a2;
      anchorIdx = rb.a1;
    }

    if (rotateIndices.length === 0) continue;

    const bestResult = sampleBestRotation(
      rotateIndices, pivotIdx, anchorIdx,
      parsedAtoms, parsedBonds, atomPositions, excludeIds
    );

    if (bestResult && bestResult.conflictCount < initialConflicts.length) {
      applyRotation(bestResult.positions, atomPositions);
      const newConflicts = detectConflicts(attachedIds, atomPositions, excludeIds);
      console.log(`[resolveConflictByRotation] Step2: 绕内部键 ${rb.a1}-${rb.a2} 旋转 ${bestResult.angle.toFixed(1)}°, 冲突 ${initialConflicts.length}→${newConflicts.length}`);
      if (newConflicts.length === 0) return;
    }
  }

  // ---- Step 3: 仍有残留冲突，记录警告 ----
  const finalConflicts = detectConflicts(attachedIds, atomPositions, excludeIds);
  if (finalConflicts.length > 0) {
    console.warn(`[resolveConflictByRotation] 仍有 ${finalConflicts.length} 个残留冲突无法通过旋转解决`);
  }
}

/** 采样旋转角度，找到冲突最少的角度（5°步长，±180°范围） */
function sampleBestRotation(
  rotateIndices: number[],
  pivotIdx: number,
  anchorIdx: number,
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  excludeIds: string[]
): { angle: number; conflictCount: number; positions: Map<string, { x: number; y: number; z: number }> } | null {
  const STEP = 5 * Math.PI / 180; // 5° 步长
  const MAX_ANGLE = Math.PI;       // ±180°
  const rotateIds = rotateIndices.map(i => parsedAtoms[i].id);

  let bestAngle = 0;
  let bestConflictCount = Infinity;
  let bestPositions: Map<string, { x: number; y: number; z: number }> | null = null;

  // 先检测当前冲突数
  const currentConflicts = detectConflicts(rotateIds, atomPositions, excludeIds);
  bestConflictCount = currentConflicts.length;

  for (let angle = STEP; angle <= MAX_ANGLE; angle += STEP) {
    for (const sign of [1, -1]) {
      const rotAngle = sign * angle;
      const rotated = rotateGroupAroundBond(
        rotateIndices, pivotIdx, anchorIdx, rotAngle,
        parsedAtoms, atomPositions
      );

      if (rotated.size === 0) continue;

      // 临时应用旋转，检测冲突
      const saved = new Map<string, { x: number; y: number; z: number }>();
      for (const [id, pos] of rotated) {
        saved.set(id, atomPositions.get(id)!);
        atomPositions.set(id, pos);
      }

      const conflicts = detectConflicts(rotateIds, atomPositions, excludeIds);

      // 恢复
      for (const [id, pos] of saved) {
        atomPositions.set(id, pos);
      }

      if (conflicts.length < bestConflictCount ||
          (conflicts.length === bestConflictCount && Math.abs(rotAngle) < Math.abs(bestAngle))) {
        bestConflictCount = conflicts.length;
        bestAngle = rotAngle;
        bestPositions = rotated;
      }

      if (bestConflictCount === 0) break;
    }
    if (bestConflictCount === 0) break;
  }

  if (bestPositions && bestConflictCount < currentConflicts.length) {
    return { angle: bestAngle * 180 / Math.PI, conflictCount: bestConflictCount, positions: bestPositions };
  }

  return null;
}

/** 应用旋转结果到 atomPositions */
function applyRotation(
  rotated: Map<string, { x: number; y: number; z: number }>,
  atomPositions: Map<string, { x: number; y: number; z: number }>
): void {
  for (const [id, pos] of rotated) {
    atomPositions.set(id, pos);
  }
}

/** 计算两个原子索引的中点 */
function midpoint(
  idx1: number,
  idx2: number,
  parsedAtoms: ParsedAtom[],
  atomPositions: Map<string, { x: number; y: number; z: number }>
): { x: number; y: number; z: number } {
  const p1 = atomPositions.get(parsedAtoms[idx1].id) || { x: 0, y: 0, z: 0 };
  const p2 = atomPositions.get(parsedAtoms[idx2].id) || { x: 0, y: 0, z: 0 };
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, z: (p1.z + p2.z) / 2 };
}

/** 全局冲突矫正：遍历所有冲突，逐个尝试通过旋转解决 */
function resolveGlobalConflicts(
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  ringAtomIndices: Set<number>
): void {
  const MAX_ITERATIONS = 10; // 最多迭代10轮，避免无限循环

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // 检测所有非键原子间的冲突
    const conflicts = detectAllConflicts(parsedAtoms, parsedBonds, atomPositions);
    if (conflicts.length === 0) {
      console.log(`[resolveGlobalConflicts] 第${iteration + 1}轮：无冲突，完成`);
      return;
    }
    console.log(`[resolveGlobalConflicts] 第${iteration + 1}轮：检测到 ${conflicts.length} 个冲突`);

    let resolved = false;
    for (const conflict of conflicts) {
      const idx1 = parsedAtoms.findIndex(a => a.id === conflict.id1);
      const idx2 = parsedAtoms.findIndex(a => a.id === conflict.id2);
      if (idx1 < 0 || idx2 < 0) continue;

      // 尝试找到连接冲突原子对的可旋转键
      const resolvedThis = tryResolveConflictPair(
        idx1, idx2, parsedAtoms, parsedBonds, atomPositions, ringAtomIndices
      );
      if (resolvedThis) {
        resolved = true;
        break; // 解决一个冲突后重新检测，因为位置已变化
      }
    }

    if (!resolved) {
      console.warn(`[resolveGlobalConflicts] 第${iteration + 1}轮：无法通过旋转解决剩余冲突`);
      return;
    }
  }
  console.warn(`[resolveGlobalConflicts] 达到最大迭代次数 ${MAX_ITERATIONS}`);
}

/** 检测所有非键原子间的空间冲突 */
function detectAllConflicts(
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>
): { id1: string; id2: string; dist: number }[] {
  const conflicts: { id1: string; id2: string; dist: number }[] = [];

  // 构建键的邻接集合（用于排除键连原子）
  const bondedPairs = new Set<string>();
  for (const b of parsedBonds) {
    bondedPairs.add(`${b.a1}-${b.a2}`);
    bondedPairs.add(`${b.a2}-${b.a1}`);
  }

  for (let i = 0; i < parsedAtoms.length; i++) {
    const posI = atomPositions.get(parsedAtoms[i].id);
    if (!posI) continue;

    for (let j = i + 1; j < parsedAtoms.length; j++) {
      // 跳过键连原子
      if (bondedPairs.has(`${i}-${j}`)) continue;

      const posJ = atomPositions.get(parsedAtoms[j].id);
      if (!posJ) continue;

      const dx = posI.x - posJ.x;
      const dy = posI.y - posJ.y;
      const dz = posI.z - posJ.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < MIN_ATOM_DISTANCE) {
        conflicts.push({ id1: parsedAtoms[i].id, id2: parsedAtoms[j].id, dist });
      }
    }
  }

  return conflicts;
}

/** 尝试解决一对冲突原子 */
function tryResolveConflictPair(
  idx1: number,
  idx2: number,
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  ringAtomIndices: Set<number>
): boolean {
  // 策略：找到 idx1 和 idx2 之间的路径，在路径上找可旋转键
  // 旋转冲突原子所在的那一侧

  // 找 idx1 和 idx2 之间的最短路径（BFS）
  const path = findShortestPath(idx1, idx2, parsedBonds, parsedAtoms.length);
  if (!path || path.length < 2) return false;

  // 在路径上找可旋转键
  for (let k = 0; k < path.length - 1; k++) {
    const a = path[k];
    const b = path[k + 1];

    if (!isBondRotatable(a, b, parsedAtoms, parsedBonds, ringAtomIndices)) continue;

    // 确定旋转哪一侧：选择包含 idx1 或 idx2 中较近的那一侧
    // 从 a 出发不经过 b 可达的原子集合
    const sideA = getGroupOnSide(a, b, parsedBonds, parsedAtoms.length);
    // 从 b 出发不经过 a 可达的原子集合
    const sideB = getGroupOnSide(b, a, parsedBonds, parsedAtoms.length);

    // 选择包含冲突原子较少的那一侧旋转（旋转代价最小）
    const sideAHasConflict1 = sideA.includes(idx1);
    const sideAHasConflict2 = sideA.includes(idx2);
    const sideBHasConflict1 = sideB.includes(idx1);
    const sideBHasConflict2 = sideB.includes(idx2);

    let rotateIndices: number[];
    let pivotIdx: number, anchorIdx: number;

    if (sideAHasConflict1 && !sideAHasConflict2) {
      // idx1 在 sideA，旋转 sideA 使 idx1 远离 idx2
      rotateIndices = sideA;
      pivotIdx = a;
      anchorIdx = b;
    } else if (sideBHasConflict1 && !sideBHasConflict2) {
      // idx1 在 sideB，旋转 sideB
      rotateIndices = sideB;
      pivotIdx = b;
      anchorIdx = a;
    } else if (!sideAHasConflict1 && sideAHasConflict2) {
      // idx2 在 sideA，旋转 sideA 使 idx2 远离 idx1
      rotateIndices = sideA;
      pivotIdx = a;
      anchorIdx = b;
    } else if (!sideBHasConflict1 && sideBHasConflict2) {
      // idx2 在 sideB，旋转 sideB
      rotateIndices = sideB;
      pivotIdx = b;
      anchorIdx = a;
    } else {
      // 两个冲突原子在同一侧或都在两侧，选择较小的一侧
      if (sideA.length <= sideB.length) {
        rotateIndices = sideA;
        pivotIdx = a;
        anchorIdx = b;
      } else {
        rotateIndices = sideB;
        pivotIdx = b;
        anchorIdx = a;
      }
    }

    // 排除环原子（环内原子不参与旋转）
    rotateIndices = rotateIndices.filter(i => !ringAtomIndices.has(i));
    if (rotateIndices.length === 0) continue;

    const excludeIds = [parsedAtoms[idx1].id, parsedAtoms[idx2].id];
    const bestResult = sampleBestRotation(
      rotateIndices, pivotIdx, anchorIdx,
      parsedAtoms, parsedBonds, atomPositions, excludeIds
    );

    if (bestResult && bestResult.conflictCount < detectConflicts(
      rotateIndices.map(i => parsedAtoms[i].id), atomPositions, excludeIds
    ).length) {
      applyRotation(bestResult.positions, atomPositions);
      console.log(`[tryResolveConflictPair] 绕键 ${pivotIdx}-${anchorIdx} 旋转 ${bestResult.angle.toFixed(1)}° 解决冲突 ${idx1}-${idx2}`);
      return true;
    }
  }

  return false;
}

/** BFS 找两个原子之间的最短路径 */
function findShortestPath(
  startIdx: number,
  endIdx: number,
  parsedBonds: { a1: number; a2: number; order: number }[],
  totalAtoms: number
): number[] | null {
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: number[] = [startIdx];
  visited.add(startIdx);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === endIdx) {
      // 回溯路径
      const path: number[] = [endIdx];
      let p = endIdx;
      while (parent.has(p)) {
        p = parent.get(p)!;
        path.unshift(p);
      }
      return path;
    }

    for (const b of parsedBonds) {
      let next = -1;
      if (b.a1 === cur) next = b.a2;
      else if (b.a2 === cur) next = b.a1;
      if (next >= 0 && !visited.has(next)) {
        visited.add(next);
        parent.set(next, cur);
        queue.push(next);
      }
    }
  }

  return null;
}

/**
 * 解决 H 原子与其他原子的空间冲突
 * 策略：找到冲突 H 原子的父原子，绕父原子的可旋转键旋转 H 原子所在子结构
 */
function resolveHAtomConflicts(
  resultAtoms: Atom[],
  resultBonds: Bond[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  ringAtomIndices: Set<number>
): void {
  // 构建 resultAtoms 的邻接表（用于找 H 的父原子）
  const resultAdj = new Map<string, string[]>();
  for (const atom of resultAtoms) {
    resultAdj.set(atom.id, []);
  }
  for (const bond of resultBonds) {
    if (bond.atom1Id !== null && bond.atom2Id !== null) {
      resultAdj.get(bond.atom1Id)?.push(bond.atom2Id);
      resultAdj.get(bond.atom2Id)?.push(bond.atom1Id);
    }
  }

  // 找出所有 H 原子
  const hAtoms = resultAtoms.filter(a => a.symbol === 'H');
  const heavyAtomIds = new Set(resultAtoms.filter(a => a.symbol !== 'H').map(a => a.id));

  // 为每个 H 原子找父原子
  const hParentMap = new Map<string, string>(); // hId -> parentId
  for (const hAtom of hAtoms) {
    const neighbors = resultAdj.get(hAtom.id) || [];
    const heavyNeighbor = neighbors.find(n => heavyAtomIds.has(n));
    if (heavyNeighbor) {
      hParentMap.set(hAtom.id, heavyNeighbor);
    }
  }

  // 检测 H 原子冲突
  const MAX_ITERATIONS = 5;
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let anyResolved = false;

    for (const hAtom of hAtoms) {
      const hPos = atomPositions.get(hAtom.id);
      if (!hPos) continue;

      // 检查这个 H 原子是否与其他非键原子冲突
      let hasConflict = false;
      let conflictAtomId = '';
      atomPositions.forEach((otherPos, otherId) => {
        if (otherId === hAtom.id) return;
        // 排除 H 的父原子（键连）
        if (hParentMap.get(hAtom.id) === otherId) return;
        const dx = hPos.x - otherPos.x;
        const dy = hPos.y - otherPos.y;
        const dz = hPos.z - otherPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < MIN_ATOM_DISTANCE) {
          hasConflict = true;
          conflictAtomId = otherId;
        }
      });

      if (!hasConflict) continue;

      // 找到 H 的父原子在 parsedAtoms 中的索引
      const parentId = hParentMap.get(hAtom.id);
      if (!parentId) continue;
      const parentIdx = parsedAtoms.findIndex(a => a.id === parentId);
      if (parentIdx < 0) continue;

      // 找父原子的所有可旋转键
      const parentBonds = parsedBonds.filter(b => b.a1 === parentIdx || b.a2 === parentIdx);
      for (const pb of parentBonds) {
        const otherIdx = pb.a1 === parentIdx ? pb.a2 : pb.a1;
        if (!isBondRotatable(parentIdx, otherIdx, parsedAtoms, parsedBonds, ringAtomIndices)) continue;

        // 确定旋转哪一侧：旋转包含 H 原子父原子的那一侧（即远离 otherIdx 的那一侧）
        const sideParent = getGroupOnSide(parentIdx, otherIdx, parsedBonds, parsedAtoms.length);
        const sideOther = getGroupOnSide(otherIdx, parentIdx, parsedBonds, parsedAtoms.length);

        // 选择较小的一侧旋转
        let rotateIndices: number[];
        let pivotIdx: number, anchorIdx: number;

        if (sideParent.length <= sideOther.length) {
          rotateIndices = sideParent.filter(i => !ringAtomIndices.has(i));
          pivotIdx = parentIdx;
          anchorIdx = otherIdx;
        } else {
          rotateIndices = sideOther.filter(i => !ringAtomIndices.has(i));
          pivotIdx = otherIdx;
          anchorIdx = parentIdx;
        }

        if (rotateIndices.length === 0) continue;

        // 采样旋转
        const excludeIds = [hAtom.id, parentId, conflictAtomId];
        const bestResult = sampleBestRotation(
          rotateIndices, pivotIdx, anchorIdx,
          parsedAtoms, parsedBonds, atomPositions, excludeIds
        );

        if (bestResult) {
          applyRotation(bestResult.positions, atomPositions);
          // 更新 resultAtoms 的位置
          for (const atom of resultAtoms) {
            const pos = atomPositions.get(atom.id);
            if (pos) atom.position = pos;
          }
          console.log(`[resolveHAtomConflicts] 绕键 ${pivotIdx}-${anchorIdx} 旋转 ${bestResult.angle.toFixed(1)}° 解决H原子 ${hAtom.id} 冲突`);
          anyResolved = true;
          break;
        }
      }
    }

    if (!anyResolved) break;
  }
}

function splitIntoFragments(
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[]
): number[][] {
  const visited = new Set<number>();
  const fragments: number[][] = [];
  
  for (let i = 0; i < parsedAtoms.length; i++) {
    if (visited.has(i)) continue;
    
    const fragment: number[] = [];
    const queue: number[] = [i];
    visited.add(i);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      fragment.push(current);
      
      parsedBonds.forEach(b => {
        if (b.a1 === current && !visited.has(b.a2)) {
          visited.add(b.a2);
          queue.push(b.a2);
        }
        if (b.a2 === current && !visited.has(b.a1)) {
          visited.add(b.a1);
          queue.push(b.a1);
        }
      });
    }
    
    fragments.push(fragment);
  }
  
  return fragments;
}

function positionIndependentFragments(
  fragments: number[][],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  parsedAtoms: ParsedAtom[]
): void {
  if (fragments.length <= 1) return;
  
  let currentOffset = 0;
  const fragmentSpacing = 5.0;
  
  for (let i = 1; i < fragments.length; i++) {
    currentOffset += fragmentSpacing;
    
    const fragment = fragments[i];
    const firstAtomIdx = fragment[0];
    const firstAtom = parsedAtoms[firstAtomIdx];
    const firstAtomPos = atomPositions.get(firstAtom.id);
    
    if (firstAtomPos) {
      const offset = { x: currentOffset, y: 0, z: 0 };
      
      fragment.forEach(idx => {
        const atom = parsedAtoms[idx];
        const pos = atomPositions.get(atom.id);
        if (pos) {
          atomPositions.set(atom.id, {
            x: pos.x + offset.x,
            y: pos.y + offset.y,
            z: pos.z + offset.z,
          });
        }
      });
    }
  }
}

function checkForOverlaps(
  atomPositions: Map<string, { x: number; y: number; z: number }>
): string[] {
  const warnings: string[] = [];
  const positions = Array.from(atomPositions.entries());
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [id1, pos1] = positions[i];
      const [id2, pos2] = positions[j];
      const dist = distance(pos1, pos2);
      
      if (dist < MIN_ATOM_DISTANCE * 0.8) {
        warnings.push(`原子重叠警告: ${id1} 和 ${id2} 距离 ${dist.toFixed(3)}Å`);
      }
    }
  }
  
  return warnings;
}

function resolveOverlaps(
  atomPositions: Map<string, { x: number; y: number; z: number }>
): void {
  const positions = Array.from(atomPositions.entries());
  let changed = true;
  let iterations = 0;
  const maxIterations = 50;
  let currentThreshold = MIN_ATOM_DISTANCE;
  
  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    
    if (iterations > maxIterations / 2) {
      currentThreshold = MIN_ATOM_DISTANCE * 1.1;
    }
    
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const [id1, pos1] = positions[i];
        const [id2, pos2] = positions[j];
        const dist = distance(pos1, pos2);
        
        if (dist < currentThreshold) {
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const dz = pos2.z - pos1.z;
          const len = dist || 0.001;
          
          const pushDist = (currentThreshold - dist) / 2 + 0.15;
          const scale = pushDist / len;
          
          const newPos1 = {
            x: pos1.x - dx * scale,
            y: pos1.y - dy * scale,
            z: pos1.z - dz * scale,
          };
          const newPos2 = {
            x: pos2.x + dx * scale,
            y: pos2.y + dy * scale,
            z: pos2.z + dz * scale,
          };
          
          atomPositions.set(id1, newPos1);
          atomPositions.set(id2, newPos2);
          positions[i] = [id1, newPos1];
          positions[j] = [id2, newPos2];
          changed = true;
        }
      }
    }
    
    if (iterations % 10 === 0) {
      const center = { x: 0, y: 0, z: 0 };
      let count = 0;
      positions.forEach(([_, pos]) => {
        center.x += pos.x;
        center.y += pos.y;
        center.z += pos.z;
        count++;
      });
      if (count > 0) {
        center.x /= count;
        center.y /= count;
        center.z /= count;
        
        positions.forEach(([id, pos]) => {
          const newPos = {
            x: pos.x - center.x,
            y: pos.y - center.y,
            z: pos.z - center.z,
          };
          atomPositions.set(id, newPos);
        });
      }
    }
  }
}

type ParsedAtom = ParsedAtomType;

interface SmilesToken {
  type: 'atom' | 'bond' | 'branch_start' | 'branch_end' | 'ring' | 'dot';
  value: string;
}

const ELEMENTS = ELEMENTS_SET;

const AROMATIC_SYMBOLS = new Set(['c', 'n', 'o', 's', 'p']);

function tokenize(smiles: string): SmilesToken[] {
  const tokens: SmilesToken[] = [];
  let i = 0;
  console.log(`[tokenize] 开始tokenize SMILES: ${smiles}`);
  while (i < smiles.length) {
    const c = smiles[i];
    console.log(`[tokenize] i=${i}, char='${c}'`);
    if (c === '(') {
      tokens.push({ type: 'branch_start', value: '(' });
      i++;
    } else if (c === ')') {
      tokens.push({ type: 'branch_end', value: ')' });
      i++;
    } else if (c === '-' || c === '=' || c === '#' || c === ':' || c === '/' || c === '\\') {
      tokens.push({ type: 'bond', value: c });
      i++;
    } else if (c === '.') {
      tokens.push({ type: 'dot', value: '.' });
      i++;
    } else if (c >= '0' && c <= '9') {
      // SMILES规则: 单个数字字符代表一个环闭合
      // 连续数字代表多个环闭合，如"12" → 环1和环2，而不是环12
      while (i < smiles.length && smiles[i] >= '0' && smiles[i] <= '9') {
        tokens.push({ type: 'ring', value: smiles[i] });
        i++;
      }
    } else if (c === '[') {
      let bracketContent = '';
      i++;
      while (i < smiles.length && smiles[i] !== ']') {
        bracketContent += smiles[i];
        i++;
      }
      if (i < smiles.length) i++;
      tokens.push({ type: 'atom', value: `[${bracketContent}]` });
    } else if (c >= 'A' && c <= 'Z') {
      let symbol = c;
      i++;
      if (i < smiles.length && smiles[i] >= 'a' && smiles[i] <= 'z') {
        const possibleTwoLetter = symbol + smiles[i];
        if (ELEMENTS.has(possibleTwoLetter)) {
          symbol = possibleTwoLetter;
          i++;
        }
      }
      tokens.push({ type: 'atom', value: symbol });
    } else if (AROMATIC_SYMBOLS.has(c)) {
      tokens.push({ type: 'atom', value: c });
      i++;
    } else {
      i++;
    }
  }
  console.log(`[tokenize] 完成，共${tokens.length}个tokens`);
  return tokens;
}

function parseSmiles(smiles: string): { atoms: ParsedAtom[]; bonds: { a1: number; a2: number; order: number }[] } {
  console.log(`[parseSmiles] 开始解析SMILES: ${smiles}`);
  const tokens = tokenize(smiles);
  console.log(`[parseSmiles] 解析到 ${tokens.length} 个tokens:`);
  tokens.forEach((t, i) => console.log(`  Token ${i}: type=${t.type}, value=${t.value}`));
  const atoms: ParsedAtom[] = [];
  const bonds: { a1: number; a2: number; order: number }[] = [];
  const ringClosureMap: Map<number, { index: number; order: number }> = new Map();

  const stack: number[] = [];

  function addAtom(symbol: string, charge?: number, explicitH?: number) {
    const id = generateUUID();
    const isAromatic = symbol.charAt(0) === symbol.charAt(0).toLowerCase() && symbol.charAt(0) !== symbol.charAt(0).toUpperCase();
    const atomIdx = atoms.length;
    // 对于带括号的原子，如果是小写开头（比如 [nH]），symbol应该是基础元素（比如 'N'），而不是 'nH'！
    const finalSymbol = isAromatic ? symbol.toUpperCase().charAt(0) : symbol;
    console.log(`[parseSmiles] 添加原子: idx=${atomIdx}, originalSymbol=${symbol}, finalSymbol=${finalSymbol}, isAromatic=${isAromatic}, explicitH=${explicitH}`);
    atoms.push({
      id,
      symbol: finalSymbol,
      bonds: new Map(),
      aromatic: isAromatic,
      branch: 0,
      ringClosures: [],
      charge,
      explicitH: explicitH || 0,
    });
    return atomIdx;
  }

  function addBond(a1: number, a2: number, order: number) {
    if (a1 === a2) return;
    const existingOrder = atoms[a1].bonds.get(atoms[a2].id);
    if (existingOrder && existingOrder >= order) return;
    atoms[a1].bonds.set(atoms[a2].id, order);
    atoms[a2].bonds.set(atoms[a1].id, order);
    bonds.push({ a1, a2, order });
  }

  function getBondOrder(token: string): number {
    switch (token) {
      case '=': return 2;
      case '#': return 3;
      case ':': return 1;
      case '/': case '\\': return 1;
      default: return 1;
    }
  }

  let prevAtomIndex = -1;
  let defaultBond = 1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'atom') {
      let symbol = token.value;
      let charge: number | undefined;
      let explicitH = 0;
      
      console.log(`[parseSmiles] 处理atom token ${i}: value=${token.value}`);
      
      if (symbol.startsWith('[')) {
        const rawBracketContent = symbol;
        let content = symbol.slice(1, -1);
        console.log(`[parseSmiles] 解析带括号的原子: 原始=${rawBracketContent}, 内容=${content}`);
        
        let cleanSymbol = '';
        let j = 0;
        explicitH = 0; // 复用前面声明的变量
        
        // 1. 优先识别 [elementHn] 格式 - 先找 H 或 h 分割点
        let hIndex = content.indexOf('H');
        if (hIndex < 0) {
          hIndex = content.indexOf('h');
        }
        if (hIndex > 0) {
          // 找到 H 了，前面是元素符号
          cleanSymbol = content.substring(0, hIndex);
          j = hIndex + 1;
          // 读取 H 后面的数字
          let hCountStr = '';
          while (j < content.length && content[j] >= '0' && content[j] <= '9') {
            hCountStr += content[j];
            j++;
          }
          explicitH = hCountStr ? parseInt(hCountStr) : 1;
        } else {
          // 2. 没有 H，按标准元素匹配
          if (content.length >= 2) {
            const twoLetter = content.charAt(0).toUpperCase() + content.charAt(1).toLowerCase();
            if (ELEMENTS.has(twoLetter)) {
              cleanSymbol = content.substring(0, 2);
              j = 2;
            }
          }
          if (!cleanSymbol && content.length >= 1) {
            const oneLetter = content.charAt(0).toUpperCase();
            if (ELEMENTS.has(oneLetter)) {
              cleanSymbol = content.charAt(0);
              j = 1;
            }
          }
          if (!cleanSymbol && content.length >= 1) {
            cleanSymbol = content.charAt(0);
            j = 1;
          }
        }
        
        symbol = cleanSymbol;
        console.log(`[parseSmiles] 解析带括号的原子: 元素符号=${symbol}, 显式H=${explicitH}`);
        
        const chargeMatch = rawBracketContent.match(/([+-])(\d*)/);
        if (chargeMatch) {
          const sign = chargeMatch[1] === '+' ? 1 : -1;
          const num = chargeMatch[2] ? parseInt(chargeMatch[2]) : 1;
          charge = sign * num;
        }
      }
      const idx = addAtom(symbol, charge, explicitH);

      if (prevAtomIndex >= 0) {
        addBond(prevAtomIndex, idx, defaultBond);
      } else if (stack.length > 0) {
        const branchParent = stack[stack.length - 1];
        addBond(branchParent, idx, defaultBond);
      }

      prevAtomIndex = idx;
      defaultBond = 1;
    } else if (token.type === 'bond') {
      defaultBond = getBondOrder(token.value);
    } else if (token.type === 'branch_start') {
      if (prevAtomIndex >= 0) {
        stack.push(prevAtomIndex);
      }
      defaultBond = 1;
    } else if (token.type === 'branch_end') {
      if (stack.length > 0) {
        const branchParent = stack.pop()!;
        prevAtomIndex = branchParent;
      }
      defaultBond = 1;
    } else if (token.type === 'ring') {
      const ringNum = parseInt(token.value);
      if (ringClosureMap.has(ringNum)) {
        const closure = ringClosureMap.get(ringNum)!;
        if (prevAtomIndex >= 0) {
          addBond(closure.index, prevAtomIndex, closure.order);
        }
        ringClosureMap.delete(ringNum);
      } else {
        if (prevAtomIndex >= 0) {
          ringClosureMap.set(ringNum, { index: prevAtomIndex, order: defaultBond });
        }
      }
      defaultBond = 1;
    } else if (token.type === 'dot') {
      prevAtomIndex = -1;
      stack.length = 0;
      defaultBond = 1;
    }
  }

  console.log('[parseSmiles] Before assignAromaticBondOrders: bonds array:');
  bonds.forEach((b, i) => {
    console.log(`  Bond ${i}: ${b.a1}(${atoms[b.a1].symbol}) - ${b.a2}(${atoms[b.a2].symbol}), order=${b.order}`);
  });
  assignAromaticBondOrders(atoms, bonds);

  console.log('[parseSmiles] After assignAromaticBondOrders:');
  atoms.forEach((a, i) => {
    console.log(`  Atom ${i}: ${a.symbol}, aromatic: ${a.aromatic}, bonds:`, Object.fromEntries(a.bonds));
  });

  return { atoms, bonds };
}

function sortRingAtoms(ring: number[], bonds: { a1: number; a2: number; order: number }[]): number[] {
  if (ring.length <= 1) return ring;
  
  const adj: Map<number, number[]> = new Map();
  for (const b of bonds) {
    if (ring.includes(b.a1) && ring.includes(b.a2)) {
      if (!adj.has(b.a1)) adj.set(b.a1, []);
      if (!adj.has(b.a2)) adj.set(b.a2, []);
      adj.get(b.a1)!.push(b.a2);
      adj.get(b.a2)!.push(b.a1);
    }
  }

  const sorted: number[] = [ring[0]];
  let prev = -1;
  let current = ring[0];
  for (let i = 1; i < ring.length; i++) {
    const neighbors = adj.get(current) || [];
    const next = neighbors.find(n => n !== prev && !sorted.includes(n));
    if (next === undefined) break;
    sorted.push(next);
    prev = current;
    current = next;
  }
  return sorted;
}

function assignAromaticBondOrders(
  atoms: ParsedAtom[],
  bonds: { a1: number; a2: number; order: number }[]
): void {
  const aromaticAtoms = new Set<number>();
  atoms.forEach((atom, idx) => {
    if (atom.aromatic) {
      aromaticAtoms.add(idx);
    }
  });

  console.log('[assignAromaticBondOrders] 芳香原子数量:', aromaticAtoms.size);
  console.log('[assignAromaticBondOrders] 芳香原子索引:', Array.from(aromaticAtoms).join(', '));

  if (aromaticAtoms.size === 0) return;

  const ringSizeMap = new Map<number, number>();
  const ringMembership = new Map<number, number[]>();

  function findAromaticRings(): void {
    const tempRings: {size: number, ring: number[]}[] = [];
    const visited = new Set<string>();
    
    const n = atoms.length;
    const adj: number[][] = Array.from({length: n}, () => []);
    
    bonds.forEach(b => {
      if (aromaticAtoms.has(b.a1) && aromaticAtoms.has(b.a2)) {
        adj[b.a1].push(b.a2);
        adj[b.a2].push(b.a1);
      }
    });
    
    // 对每个三元组以上找环
    for (let start = 0; start < n; start++) {
      if (!aromaticAtoms.has(start)) continue;
      
      // 深度优先找从start出发的所有简单环
      const stack: {node: number, prev: number, path: number[]}[] = [];
      stack.push({node: start, prev: -1, path: [start]});
      
      while (stack.length > 0) {
        const { node, prev, path } = stack.pop()!;
        
        for (const neighbor of adj[node]) {
          if (neighbor === prev) continue;
          
          if (neighbor === start && path.length >= 3) {
            // 找到一个环！
            const ring = [...path, neighbor];
            if (ring.length <= 8) {
              const key = [...ring].sort((a,b)=>a-b).join('-');
              if (!visited.has(key)) {
                visited.add(key);
                const sortedRing = sortRingAtoms([...path], bonds);
                tempRings.push({size: path.length, ring: sortedRing});
                console.log(`[assignAromaticBondOrders] 发现候选环: 原子索引=[${path.join(',')}] 大小=${path.length}`);
              }
            }
          } else if (!path.includes(neighbor)) {
            if (path.length < 7) { // 限制深度，避免爆炸
              stack.push({ node: neighbor, prev: node, path: [...path, neighbor] });
            }
          }
        }
      }
    }
    
    console.log(`[assignAromaticBondOrders] 所有候选环 (共${tempRings.length}个):`);
    tempRings.forEach((tr, i) => {
      console.log(`  ${i+1}. [${tr.ring.join(',')}] 大小=${tr.size}`);
    });
    
    // 为每个原子选择最小的环
    tempRings.sort((a, b) => a.size - b.size); // 先处理小环！
    for (const {size, ring} of tempRings) {
      ring.forEach(idx => {
        if (!ringSizeMap.has(idx) || size < ringSizeMap.get(idx)!) {
          ringSizeMap.set(idx, size);
          ringMembership.set(idx, ring);
        }
      });
    }
  }

  findAromaticRings();

  console.log('[assignAromaticBondOrders] 环成员数量:', ringMembership.size);
  
  // 打印最终选择的环
  const processedUniqueRings = new Set<string>();
  ringMembership.forEach((ring) => {
    const key = [...ring].sort((a, b) => a - b).join('-');
    if (!processedUniqueRings.has(key)) {
      processedUniqueRings.add(key);
      console.log(`[assignAromaticBondOrders] 最终选择环: [${ring.join(',')}] 大小=${ring.length}`);
    }
  });

  const processedBondPairs = new Set<string>();
  const processedRings = new Set<string>(); // 防止处理同一个环多次
  
  // 首先从 ringMembership 中提取唯一的环
  const uniqueRings: number[][] = [];
  ringMembership.forEach((ring, _) => {
    const key = [...ring].sort((a, b) => a - b).join('-');
    if (!processedRings.has(key)) {
      processedRings.add(key);
      uniqueRings.push(ring);
    }
  });
  
  uniqueRings.forEach((ring) => {
    if (ring.length === 0) return;

    console.log(`[assignAromaticBondOrders] 处理环: [${ring.join(',')}] (大小=${ring.length})`);
    
    // 统计环中C和N的数量
    let cCount = 0;
    let nCount = 0;
    ring.forEach(idx => {
      if (atoms[idx].symbol === 'C') cCount++;
      if (atoms[idx].symbol === 'N') nCount++;
    });
    
    console.log(`  环组成: C=${cCount}, N=${nCount}`);
    
    // 特殊情况：四唑环（5元环，1个C，4个N）
    const isTetrazole = ring.length === 5 && cCount === 1 && nCount === 4;
    
    // 特殊情况：吡咯型5元杂环（5元环，3个C，2个N）
    const isPyrrole = ring.length === 5 && cCount === 3 && nCount === 2;
    
    if (isTetrazole) {
      console.log(`  检测到四唑环！`);
      
      // 找到C原子在环中的位置
      let cIndexInRing = -1;
      for (let k = 0; k < ring.length; k++) {
        if (atoms[ring[k]].symbol === 'C') {
          cIndexInRing = k;
          break;
        }
      }
      
      if (cIndexInRing !== -1) {
        console.log(`  四唑的C原子在环中位置: ${cIndexInRing}, idx=${ring[cIndexInRing]}`);
        
        // 对于四唑，正确的键序分配：
        // 保证C的化合价是4，所有N的化合价一致（27号N因为连接K所以化合价也是3）
        for (let offset = 0; offset < ring.length; offset++) {
          const i = (cIndexInRing + offset) % ring.length;
          const j = (cIndexInRing + offset + 1) % ring.length;
          const a1 = ring[i];
          const a2 = ring[j];
          
          const bondKey = Math.min(a1, a2) + '-' + Math.max(a1, a2);
          if (processedBondPairs.has(bondKey)) continue;
          
          const bondIdx = bonds.findIndex(b => 
            (b.a1 === a1 && b.a2 === a2) || (b.a1 === a2 && b.a2 === a1)
          );
          
          if (bondIdx !== -1) {
            const oldOrder = bonds[bondIdx].order;
            let newOrder = 1;
            
            // 新的键序分配方案：
            // offset 0 (23-24): 双键 → 保证23有双键，总键序4
            // offset 1 (24-25): 单键
            // offset 2 (25-26): 双键
            // offset 3 (26-27): 单键
            // offset 4 (27-23): 单键 → 这样C的总键序是 1（苯环） +2 +1 =4 ✔️
            // 所有N的总键序都是3 ✔️
            if (offset === 0 || offset === 2) {
              newOrder = 2;
            } else {
              newOrder = 1;
            }
            
            bonds[bondIdx].order = newOrder;
            processedBondPairs.add(bondKey);
            console.log(`  键 ${a1}(${atoms[a1].symbol}) - ${a2}(${atoms[a2].symbol}): order ${oldOrder} -> ${newOrder}`);
            atoms[a1].bonds.set(atoms[a2].id, newOrder);
            atoms[a2].bonds.set(atoms[a1].id, newOrder);
          }
        }
        return; // 四唑处理完毕，直接返回
      }
    }
    
    // 特殊情况：吡咯型5元杂环（3个C，2个N）
    if (isPyrrole) {
      console.log(`  检测到吡咯型5元杂环！`);
      
      // 找到两个N在环中的位置
      let nIndices: number[] = [];
      for (let k = 0; k < ring.length; k++) {
        if (atoms[ring[k]].symbol === 'N') {
          nIndices.push(k);
        }
      }
      
      if (nIndices.length === 2) {
        console.log(`  吡咯的N原子在环中位置: ${nIndices.join(', ')}, idx=${ring[nIndices[0]]}, ${ring[nIndices[1]]}`);
        
        // 对于咪唑型5元杂环，正确的键序分配：
        // 确保每个原子的总键序正确
        // 从有侧链的原子开始，单双键交替
        // 环内有两个双键
        for (let offset = 0; offset < ring.length; offset++) {
          const i = offset;
          const j = (offset + 1) % ring.length;
          const a1 = ring[i];
          const a2 = ring[j];
          
          const bondKey = Math.min(a1, a2) + '-' + Math.max(a1, a2);
          if (processedBondPairs.has(bondKey)) continue;
          
          const bondIdx = bonds.findIndex(b => 
            (b.a1 === a1 && b.a2 === a2) || (b.a1 === a2 && b.a2 === a1)
          );
          
          if (bondIdx !== -1) {
            const oldOrder = bonds[bondIdx].order;
            let newOrder = 1;
            
            // 咪唑的正确双键分配：
            // 确保C原子的环内键序=3，N原子的环内键序=2（如果有环外键）或3（没有环外键）
            // 双键应该在：4(C)-5(N) 和 6(C)-8(C)
            if (offset === 0 || offset === 2) {
              newOrder = 2;
            } else {
              newOrder = 1;
            }
            
            bonds[bondIdx].order = newOrder;
            processedBondPairs.add(bondKey);
            console.log(`  键 ${a1}(${atoms[a1].symbol}) - ${a2}(${atoms[a2].symbol}): order ${oldOrder} -> ${newOrder}`);
            atoms[a1].bonds.set(atoms[a2].id, newOrder);
            atoms[a2].bonds.set(atoms[a1].id, newOrder);
          }
        }
        return; // 吡咯处理完毕，直接返回
      }
    }
    
    // 普通情况处理（非四唑）
    const isOdd = ring.length % 2 !== 0;
    let startIdx = 0;
    let foundStartWithSideChain = -1;
    for (let k = 0; k < ring.length; k++) {
      const atomIdx = ring[k];
      let hasSideChain = false;
      bonds.forEach(b => {
        let otherIdx = -1;
        if (b.a1 === atomIdx) otherIdx = b.a2;
        else if (b.a2 === atomIdx) otherIdx = b.a1;
        if (otherIdx !== -1 && !ring.includes(otherIdx)) {
          hasSideChain = true;
        }
      });
      if (hasSideChain) {
        foundStartWithSideChain = k;
        break;
      }
    }
    
    if (foundStartWithSideChain !== -1) {
      startIdx = foundStartWithSideChain;
    } else {
      for (let k = 0; k < ring.length; k++) {
        if (atoms[ring[k]].symbol === 'N') {
          startIdx = k;
          break;
        }
      }
    }

    for (let offset = 0; offset < ring.length; offset++) {
      const i = (startIdx + offset) % ring.length;
      const j = (startIdx + offset + 1) % ring.length;
      const a1 = ring[i];
      const a2 = ring[j];
      
      const bondKey = Math.min(a1, a2) + '-' + Math.max(a1, a2);
      if (processedBondPairs.has(bondKey)) continue;
      
      const bondIdx = bonds.findIndex(b => 
        (b.a1 === a1 && b.a2 === a2) || (b.a1 === a2 && b.a2 === a1)
      );
      
      if (bondIdx !== -1) {
        const oldOrder = bonds[bondIdx].order;
        let newOrder: number;
        if (isOdd) {
          newOrder = (offset % 2 === 1) ? 2 : 1;
          if (offset === ring.length - 1) {
            newOrder = 1;
          }
        } else {
          newOrder = (offset % 2 === 0) ? 2 : 1;
        }
        
        bonds[bondIdx].order = newOrder;
        processedBondPairs.add(bondKey);
        console.log(`  键 ${a1}(${atoms[a1].symbol}) - ${a2}(${atoms[a2].symbol}): order ${oldOrder} -> ${newOrder}`);
        atoms[a1].bonds.set(atoms[a2].id, newOrder);
        atoms[a2].bonds.set(atoms[a1].id, newOrder);
      }
    }
  });
}

function findRings(atoms: ParsedAtom[], bonds: { a1: number; a2: number; order: number }[]): number[][] {
  const rings: number[][] = [];
  const visited = new Set<number>();
  
  const adjList: number[][] = Array(atoms.length).fill(0).map(() => []);
  bonds.forEach(b => {
    adjList[b.a1].push(b.a2);
    adjList[b.a2].push(b.a1);
  });

  function dfs(current: number, parent: number, path: number[]): void {
    if (visited.has(current)) {
      const startIdx = path.indexOf(current);
      if (startIdx !== -1) {
        const ring = path.slice(startIdx);
        if (ring.length >= 3) {
          rings.push(ring);
        }
      }
      return;
    }

    visited.add(current);
    path.push(current);

    for (const neighbor of adjList[current]) {
      if (neighbor !== parent) {
        dfs(neighbor, current, [...path]);
      }
    }
  }

  for (let i = 0; i < atoms.length; i++) {
    if (!visited.has(i)) {
      dfs(i, -1, []);
    }
  }

  const uniqueRings: number[][] = [];
  const seen = new Set<string>();
  rings.forEach(ring => {
    const sorted = [...ring].sort((a, b) => a - b).join(',');
    if (!seen.has(sorted)) {
      seen.add(sorted);
      uniqueRings.push(ring);
    }
  });

  return uniqueRings;
}

function isBenzeneRing(ring: number[], atoms: ParsedAtom[]): boolean {
  if (ring.length !== 6) return false;
  return ring.every(idx => atoms[idx].symbol === 'C');
}

function applyFunctionalGroupConstraints(
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>
): void {
  const groups = identifyFunctionalGroups(parsedAtoms, parsedBonds);
  
  for (const group of groups) {
    if (group.type === 'carbonyl') {
      const [cIdx, oIdx] = group.atomIndices;
      const cAtom = parsedAtoms[cIdx];
      const oAtom = parsedAtoms[oIdx];
      
      const cPos = atomPositions.get(cAtom.id);
      const oPos = atomPositions.get(oAtom.id);
      
      if (cPos && !oPos) {
        const neighbors: { x: number; y: number; z: number }[] = [];
        parsedBonds.forEach(b => {
          if (b.a1 === cIdx || b.a2 === cIdx) {
            const nIdx = b.a1 === cIdx ? b.a2 : b.a1;
            const nPos = atomPositions.get(parsedAtoms[nIdx].id);
            if (nPos) neighbors.push(nPos);
          }
        });
        
        if (neighbors.length >= 2) {
          const bondLength = getBondLength(cAtom.symbol, 'O', 2);
          const d1 = { x: cPos.x - neighbors[0].x, y: cPos.y - neighbors[0].y, z: cPos.z - neighbors[0].z };
          const d2 = { x: cPos.x - neighbors[1].x, y: cPos.y - neighbors[1].y, z: cPos.z - neighbors[1].z };
          
          const sum = { x: d1.x + d2.x, y: d1.y + d2.y, z: d1.z + d2.z };
          const sumLen = Math.sqrt(sum.x * sum.x + sum.y * sum.y + sum.z * sum.z) || 1;
          const bisector = { x: -sum.x / sumLen, y: -sum.y / sumLen, z: -sum.z / sumLen };
          
          atomPositions.set(oAtom.id, {
            x: cPos.x + bisector.x * bondLength,
            y: cPos.y + bisector.y * bondLength,
            z: cPos.z + bisector.z * bondLength
          });
        }
      }
    } else if (group.type === 'carboxyl') {
      const [cIdx, doubleBondOIdx, singleBondOIdx] = group.atomIndices;
      const cAtom = parsedAtoms[cIdx];
      const doubleBondO = parsedAtoms[doubleBondOIdx];
      const singleBondO = parsedAtoms[singleBondOIdx];
      
      const cPos = atomPositions.get(cAtom.id);
      if (!cPos) continue;
      
      const doubleBondOPos = atomPositions.get(doubleBondO.id);
      const singleBondOPos = atomPositions.get(singleBondO.id);
      
      const neighbors: { x: number; y: number; z: number }[] = [];
      parsedBonds.forEach(b => {
        if (b.a1 === cIdx || b.a2 === cIdx) {
          const nIdx = b.a1 === cIdx ? b.a2 : b.a1;
          if (nIdx !== doubleBondOIdx && nIdx !== singleBondOIdx) {
            const nPos = atomPositions.get(parsedAtoms[nIdx].id);
            if (nPos) neighbors.push(nPos);
          }
        }
      });
      
      if (neighbors.length >= 1) {
        const neighborPos = neighbors[0];
        const d = { x: cPos.x - neighborPos.x, y: cPos.y - neighborPos.y, z: cPos.z - neighborPos.z };
        const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) || 1;
        const axisDir = { x: d.x / len, y: d.y / len, z: d.z / len };
        
        const perp1 = { x: -axisDir.y, y: axisDir.x, z: 0 };
        let perp1Len = Math.sqrt(perp1.x * perp1.x + perp1.y * perp1.y);
        if (perp1Len < 0.001) {
          perp1.x = 1; perp1.y = 0; perp1.z = 0;
          perp1Len = 1;
        }
        perp1.x /= perp1Len; perp1.y /= perp1Len;
        
        const doubleBondLength = getBondLength('C', 'O', 2);
        const singleBondLength = getBondLength('C', 'O', 1);
        
        const doubleBondPos = {
          x: cPos.x - perp1.x * doubleBondLength,
          y: cPos.y - perp1.y * doubleBondLength,
          z: cPos.z - perp1.z * doubleBondLength
        };
        
        const singleBondPos = {
          x: cPos.x + perp1.x * singleBondLength,
          y: cPos.y + perp1.y * singleBondLength,
          z: cPos.z + perp1.z * singleBondLength
        };
        
        atomPositions.set(doubleBondO.id, doubleBondPos);
        atomPositions.set(singleBondO.id, singleBondPos);
      }
    }
  }
}

const phi = Math.acos(-1 / 3);
const cosPhi = Math.cos(phi);
const sinPhi = Math.sin(phi);

function getNeighborPositions(
  atomIdx: number,
  atoms: ParsedAtom[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  atomIdToIdx: Map<string, number>
): { positions: { x: number; y: number; z: number }[]; symbols: string[]; orders: number[] } {
  const atom = atoms[atomIdx];
  const positions: { x: number; y: number; z: number }[] = [];
  const symbols: string[] = [];
  const orders: number[] = [];

  atom.bonds.forEach((order, neighborId) => {
    const pos = atomPositions.get(neighborId);
    if (pos) {
      positions.push(pos);
      const nIdx = atomIdToIdx.get(neighborId);
      if (nIdx !== undefined) {
        symbols.push(atoms[nIdx].symbol);
        orders.push(order);
      }
    }
  });

  return { positions, symbols, orders };
}

function getBondedAtoms(
  atomIdx: number,
  parsedBonds: { a1: number; a2: number; order: number }[]
): number[] {
  const neighbors: number[] = [];
  parsedBonds.forEach(b => {
    if (b.a1 === atomIdx) neighbors.push(b.a2);
    if (b.a2 === atomIdx) neighbors.push(b.a1);
  });
  return neighbors;
}

function rotatePointAroundAxis(
  point: { x: number; y: number; z: number },
  center: { x: number; y: number; z: number },
  axis: { x: number; y: number; z: number },
  angle: number
): { x: number; y: number; z: number } {
  const ax = axis.x;
  const ay = axis.y;
  const az = axis.z;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const t = 1 - cos;

  const px = point.x - center.x;
  const py = point.y - center.y;
  const pz = point.z - center.z;

  const rotatedX = (t * ax * ax + cos) * px + (t * ax * ay - az * sin) * py + (t * ax * az + ay * sin) * pz;
  const rotatedY = (t * ax * ay + az * sin) * px + (t * ay * ay + cos) * py + (t * ay * az - ax * sin) * pz;
  const rotatedZ = (t * ax * az - ay * sin) * px + (t * ay * az + ax * sin) * py + (t * az * az + cos) * pz;

  return {
    x: rotatedX + center.x,
    y: rotatedY + center.y,
    z: rotatedZ + center.z
  };
}

function getRotationAxisToAlign(
  fromDir: { x: number; y: number; z: number },
  toDir: { x: number; y: number; z: number }
): { axis: { x: number; y: number; z: number }; angle: number } | null {
  const fromLen = Math.sqrt(fromDir.x * fromDir.x + fromDir.y * fromDir.y + fromDir.z * fromDir.z);
  const toLen = Math.sqrt(toDir.x * toDir.x + toDir.y * toDir.y + toDir.z * toDir.z);
  
  if (fromLen < 0.001 || toLen < 0.001) return null;
  
  const from = { x: fromDir.x / fromLen, y: fromDir.y / fromLen, z: fromDir.z / fromLen };
  const to = { x: toDir.x / toLen, y: toDir.y / toLen, z: toDir.z / toLen };
  
  const dot = from.x * to.x + from.y * to.y + from.z * to.z;
  const crossX = from.y * to.z - from.z * to.y;
  const crossY = from.z * to.x - from.x * to.z;
  const crossZ = from.x * to.y - from.y * to.x;
  const crossLen = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
  
  if (crossLen < 0.0001) {
    if (dot > 0.9) {
      return null;
    } else {
      return { axis: { x: 1, y: 0, z: 0 }, angle: Math.PI };
    }
  }
  
  const axis = { x: crossX / crossLen, y: crossY / crossLen, z: crossZ / crossLen };
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  
  return { axis, angle };
}

function attachComponentWithOverlapAvoidance(
  componentAtoms: number[],
  componentConnectAtom: number,
  targetConnectAtom: number,
  targetConnectPos: { x: number; y: number; z: number },
  targetExistingPositions: { x: number; y: number; z: number }[],
  parsedAtoms: ParsedAtom[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  bondLength: number
): void {
  const connectAtomPos = atomPositions.get(parsedAtoms[componentConnectAtom].id);
  if (!connectAtomPos) return;

  const fromDir = {
    x: connectAtomPos.x - targetConnectPos.x,
    y: connectAtomPos.y - targetConnectPos.y,
    z: connectAtomPos.z - targetConnectPos.z
  };
  const toDir = {
    x: targetConnectPos.x - (targetExistingPositions[0]?.x || targetConnectPos.x + 1),
    y: targetConnectPos.y - (targetExistingPositions[0]?.y || targetConnectPos.y),
    z: targetConnectPos.z - (targetExistingPositions[0]?.z || targetConnectPos.z)
  };

  const rotation = getRotationAxisToAlign(fromDir, toDir);

  const rotatedPositions: { x: number; y: number; z: number }[] = [];
  for (const atomIdx of componentAtoms) {
    const pos = atomPositions.get(parsedAtoms[atomIdx].id);
    if (pos) {
      if (rotation) {
        rotatedPositions.push(rotatePointAroundAxis(pos, connectAtomPos, rotation.axis, rotation.angle));
      } else {
        rotatedPositions.push({ ...pos });
      }
    } else {
      rotatedPositions.push({ x: 0, y: 0, z: 0 });
    }
  }

  const connectAtomIdx = componentAtoms.indexOf(componentConnectAtom);
  if (connectAtomIdx < 0 || !rotatedPositions[connectAtomIdx]) {
    console.warn('[attachComponentWithOverlapAvoidance] connect atom not found in component');
    return;
  }

  const translation = {
    x: targetConnectPos.x - rotatedPositions[connectAtomIdx].x,
    y: targetConnectPos.y - rotatedPositions[connectAtomIdx].y,
    z: targetConnectPos.z - rotatedPositions[connectAtomIdx].z
  };

  let bestRotationAngle = rotation ? rotation.angle : 0;
  let bestOverlapCount = Infinity;
  const rotationStep = Math.PI / 12;

  for (let i = 0; i < 24; i++) {
    const testAngle = i * rotationStep;
    const testPositions: { x: number; y: number; z: number }[] = [];
    
    for (let j = 0; j < componentAtoms.length; j++) {
      let pos = rotatedPositions[j];
      if (!pos) continue;
      if (rotation) {
        pos = rotatePointAroundAxis(rotatedPositions[j], connectAtomPos, rotation.axis, testAngle);
      }
      testPositions.push({
        x: pos.x + translation.x,
        y: pos.y + translation.y,
        z: pos.z + translation.z
      });
    }

    let overlapCount = 0;
    for (const testPos of testPositions) {
      for (const existingPos of targetExistingPositions) {
        const dx = testPos.x - existingPos.x;
        const dy = testPos.y - existingPos.y;
        const dz = testPos.z - existingPos.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < MIN_ATOM_DISTANCE) {
          overlapCount++;
        }
      }
    }

    if (overlapCount < bestOverlapCount) {
      bestOverlapCount = overlapCount;
      bestRotationAngle = testAngle;
      if (overlapCount === 0) break;
    }
  }

  for (let j = 0; j < componentAtoms.length; j++) {
    const atomIdx = componentAtoms[j];
    let pos = rotatedPositions[j];
    
    if (!pos) continue;
    
    if (rotation) {
      pos = rotatePointAroundAxis(pos, connectAtomPos, rotation.axis, bestRotationAngle);
    }
    
    atomPositions.set(parsedAtoms[atomIdx].id, {
      x: pos.x + translation.x,
      y: pos.y + translation.y,
      z: pos.z + translation.z
    });
  }
}

function findConnectedComponents(
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[]
): number[][] {
  const visited = new Set<number>();
  const components: number[][] = [];
  
  for (let i = 0; i < parsedAtoms.length; i++) {
    if (visited.has(i)) continue;
    
    const component: number[] = [];
    const queue: number[] = [i];
    visited.add(i);
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      
      const neighbors = getBondedAtoms(current, parsedBonds);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    
    components.push(component);
  }
  
  return components;
}

function findComponentConnection(
  component: number[],
  allComponents: number[][],
  positionedComponents: Set<number>,
  parsedBonds: { a1: number; a2: number; order: number }[]
): { fromAtom: number; toAtom: number; fromCompIdx: number } | null {
  for (const toAtom of component) {
    const neighbors = getBondedAtoms(toAtom, parsedBonds);
    
    for (const fromAtom of neighbors) {
      for (let compIdx = 0; compIdx < allComponents.length; compIdx++) {
        if (!positionedComponents.has(compIdx)) continue;
        
        if (allComponents[compIdx].includes(fromAtom)) {
          return { fromAtom, toAtom, fromCompIdx: compIdx };
        }
      }
    }
  }
  
  return null;
}

function calculateComponentCenter(
  component: number[],
  parsedAtoms: ParsedAtom[],
  atomPositions: Map<string, { x: number; y: number; z: number }>
): { x: number; y: number; z: number } {
  let x = 0, y = 0, z = 0;
  let count = 0;
  
  for (const atomIdx of component) {
    const pos = atomPositions.get(parsedAtoms[atomIdx].id);
    if (pos) {
      x += pos.x;
      y += pos.y;
      z += pos.z;
      count++;
    }
  }
  
  if (count === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  
  return { x: x / count, y: y / count, z: z / count };
}

function generateRingCoordinates(
  ring: RingInfo,
  parsedAtoms: ParsedAtom[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  offset: { x: number; y: number; z: number }
) {
  const n = ring.atoms.length;
  const bondLength = ring.isAromatic ? 1.39 : 1.54;
  const radius = bondLength / (2 * Math.sin(Math.PI / n));
  
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x = offset.x + radius * Math.cos(angle);
    const y = offset.y + radius * Math.sin(angle);
    const z = offset.z;
    
    atomPositions.set(parsedAtoms[ring.atoms[i]].id, { x, y, z });
  }
}

function generateFusedRingSystemCoordinates(
  rings: RingInfo[],
  parsedAtoms: ParsedAtom[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  offset: { x: number; y: number; z: number }
) {
  if (rings.length === 0) return;
  
  generateRingCoordinates(rings[0], parsedAtoms, atomPositions, offset);
  
  const builtAtoms = new Set(rings[0].atoms);
  
  for (let ringIdx = 1; ringIdx < rings.length; ringIdx++) {
    const currentRing = rings[ringIdx];
    
    const sharedAtoms = currentRing.atoms.filter(a => builtAtoms.has(a));
    
    if (sharedAtoms.length >= 2) {
      const pos1 = atomPositions.get(parsedAtoms[sharedAtoms[0]].id)!;
      const pos2 = atomPositions.get(parsedAtoms[sharedAtoms[1]].id)!;
      
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dz = pos2.z - pos1.z;
      const bondLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      const perpDir = { x: -dy, y: dx, z: 0 };
      const perpLen = Math.sqrt(perpDir.x * perpDir.x + perpDir.y * perpDir.y);
      if (perpLen > 0.001) {
        perpDir.x /= perpLen;
        perpDir.y /= perpLen;
      }
      
      const shiftDistance = (currentRing.isAromatic ? 1.39 : 1.54) * Math.sqrt(3) / 2;
      
      const unbuiltAtoms = currentRing.atoms.filter(a => !builtAtoms.has(a));
      
      for (let i = 0; i < unbuiltAtoms.length; i++) {
        const ratio = (i + 0.5) / (unbuiltAtoms.length + 1);
        const x = pos1.x + dx * ratio + perpDir.x * shiftDistance;
        const y = pos1.y + dy * ratio + perpDir.y * shiftDistance;
        const z = pos1.z + dz * ratio + perpDir.z * shiftDistance;
        atomPositions.set(parsedAtoms[unbuiltAtoms[i]].id, { x, y, z });
      }
    } else {
      const newOffset = {
        x: offset.x + ringIdx * 5,
        y: offset.y,
        z: offset.z
      };
      generateRingCoordinates(currentRing, parsedAtoms, atomPositions, newOffset);
    }
    
    currentRing.atoms.forEach(a => builtAtoms.add(a));
  }
}

function buildRing(
  ring: number[],
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  offset: { x: number; y: number; z: number }
) {
  const n = ring.length;
  let bondLength = 1.39;
  
  const isAromatic = ring.every(i => parsedAtoms[i].aromatic);
  if (!isAromatic) {
    bondLength = getBondLength('C', 'C', 1);
  }
  
  const radius = bondLength / (2 * Math.sin(Math.PI / n));
  
  for (let i = 0; i < n; i++) {
    const idx = ring[i];
    const angle = (i / n) * 2 * Math.PI;
    const pos = {
      x: offset.x + radius * Math.cos(angle),
      y: offset.y + radius * Math.sin(angle),
      z: offset.z,
    };
    atomPositions.set(parsedAtoms[idx].id, pos);
  }
}

function buildStructuralUnit(
  unit: StructuralUnit,
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  offset: { x: number; y: number; z: number },
  hybridizationMap?: Map<string, 'sp' | 'sp2' | 'sp3'>
) {
  switch (unit.type) {
    case 'aromatic_ring':
    case 'ring':
      buildRing(unit.atomIndices, parsedAtoms, parsedBonds, atomPositions, offset);
      break;
    case 'fused_ring_system':
      buildFusedRingSystem(unit, parsedAtoms, parsedBonds, atomPositions, offset);
      break;
    case 'chain_segment':
      buildLinearChain(unit.atomIndices, parsedAtoms, parsedBonds, atomPositions, 0, hybridizationMap);
      break;
    case 'functional_group':
      buildFunctionalGroup(unit, parsedAtoms, parsedBonds, atomPositions, offset);
      break;
    case 'metal_ion':
      atomPositions.set(parsedAtoms[unit.atomIndices[0]].id, offset);
      break;
    default:
      buildLinearChain(unit.atomIndices, parsedAtoms, parsedBonds, atomPositions, 0, hybridizationMap);
  }
}

function buildFusedRingSystem(
  unit: StructuralUnit,
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  offset: { x: number; y: number; z: number }
) {
  if (unit.type !== 'fused_ring_system' || !(unit as any).rings) {
    buildRing(unit.atomIndices, parsedAtoms, parsedBonds, atomPositions, offset);
    return;
  }
  
  const rings = (unit as any).rings as number[][];
  if (rings.length === 0) return;
  
  buildRing(rings[0], parsedAtoms, parsedBonds, atomPositions, offset);
  
  const builtAtoms = new Set(rings[0]);
  
  for (let ringIdx = 1; ringIdx < rings.length; ringIdx++) {
    const currentRing = rings[ringIdx];
    
    let sharedAtoms: number[] = [];
    for (const atom of currentRing) {
      if (builtAtoms.has(atom)) {
        sharedAtoms.push(atom);
      }
    }
    
    if (sharedAtoms.length >= 2) {
      attachRingToExisting(currentRing, sharedAtoms, parsedAtoms, parsedBonds, atomPositions);
    } else {
      const ringOffset = {
        x: offset.x + ringIdx * 3,
        y: offset.y,
        z: offset.z
      };
      buildRing(currentRing, parsedAtoms, parsedBonds, atomPositions, ringOffset);
    }
    
    currentRing.forEach(atom => builtAtoms.add(atom));
  }
}

function attachRingToExisting(
  ring: number[],
  sharedAtoms: number[],
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>
) {
  const ringSet = new Set(ring);
  const unbuiltAtoms = ring.filter(a => !atomPositions.has(parsedAtoms[a].id));
  
  if (unbuiltAtoms.length === 0) return;
  
  const pos1 = atomPositions.get(parsedAtoms[sharedAtoms[0]].id)!;
  const pos2 = atomPositions.get(parsedAtoms[sharedAtoms[1]].id)!;
  
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  const bondLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  const ringBondLength = ring.every(i => parsedAtoms[i].aromatic) ? 1.39 : getBondLength('C', 'C', 1);
  
  let perpDir = { x: -dy, y: dx, z: 0 };
  let perpLen = Math.sqrt(perpDir.x * perpDir.x + perpDir.y * perpDir.y);
  
  if (perpLen < 0.001) {
    perpDir = { x: 0, y: -dz, z: dy };
    perpLen = Math.sqrt(perpDir.y * perpDir.y + perpDir.z * perpDir.z);
  }
  
  perpDir.x /= perpLen;
  perpDir.y /= perpLen;
  perpDir.z /= perpLen;
  
  const n = ring.length;
  const shiftDistance = ringBondLength / (2 * Math.tan(Math.PI / n));
  
  const newPos1 = {
    x: pos1.x + perpDir.x * shiftDistance,
    y: pos1.y + perpDir.y * shiftDistance,
    z: pos1.z + perpDir.z * shiftDistance
  };
  
  const newPos2 = {
    x: pos2.x + perpDir.x * shiftDistance,
    y: pos2.y + perpDir.y * shiftDistance,
    z: pos2.z + perpDir.z * shiftDistance
  };
  
  if (unbuiltAtoms.length === 2) {
    atomPositions.set(parsedAtoms[unbuiltAtoms[0]].id, newPos1);
    atomPositions.set(parsedAtoms[unbuiltAtoms[1]].id, newPos2);
  } else if (unbuiltAtoms.length === 4) {
    const midPoint = {
      x: (pos1.x + pos2.x) / 2 + perpDir.x * shiftDistance,
      y: (pos1.y + pos2.y) / 2 + perpDir.y * shiftDistance,
      z: 0 // 强制为0
    };
    
    atomPositions.set(parsedAtoms[unbuiltAtoms[0]].id, newPos1);
    atomPositions.set(parsedAtoms[unbuiltAtoms[1]].id, newPos2);
    
    const dirX = (dx / bondLength) * ringBondLength;
    const dirY = (dy / bondLength) * ringBondLength;
    
    atomPositions.set(parsedAtoms[unbuiltAtoms[2]].id, {
      x: midPoint.x + dirX,
      y: midPoint.y + dirY,
      z: 0 // 强制为0
    });
    
    atomPositions.set(parsedAtoms[unbuiltAtoms[3]].id, {
      x: midPoint.x - dirX,
      y: midPoint.y - dirY,
      z: 0 // 强制为0
    });
  } else {
    for (let i = 0; i < unbuiltAtoms.length; i++) {
      const ratio = (i + 0.5) / (unbuiltAtoms.length + 1);
      const x = pos1.x + dx * ratio + perpDir.x * shiftDistance;
      const y = pos1.y + dy * ratio + perpDir.y * shiftDistance;
      atomPositions.set(parsedAtoms[unbuiltAtoms[i]].id, { x, y, z: 0 }); // 强制z为0
    }
  }
}

function attachUnitToExisting(
  unit: StructuralUnit,
  attachAtomIdx: number,
  existingAtomPos: { x: number; y: number; z: number },
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  hybridizationMap?: Map<string, 'sp' | 'sp2' | 'sp3'>
) {
  const attachAtom = parsedAtoms[attachAtomIdx];
  
  let neighbors: number[] = [];
  parsedBonds.forEach(b => {
    if (b.a1 === attachAtomIdx) neighbors.push(b.a2);
    if (b.a2 === attachAtomIdx) neighbors.push(b.a1);
  });
  
  let builtNeighbor = -1;
  for (const n of neighbors) {
    if (atomPositions.has(parsedAtoms[n].id)) {
      builtNeighbor = n;
      break;
    }
  }
  
  const baseOffset = {
    x: existingAtomPos.x + 2,
    y: existingAtomPos.y,
    z: 0 // 强制为0
  };
  
  buildStructuralUnit(unit, parsedAtoms, parsedBonds, atomPositions, baseOffset, hybridizationMap);
  
  if (builtNeighbor >= 0) {
    const neighborPos = atomPositions.get(parsedAtoms[builtNeighbor].id)!;
    const dir = {
      x: existingAtomPos.x - neighborPos.x,
      y: existingAtomPos.y - neighborPos.y,
      z: 0 // 只计算XY平面方向
    };
    const dirLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    dir.x /= dirLen; dir.y /= dirLen;
    
    const bondLength = getBondLength(
      parsedAtoms[attachAtomIdx].symbol,
      parsedAtoms[builtNeighbor].symbol,
      1
    );
    
    const newAttachPos = {
      x: existingAtomPos.x + dir.x * bondLength,
      y: existingAtomPos.y + dir.y * bondLength,
      z: 0 // 强制为0
    };
    
    const currentAttachPos = atomPositions.get(attachAtom.id)!;
    const translation = {
      x: newAttachPos.x - currentAttachPos.x,
      y: newAttachPos.y - currentAttachPos.y,
      z: 0 // 不传播Z方向的位移
    };
    
    unit.atomIndices.forEach(atomIdx => {
      const pos = atomPositions.get(parsedAtoms[atomIdx].id);
      if (pos) {
        atomPositions.set(parsedAtoms[atomIdx].id, {
          x: pos.x + translation.x,
          y: pos.y + translation.y,
          z: 0 // 强制为0
        });
      }
    });
  }
}

function buildFunctionalGroup(
  unit: StructuralUnit,
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  offset: { x: number; y: number; z: number }
) {
  if (unit.atomIndices.length === 0) return;
  
  atomPositions.set(parsedAtoms[unit.atomIndices[0]].id, offset);
  
  let i = 0;
  while (i < unit.atomIndices.length) {
    const currentIdx = unit.atomIndices[i];
    const currentPos = atomPositions.get(parsedAtoms[currentIdx].id);
    
    if (!currentPos) {
      i++;
      continue;
    }
    
    const neighbors: Array<{ idx: number; order: number }> = [];
    parsedBonds.forEach(b => {
      if (b.a1 === currentIdx && unit.atomIndices.includes(b.a2)) {
        neighbors.push({ idx: b.a2, order: b.order });
      }
      if (b.a2 === currentIdx && unit.atomIndices.includes(b.a1)) {
        neighbors.push({ idx: b.a1, order: b.order });
      }
    });
    
    let dirIndex = 0;
    const directions = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 }
    ];
    
    for (const neighbor of neighbors) {
      if (neighbor.idx < 0 || neighbor.idx >= parsedAtoms.length) continue;
      const neighborAtom = parsedAtoms[neighbor.idx];
      if (!neighborAtom) continue;
      if (atomPositions.has(neighborAtom.id)) continue;
      
      const bondLength = getBondLength(
        parsedAtoms[currentIdx].symbol,
        neighborAtom.symbol,
        neighbor.order
      );
      
      const dir = directions[dirIndex % directions.length];
      if (!dir) continue;
      const newPos = {
        x: currentPos.x + dir.x * bondLength,
        y: currentPos.y + dir.y * bondLength,
        z: 0 // 强制为0
      };
      
      atomPositions.set(neighborAtom.id, newPos);
      dirIndex++;
    }
    
    i++;
  }
}

function buildLinearChain(
  fragment: number[],
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  fragmentOffset: number,
  hybridizationMap?: Map<string, 'sp' | 'sp2' | 'sp3'>
) {
  if (fragment.length === 0) return;
  
  const startPos = { x: fragmentOffset * 8, y: 0, z: 0 };
  const visited = new Set<number>();
  const queue: number[] = [fragment[0]];
  
  atomPositions.set(parsedAtoms[fragment[0]].id, startPos);
  visited.add(fragment[0]);
  
  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cos120 = Math.cos(120 * Math.PI / 180);
  const sin120 = Math.sin(120 * Math.PI / 180);
  
  while (queue.length > 0) {
    const currentIdx = queue.shift()!;
    const currentAtom = parsedAtoms[currentIdx];
    const currentPos = atomPositions.get(currentAtom.id);
    
    if (!currentPos) continue;
    
    const neighbors: { idx: number; order: number }[] = [];
    parsedBonds.forEach(b => {
      if (b.a1 === currentIdx && !visited.has(b.a2)) {
        neighbors.push({ idx: b.a2, order: b.order });
      }
      if (b.a2 === currentIdx && !visited.has(b.a1)) {
        neighbors.push({ idx: b.a1, order: b.order });
      }
    });
    
    const existingNeighbors: number[] = [];
    parsedBonds.forEach(b => {
      if (b.a1 === currentIdx && visited.has(b.a2)) existingNeighbors.push(b.a2);
      if (b.a2 === currentIdx && visited.has(b.a1)) existingNeighbors.push(b.a1);
    });
    
    const currentHyb = hybridizationMap?.get(currentAtom.id) || 'sp3';
    let directions: { x: number; y: number; z: number }[] = [];
    
    if (existingNeighbors.length === 0) {
      if (currentHyb === 'sp') {
        directions = [
          { x: 1, y: 0, z: 0 },
          { x: -1, y: 0, z: 0 },
        ];
      } else if (currentHyb === 'sp2') {
        directions = [
          { x: 1, y: 0, z: 0 },
          { x: cos120, y: sin120, z: 0 },
          { x: cos120, y: -sin120, z: 0 },
        ];
      } else {
        directions = [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 },
          { x: sinPhi, y: 0, z: cosPhi },
        ];
      }
    } else {
      const existingPos = atomPositions.get(parsedAtoms[existingNeighbors[0]].id);
      if (existingPos) {
        const dx = currentPos.x - existingPos.x;
        const dy = currentPos.y - existingPos.y;
        const dz = currentPos.z - existingPos.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const axisDir = { x: dx / len, y: dy / len, z: dz / len };
        
        const perp1 = { x: -axisDir.y, y: axisDir.x, z: 0 };
        let perp1Len = Math.sqrt(perp1.x * perp1.x + perp1.y * perp1.y);
        if (perp1Len < 0.001) {
          perp1.x = 1; perp1.y = 0; perp1.z = 0;
          perp1Len = 1;
        }
        perp1.x /= perp1Len; perp1.y /= perp1Len;
        
        const perp2 = {
          x: axisDir.y * perp1.z - axisDir.z * perp1.y,
          y: axisDir.z * perp1.x - axisDir.x * perp1.z,
          z: axisDir.x * perp1.y - axisDir.y * perp1.x,
        };
        
        if (currentHyb === 'sp') {
          // sp: 线性，方向沿轴反方向
          directions = [
            { x: -axisDir.x, y: -axisDir.y, z: -axisDir.z },
          ];
        } else if (currentHyb === 'sp2') {
          // sp2: 120°平面方向
          // 第一个方向：在axisDir和perp1构成的平面内，与axisDir成120°
          const dir1 = {
            x: cos120 * axisDir.x + sin120 * perp1.x,
            y: cos120 * axisDir.y + sin120 * perp1.y,
            z: cos120 * axisDir.z + sin120 * perp1.z,
          };
          // 第二个方向：在axisDir和perp1构成的平面内，与axisDir成-120°
          const dir2 = {
            x: cos120 * axisDir.x - sin120 * perp1.x,
            y: cos120 * axisDir.y - sin120 * perp1.y,
            z: cos120 * axisDir.z - sin120 * perp1.z,
          };
          directions = [dir1, dir2];
        } else {
          // sp3: 四面体方向
          for (let i = 0; i < 3; i++) {
            const angle = (i * 2 * Math.PI / 3);
            const dir = {
              x: -cosPhi * axisDir.x + sinPhi * Math.cos(angle) * perp1.x + sinPhi * Math.sin(angle) * perp2.x,
              y: -cosPhi * axisDir.y + sinPhi * Math.cos(angle) * perp1.y + sinPhi * Math.sin(angle) * perp2.y,
              z: -cosPhi * axisDir.z + sinPhi * Math.cos(angle) * perp1.z + sinPhi * Math.sin(angle) * perp2.z,
            };
            directions.push(dir);
          }
        }
      }
    }
    
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (neighbor.idx < 0 || neighbor.idx >= parsedAtoms.length) continue;
      const neighborAtom = parsedAtoms[neighbor.idx];
      const bondLen = getBondLength(currentAtom.symbol, neighborAtom.symbol, neighbor.order);
      
      let dir = directions[i % directions.length];
      if (!dir) {
        const randomAngle1 = Math.random() * Math.PI * 2;
        const randomAngle2 = Math.acos(2 * Math.random() - 1);
        dir = {
          x: Math.sin(randomAngle2) * Math.cos(randomAngle1),
          y: Math.sin(randomAngle2) * Math.sin(randomAngle1),
          z: Math.cos(randomAngle2),
        };
      }
      
      const newPos = {
        x: currentPos.x + dir.x * bondLen,
        y: currentPos.y + dir.y * bondLen,
        z: currentPos.z + dir.z * bondLen,
      };
      
      const finalPos = avoidAtomOverlap(newPos, neighborAtom.symbol, atomPositions, bondLen);
      atomPositions.set(neighborAtom.id, finalPos);
      visited.add(neighbor.idx);
      queue.push(neighbor.idx);
    }
  }
}

function buildRingsAndChain(
  rings: number[][],
  fragment: number[],
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  fragmentOffset: number
) {
  const ringPositions: { ring: number[]; center: { x: number; y: number; z: number } }[] = [];
  
  let offsetZ = 0;
  for (const ring of rings) {
    const center = { x: fragmentOffset * 8, y: 0, z: offsetZ };
    buildRing(ring, parsedAtoms, parsedBonds, atomPositions, center);
    ringPositions.push({ ring, center });
    offsetZ += 4;
  }
  
  const visited = new Set<number>();
  rings.forEach(ring => ring.forEach(idx => visited.add(idx)));
  
  const queue: number[] = [...fragment.filter(idx => visited.has(idx))];
  
  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  
  while (queue.length > 0) {
    const currentIdx = queue.shift()!;
    const currentAtom = parsedAtoms[currentIdx];
    const currentPos = atomPositions.get(currentAtom.id);
    
    if (!currentPos) continue;
    
    const neighbors: { idx: number; order: number }[] = [];
    parsedBonds.forEach(b => {
      if (b.a1 === currentIdx && !visited.has(b.a2)) {
        neighbors.push({ idx: b.a2, order: b.order });
      }
      if (b.a2 === currentIdx && !visited.has(b.a1)) {
        neighbors.push({ idx: b.a1, order: b.order });
      }
    });
    
    if (neighbors.length === 0) continue;
    
    const existingNeighbors: number[] = [];
    parsedBonds.forEach(b => {
      if (b.a1 === currentIdx && visited.has(b.a2)) existingNeighbors.push(b.a2);
      if (b.a2 === currentIdx && visited.has(b.a1)) existingNeighbors.push(b.a1);
    });
    
    let directions: { x: number; y: number; z: number }[] = [];
    
    if (existingNeighbors.length === 0) {
      directions = [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 },
      ];
    } else {
      const existingPos = atomPositions.get(parsedAtoms[existingNeighbors[0]].id);
      if (existingPos) {
        const dx = currentPos.x - existingPos.x;
        const dy = currentPos.y - existingPos.y;
        const dz = currentPos.z - existingPos.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const axisDir = { x: dx / len, y: dy / len, z: dz / len };
        
        const perp1 = { x: -axisDir.y, y: axisDir.x, z: 0 };
        let perp1Len = Math.sqrt(perp1.x * perp1.x + perp1.y * perp1.y);
        if (perp1Len < 0.001) {
          perp1.x = 1; perp1.y = 0; perp1.z = 0;
          perp1Len = 1;
        }
        perp1.x /= perp1Len; perp1.y /= perp1Len;
        
        const perp2 = {
          x: axisDir.y * perp1.z - axisDir.z * perp1.y,
          y: axisDir.z * perp1.x - axisDir.x * perp1.z,
          z: axisDir.x * perp1.y - axisDir.y * perp1.x,
        };
        
        for (let i = 0; i < 3; i++) {
          const angle = (i * 2 * Math.PI / 3);
          const dir = {
            x: cosPhi * axisDir.x + sinPhi * Math.cos(angle) * perp1.x + sinPhi * Math.sin(angle) * perp2.x,
            y: cosPhi * axisDir.y + sinPhi * Math.cos(angle) * perp1.y + sinPhi * Math.sin(angle) * perp2.y,
            z: cosPhi * axisDir.z + sinPhi * Math.cos(angle) * perp1.z + sinPhi * Math.sin(angle) * perp2.z,
          };
          directions.push(dir);
        }
      }
    }
    
    for (let i = 0; i < neighbors.length; i++) {
      const neighbor = neighbors[i];
      if (neighbor.idx < 0 || neighbor.idx >= parsedAtoms.length) continue;
      const neighborAtom = parsedAtoms[neighbor.idx];
      const bondLen = getBondLength(currentAtom.symbol, neighborAtom.symbol, neighbor.order);
      
      let dir = directions[i % directions.length];
      if (!dir) {
        const randomAngle1 = Math.random() * Math.PI * 2;
        const randomAngle2 = Math.acos(2 * Math.random() - 1);
        dir = {
          x: Math.sin(randomAngle2) * Math.cos(randomAngle1),
          y: Math.sin(randomAngle2) * Math.sin(randomAngle1),
          z: Math.cos(randomAngle2),
        };
      }
      
      const newPos = {
        x: currentPos.x + dir.x * bondLen,
        y: currentPos.y + dir.y * bondLen,
        z: currentPos.z + dir.z * bondLen,
      };
      
      const finalPos = avoidAtomOverlap(newPos, neighborAtom.symbol, atomPositions, bondLen);
      atomPositions.set(neighborAtom.id, finalPos);
      visited.add(neighbor.idx);
      queue.push(neighbor.idx);
    }
  }
}

function generate3DCoordinates(
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[]
): { atoms: Atom[]; bonds: Bond[] } {
  const resultAtoms: Atom[] = [];
  const resultBonds: Bond[] = [];
  const atomPositions: Map<string, { x: number; y: number; z: number }> = new Map();
  const atomIdToIdx: Map<string, number> = new Map();
  const ringBuilt: Set<number> = new Set(); // Indexes of rings already built
  
  parsedAtoms.forEach((pa, idx) => {
    atomIdToIdx.set(pa.id, idx);
  });

  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const bondOrders = new Map<string, Map<string, number>>();
  parsedBonds.forEach(b => {
    const a1Id = parsedAtoms[b.a1].id;
    const a2Id = parsedAtoms[b.a2].id;
    if (!bondOrders.has(a1Id)) bondOrders.set(a1Id, new Map());
    if (!bondOrders.has(a2Id)) bondOrders.set(a2Id, new Map());
    bondOrders.get(a1Id)!.set(a2Id, b.order);
    bondOrders.get(a2Id)!.set(a1Id, b.order);
  });

  const hybridizationMap = new Map<string, 'sp' | 'sp2' | 'sp3'>();
  parsedAtoms.forEach((pa) => {
    const hyb = getHybridization(pa, bondOrders);
    hybridizationMap.set(pa.id, hyb);
  });

  console.log('[generate3DCoordinates] === Parsed Atoms (first 30) ===');
  for (let i = 0; i < Math.min(30, parsedAtoms.length); i++) {
    const a = parsedAtoms[i];
    console.log(`  Atom ${i}: symbol=${a.symbol}, aromatic=${a.aromatic}`);
  }
  console.log('[generate3DCoordinates] === Bond Count ===');
  console.log(`  Total bonds: ${parsedBonds.length}`);
  
  const ringInfos = findAllRings(parsedAtoms, parsedBonds);
  console.log('[generate3DCoordinates] === Found Rings ===');
  console.log(`  Total rings found: ${ringInfos.length}`);
  for (let i = 0; i < ringInfos.length; i++) {
    const ring = ringInfos[i];
    console.log(`  Ring ${i}: size=${ring.atoms.length}, isAromatic=${ring.isAromatic}`);
    const atomList = ring.atoms.map(idx => `${idx}:${parsedAtoms[idx].symbol}`);
    console.log(`    Atoms: [${atomList.join(', ')}]`);
  }

  // === Fused Ring Fragment Matching ===
  const fusedSystems = identifyFusedRingSystems(ringInfos);
  const matchedFragments = new Set<number>();
  const fragmentAtomIds = new Set<string>(); // Track all atoms in matched fragments
  const fragmentMatchByRing = new Map<number, { fragment: FusedRingFragment; atomMap: Map<number, number> }>();
  // Build map from ring reference to index in ringInfos array
  const ringToIndex = new Map<RingInfo, number>();
  for (let ri = 0; ri < ringInfos.length; ri++) {
    ringToIndex.set(ringInfos[ri], ri);
  }
  
  console.log('[generate3DCoordinates] === Checking Fused Ring Fragments ===');
  for (let i = 0; i < fusedSystems.length; i++) {
    const system = fusedSystems[i]; // system is RingInfo[]
    const allAtomsInSystem: number[] = [];
    const ringIndicesInSystem: number[] = [];
    
    for (const ring of system) {
      ringIndicesInSystem.push(ringToIndex.get(ring)!);
      allAtomsInSystem.push(...ring.atoms);
    }
    // De-duplicate
    const uniqueAtomIndices = Array.from(new Set(allAtomsInSystem));
    uniqueAtomIndices.sort((a, b) => a - b);
    
    console.log(`  Fused System ${i}: atoms=[${uniqueAtomIndices.join(',')}], rings=[${ringIndicesInSystem.join(',')}]`);
    
    const match = matchFusedRingFragment(
      uniqueAtomIndices,
      parsedAtoms.map(a => ({ id: a.id, symbol: a.symbol, isAromatic: a.aromatic })),
      parsedBonds.map(b => ({ atom1Id: parsedAtoms[b.a1].id, atom2Id: parsedAtoms[b.a2].id }))
    );
    
    if (match) {
      console.log(`  ✓ Matched fragment: ${match.fragment.name}`);
      
      // match.atomMap 的 key 是 atomIndices 中的位置索引(0-based)
      // 需要转换为分子原子索引(parsedAtoms中的索引)
      const molIdxAtomMap = new Map<number, number>();
      for (const [localIdx, fragIdx] of match.atomMap) {
        const molIdx = uniqueAtomIndices[localIdx];
        if (molIdx !== undefined) {
          molIdxAtomMap.set(molIdx, fragIdx);
        }
      }
      
      // 检查碎片是否包含 Ring 0
      const containsRing0 = ringIndicesInSystem.includes(0);
      
      if (containsRing0) {
        // 碎片包含 Ring 0，直接在原点放置（与 Ring 0 构建位置一致）
        applyFusedRingFragment(match.fragment, molIdxAtomMap, parsedAtoms, atomPositions);
        for (const molIdx of molIdxAtomMap.keys()) {
          const atomId = parsedAtoms[molIdx].id;
          fragmentAtomIds.add(atomId);
        }
        for (const ringIdx of ringIndicesInSystem) {
          matchedFragments.add(ringIdx);
          ringBuilt.add(ringIdx);
        }
        console.log(`  → Fragment contains Ring 0, placed at origin`);
      } else {
        // 碎片不包含 Ring 0，延迟到环构建阶段放置
        for (const ringIdx of ringIndicesInSystem) {
          fragmentMatchByRing.set(ringIdx, { fragment: match.fragment, atomMap: molIdxAtomMap });
          matchedFragments.add(ringIdx);
        }
        console.log(`  → Fragment does NOT contain Ring 0, deferred placement`);
      }
    } else {
      console.log(`  ✗ No fragment match for this system, will use default ring building`);
    }
  }
  
  if (ringInfos.length === 0) {
    console.log('[generate3DCoordinates] WARNING: No rings found!');
    console.log('[generate3DCoordinates] Checking bonds for ring closures:');
    for (const bond of parsedBonds) {
      if (Math.abs(bond.a1 - bond.a2) > 3) {
        console.log(`  Bond ${bond.a1}-${bond.a2} (large gap, potential ring closure)`);
      }
    }
  }
  
  console.log('[generate3DCoordinates] === Atoms in rings check ===');
  const checkAtoms = [5, 14, 15];
  for (const atomIdx of checkAtoms) {
    if (atomIdx >= parsedAtoms.length) continue;
    let inRing = false;
    for (let i = 0; i < ringInfos.length; i++) {
      if (ringInfos[i].atoms.includes(atomIdx)) {
        console.log(`  Atom ${atomIdx}(${parsedAtoms[atomIdx].symbol}) is in Ring ${i}`);
        inRing = true;
        break;
      }
    }
    if (!inRing) {
      console.log(`  Atom ${atomIdx}(${parsedAtoms[atomIdx].symbol}) is NOT in any ring!`);
    }
  }
  
  console.log('[generate3DCoordinates] === Ring Connections ===');
  for (let i = 0; i < ringInfos.length; i++) {
    for (let j = i + 1; j < ringInfos.length; j++) {
      const shared = findSharedEdgeAtoms(ringInfos[i], ringInfos[j]);
      if (shared.length > 0) {
        console.log(`  Ring ${i} <-> Ring ${j}: shared atoms [${shared.join(',')}]`);
      }
    }
  }
  
  console.log('[generate3DCoordinates] === Bond Between Rings ===');
  for (const bond of parsedBonds) {
    let inRing1 = false, inRing2 = false, ringIdx1 = -1, ringIdx2 = -1;
    for (let i = 0; i < ringInfos.length; i++) {
      if (ringInfos[i].atoms.includes(bond.a1)) {
        inRing1 = true;
        ringIdx1 = i;
      }
      if (ringInfos[i].atoms.includes(bond.a2)) {
        inRing2 = true;
        ringIdx2 = i;
      }
    }
    if (inRing1 && inRing2 && ringIdx1 !== ringIdx2) {
      console.log(`  Bond ${parsedAtoms[bond.a1].symbol}(${bond.a1})-${parsedAtoms[bond.a2].symbol}(${bond.a2}) connects Ring ${ringIdx1} and Ring ${ringIdx2}`);
    }
  }
  const builtAtoms = new Set<number>();
  // 将碎片匹配阶段已放置的原子加入builtAtoms
  for (let i = 0; i < parsedAtoms.length; i++) {
    if (atomPositions.has(parsedAtoms[i].id)) {
      builtAtoms.add(i);
    }
  }

  function isRingAlreadyBuilt(ring: RingInfo): boolean {
    return ring.atoms.some(idx => atomPositions.has(parsedAtoms[idx].id));
  }

  function buildRingAtPosition(
    ring: RingInfo,
    center: { x: number; y: number; z: number },
    rotationAngle: number = 0,
    normalVector: { x: number; y: number; z: number } | null = null
  ): void {
    const n = ring.atoms.length;
    const bondLength = ring.isAromatic ? 1.39 : 1.54;
    const radius = bondLength / (2 * Math.sin(Math.PI / n));
    
    console.log(`[DEBUG] buildRingAtPosition: normalVector=${normalVector ? JSON.stringify(normalVector) : 'null'}, center=${JSON.stringify(center)}`);
    
    // 收集这个环里所有原子的 id，后面排除掉
    const ringAtomIds = ring.atoms.map(idx => parsedAtoms[idx].id);

    for (let i = 0; i < n; i++) {
      const idx = ring.atoms[i];
      const atomId = parsedAtoms[idx].id;
      
      // 环原子始终用精确位置放置，即使已有位置也覆盖，确保环共面
      // （之前通过链构建的位置可能不精确，会破坏环平面几何）

      builtAtoms.add(idx);

      const angle = (i / n) * 2 * Math.PI - Math.PI / 2 + rotationAngle;
      
      let pos: { x: number; y: number; z: number };
      
      if (normalVector) {
        // 如果提供了法向量，根据法向量旋转环平面
        pos = calculateRingPosition(center, radius, angle, normalVector);
      } else {
        // 否则使用默认的 xy 平面
        pos = {
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle),
          z: center.z || 0,
        };
      }
      
      // 环原子精确放置，不做avoidAtomOverlap（避免破坏环平面几何）
      atomPositions.set(atomId, pos);
    }
  }

  // 计算环的法向量
  function calculateRingNormal(ring: RingInfo): { x: number; y: number; z: number } | null {
    // 找到环中三个有位置的原子
    const positions: { x: number; y: number; z: number }[] = [];
    for (const idx of ring.atoms) {
      const pos = atomPositions.get(parsedAtoms[idx].id);
      if (pos) {
        positions.push(pos);
        if (positions.length >= 3) break;
      }
    }
    
    if (positions.length < 3) return null;
    
    // 计算两个向量
    const v1 = {
      x: positions[1].x - positions[0].x,
      y: positions[1].y - positions[0].y,
      z: positions[1].z - positions[0].z
    };
    const v2 = {
      x: positions[2].x - positions[0].x,
      y: positions[2].y - positions[0].y,
      z: positions[2].z - positions[0].z
    };
    
    // 叉乘得到法向量
    const normal = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };
    
    // 规范化
    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z) || 1;
    return {
      x: normal.x / len,
      y: normal.y / len,
      z: normal.z / len
    };
  }

  // 计算环上原子的位置，考虑法向量
  function calculateRingPosition(
    center: { x: number; y: number; z: number },
    radius: number,
    angle: number,
    normal: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    // 规范化法向量
    const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z) || 1;
    const n = { x: normal.x / len, y: normal.y / len, z: normal.z / len };
    console.log(`[DEBUG] calculateRingPosition called with normal=${JSON.stringify(n)}, center=${JSON.stringify(center)}, radius=${radius}, angle=${angle}`);
    
    // 创建两个正交于法向量的向量
    let u: { x: number; y: number; z: number };
    let v: { x: number; y: number; z: number };
    
    // 选择一个与法向量不共线的轴
    if (Math.abs(n.x) < 0.9) {
      u = { x: 0, y: 1, z: 0 };
    } else {
      u = { x: 1, y: 0, z: 0 };
    }
    
    // 叉乘得到第一个正交向量
    u = {
      x: n.y * u.z - n.z * u.y,
      y: n.z * u.x - n.x * u.z,
      z: n.x * u.y - n.y * u.x
    };
    const uLen = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z) || 1;
    u = { x: u.x / uLen, y: u.y / uLen, z: u.z / uLen };
    
    // 再次叉乘得到第二个正交向量
    v = {
      x: n.y * u.z - n.z * u.y,
      y: n.z * u.x - n.x * u.z,
      z: n.x * u.y - n.y * u.x
    };
    
    // 计算位置
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    
    return {
      x: center.x + radius * (cosA * u.x + sinA * v.x),
      y: center.y + radius * (cosA * u.y + sinA * v.y),
      z: center.z + radius * (cosA * u.z + sinA * v.z)
    };
  }

  // 围绕轴旋转向量
  function rotateVectorAroundAxis(
    v: { x: number; y: number; z: number },
    axis: { x: number; y: number; z: number },
    angle: number
  ): { x: number; y: number; z: number } {
    // 使用罗德里格斯旋转公式
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dot = v.x * axis.x + v.y * axis.y + v.z * axis.z;
    const cross = {
      x: axis.y * v.z - axis.z * v.y,
      y: axis.z * v.x - axis.x * v.z,
      z: axis.x * v.y - axis.y * v.x
    };
    
    return {
      x: v.x * cos + cross.x * sin + axis.x * dot * (1 - cos),
      y: v.y * cos + cross.y * sin + axis.y * dot * (1 - cos),
      z: v.z * cos + cross.z * sin + axis.z * dot * (1 - cos)
    };
  }

  function findRingConnection(
    ring: RingInfo,
    existingRings: RingInfo[]
  ): { existingRing: RingInfo; existingAtomIdx: number; newAtomIdx: number } | null {
    for (const existingRing of existingRings) {
      if (isRingAlreadyBuilt(existingRing)) {
        for (const atomIdx1 of ring.atoms) {
          for (const atomIdx2 of existingRing.atoms) {
            const hasBond = parsedBonds.some(b => 
              (b.a1 === atomIdx1 && b.a2 === atomIdx2) || 
              (b.a1 === atomIdx2 && b.a2 === atomIdx1)
            );
            if (hasBond) {
              return { existingRing, existingAtomIdx: atomIdx2, newAtomIdx: atomIdx1 };
            }
          }
        }
      }
    }
    return null;
  }

  function findPathToBuiltAtom(startIdx: number): number[] | null {
    const visited = new Set<number>();
    const path: number[] = [];
    
    function dfs(current: number): boolean {
      if (visited.has(current)) return false;
      visited.add(current);
      
      if (atomPositions.has(parsedAtoms[current].id)) {
        path.push(current);
        return true;
      }
      
      const neighbors = getBondedAtoms(current, parsedBonds);
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) {
          path.push(current);
          return true;
        }
      }
      return false;
    }
    
    if (dfs(startIdx)) {
      return path.reverse();
    }
    return null;
  }
  
  function buildChainToRing(path: number[], ringAtomIdx: number, ringIdx: number): void {
    console.log(`    Building chain path to ring: ${path.join(' -> ')}`);
    
    if (!path || path.length < 2) {
      console.log(`    Invalid path, skipping`);
      return;
    }
    
    // 找到路径中第一个有位置的原子
    let startIdx = -1;
    for (let i = 0; i < path.length; i++) {
      if (atomPositions.has(parsedAtoms[path[i]].id)) {
        startIdx = i;
        break;
      }
    }
    
    if (startIdx === -1) {
      console.log(`    No atom in path has position, skipping`);
      return;
    }
    
    // 从有位置的原子开始，向前构建（path[0] 是离环最近的原子）
    for (let i = startIdx; i > 0; i--) {
      const currentIdx = path[i];
      const prevIdx = path[i - 1];
      const currentAtom = parsedAtoms[currentIdx];
      const prevAtom = parsedAtoms[prevIdx];
      
      if (!currentAtom || !prevAtom) {
        console.log(`    Invalid atom index: current=${currentIdx}, prev=${prevIdx}`);
        continue;
      }
      
      const currentPos = atomPositions.get(currentAtom.id);
      if (!currentPos) {
        console.log(`    No position for atom ${currentIdx}(${currentAtom.symbol}), skipping`);
        continue;
      }
      
      const bond = parsedBonds.find(b => 
        (b.a1 === currentIdx && b.a2 === prevIdx) || 
        (b.a1 === prevIdx && b.a2 === currentIdx)
      );
      const bondOrder = bond?.order || 1;
      const bondLength = getBondLength(currentAtom.symbol, prevAtom.symbol, bondOrder);
      
      const existingNeighbors = getBondedAtoms(currentIdx, parsedBonds).filter(n => atomPositions.has(parsedAtoms[n]?.id));
      const existingNeighborIds = existingNeighbors.map(n => parsedAtoms[n].id);
      const currentHyb = hybridizationMap.get(currentAtom.id) || 'sp3';
      
      let direction: { x: number; y: number; z: number };
      
      if (existingNeighbors.length === 0) {
        direction = { x: 1, y: 0, z: 0 };
      } else if (existingNeighbors.length === 1) {
        // 只有一个邻居，根据杂化类型计算方向
        const neighborIdx = existingNeighbors[0];
        const neighborPos = atomPositions.get(parsedAtoms[neighborIdx].id)!;
        const dx = currentPos.x - neighborPos.x;
        const dy = currentPos.y - neighborPos.y;
        const dz = currentPos.z - neighborPos.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const axisDir = { x: dx / len, y: dy / len, z: dz / len };
        
        // 计算垂直方向（在xy平面）
        const p1 = { x: -axisDir.y, y: axisDir.x, z: 0 };
        const p2 = { x: 0, y: 0, z: 1 };
        
        if (currentHyb === 'sp2') {
          // sp²杂化，120度角
          const cos120 = -0.5;
          const sin120 = Math.sqrt(3) / 2;
          direction = {
            x: cos120 * axisDir.x + sin120 * p1.x,
            y: cos120 * axisDir.y + sin120 * p1.y,
            z: 0
          };
        } else if (currentHyb === 'sp') {
          // sp杂化，180度角（反向）
          direction = { x: -axisDir.x, y: -axisDir.y, z: -axisDir.z };
        } else {
          // sp³杂化，109.5度角，使用3D方向
          // 注意：direction与axisDir的夹角为70.5°（cosPhi=1/3），
          // 这样C5-C6-C7角度（axisDir和-(C6→C7)的夹角）= 180° - 70.5° = 109.5°
          const cosPhi = 1 / 3;
          const sinPhi = Math.sqrt(8) / 3;
          
          // 找到垂直于axisDir的两个正交方向
          // 测试多个候选辅助向量，选择与axisDir叉乘不为零的那个
          const candidates = [
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 0, y: 0, z: 1 }
          ];
          
          let p1 = { x: 0, y: 0, z: 0 };
          for (const cand of candidates) {
            const cross = {
              x: axisDir.y * cand.z - axisDir.z * cand.y,
              y: axisDir.z * cand.x - axisDir.x * cand.z,
              z: axisDir.x * cand.y - axisDir.y * cand.x
            };
            const crossLen = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
            if (crossLen > 0.1) {
              p1 = cross;
              break;
            }
          }
          
          const p1Len = Math.sqrt(p1.x * p1.x + p1.y * p1.y + p1.z * p1.z) || 1;
          const p1n = { x: p1.x / p1Len, y: p1.y / p1Len, z: p1.z / p1Len };
          // p2 = axisDir × p1n
          const p2 = {
            x: axisDir.y * p1n.z - axisDir.z * p1n.y,
            y: axisDir.z * p1n.x - axisDir.x * p1n.z,
            z: axisDir.x * p1n.y - axisDir.y * p1n.x
          };
          const p2Len = Math.sqrt(p2.x * p2.x + p2.y * p2.y + p2.z * p2.z) || 1;
          const p2n = { x: p2.x / p2Len, y: p2.y / p2Len, z: p2.z / p2Len };
          
          // 使用p2n作为垂直方向，生成与axisDir成109.5°角的方向
          direction = {
            x: cosPhi * axisDir.x + sinPhi * p2n.x,
            y: cosPhi * axisDir.y + sinPhi * p2n.y,
            z: cosPhi * axisDir.z + sinPhi * p2n.z
          };
        }
      } else if (existingNeighbors.length === 2) {
        const sum = existingNeighbors.map(n => {
          const pos = atomPositions.get(parsedAtoms[n]?.id);
          if (!pos) return { x: 0, y: 0, z: 0 };
          return { x: currentPos.x - pos.x, y: currentPos.y - pos.y, z: currentPos.z - pos.z };
        }).reduce((acc, d) => ({ x: acc.x + d.x, y: acc.y + d.y, z: acc.z + d.z }), { x: 0, y: 0, z: 0 });
        
        const len = Math.sqrt(sum.x * sum.x + sum.y * sum.y + sum.z * sum.z) || 1;
        // 使用 sum 方向（指向环外），而不是 -sum（指向环内）
        const avgDir = { x: sum.x / len, y: sum.y / len, z: sum.z / len };
        if (currentHyb === 'sp2') {
          direction = avgDir;
        } else {
          // sp3, 使用四面体零和性质：d1 + d2 + h1 + h2 = 0
          // 第三个键方向 = -(d1 + d2)/2 + sqrt(2/3) * n，其中n是垂直于d1和d2的法向量
          const n1 = existingNeighbors[0];
          const n2 = existingNeighbors[1];
          const pos1 = atomPositions.get(parsedAtoms[n1]?.id)!;
          const pos2 = atomPositions.get(parsedAtoms[n2]?.id)!;
          const d1 = { x: pos1.x - currentPos.x, y: pos1.y - currentPos.y, z: pos1.z - currentPos.z };
          const d2 = { x: pos2.x - currentPos.x, y: pos2.y - currentPos.y, z: pos2.z - currentPos.z };
          
          const d1Len = Math.sqrt(d1.x * d1.x + d1.y * d1.y + d1.z * d1.z) || 1;
          const d2Len = Math.sqrt(d2.x * d2.x + d2.y * d2.y + d2.z * d2.z) || 1;
          const nd1 = { x: d1.x / d1Len, y: d1.y / d1Len, z: d1.z / d1Len };
          const nd2 = { x: d2.x / d2Len, y: d2.y / d2Len, z: d2.z / d2Len };
          
          const halfSum = { x: -(nd1.x + nd2.x) / 2, y: -(nd1.y + nd2.y) / 2, z: -(nd1.z + nd2.z) / 2 };
          
          // 计算d1和d2的法向量
          let normal = { x: nd1.y * nd2.z - nd1.z * nd2.y, y: nd1.z * nd2.x - nd1.x * nd2.z, z: nd1.x * nd2.y - nd1.y * nd2.x };
          let nLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
          
          // 如果法向量长度很小（d1和d2接近平行/相反，典型的链状结构中间原子）
          if (nLen < 0.1) {
            // 对于链状结构，使用垂直于链的方向作为法线，保持在xy平面内
            // 首先找垂直于nd1的向量（在xy平面内）
            const perpN = { x: -nd1.y, y: nd1.x, z: 0 };
            const perpLen = Math.sqrt(perpN.x * perpN.x + perpN.y * perpN.y) || 1;
            const perp = { x: perpN.x / perpLen, y: perpN.y / perpLen, z: 0 };
            
            // 计算当前原子在path中的位置，用于确定方向的交替
            let pathIdx = path.indexOf(currentIdx);
            if (pathIdx === -1) pathIdx = 0;
            const sign = pathIdx % 2 === 0 ? 1 : -1;
            
            // 使用四面体零和公式，但用垂直于链的方向作为法线
            const t = Math.sqrt(2 / 3);
            direction = {
              x: halfSum.x + sign * t * perp.x,
              y: halfSum.y + sign * t * perp.y,
              z: halfSum.z + sign * t * perp.z
            };
          } else {
            const n = { x: normal.x / nLen, y: normal.y / nLen, z: normal.z / nLen };
            const t = Math.sqrt(2 / 3);
            
            direction = {
              x: halfSum.x + t * n.x,
              y: halfSum.y + t * n.y,
              z: halfSum.z + t * n.z
            };
          }
        }
      } else if (existingNeighbors.length >= 3) {
        const sum = existingNeighbors.map(n => {
          const pos = atomPositions.get(parsedAtoms[n]?.id);
          if (!pos) return { x: 0, y: 0, z: 0 };
          return { x: currentPos.x - pos.x, y: currentPos.y - pos.y, z: currentPos.z - pos.z };
        }).reduce((acc, d) => ({ x: acc.x + d.x, y: acc.y + d.y, z: acc.z + d.z }), { x: 0, y: 0, z: 0 });
        
        const len = Math.sqrt(sum.x * sum.x + sum.y * sum.y + sum.z * sum.z) || 1;
        direction = { x: -sum.x / len, y: -sum.y / len, z: -sum.z / len };
      } else {
        direction = { x: 1, y: 0, z: 0 };
      }
      
      const newPos = {
        x: currentPos.x + direction.x * bondLength,
        y: currentPos.y + direction.y * bondLength,
        z: (currentPos.z || 0) + (direction.z || 0) * bondLength,
      };
      
      // 链到环的连接原子使用avoidAtomOverlap，但排除环原子避免破坏环几何
      const excludeIdsForChain = [currentAtom.id, ...existingNeighborIds];
      for (const ri of ringInfos) {
        for (const atomIdx of ri.atoms) {
          excludeIdsForChain.push(parsedAtoms[atomIdx].id);
        }
      }
      const finalPos = avoidAtomOverlap(newPos, prevAtom.symbol, atomPositions, bondLength, excludeIdsForChain);
      atomPositions.set(prevAtom.id, finalPos);
      builtAtoms.add(prevIdx);
      console.log(`    Placed atom ${prevIdx}(${prevAtom.symbol}) at (${finalPos.x.toFixed(3)}, ${finalPos.y.toFixed(3)}, ${finalPos.z.toFixed(3)})`);
    }
  }
  
  // 计算3D环的旋转角度
  // 当环使用法向量构建时，旋转角度需要在环的局部坐标系中计算
  function compute3DRingRotationAngle(
    direction: { x: number; y: number; z: number },
    ringNormal: { x: number; y: number; z: number } | null,
    newAtomRingIndex: number,
    ringSize: number
  ): number {
    if (!ringNormal) {
      // 2D环：使用原有的2D角度计算
      const baseAngle = Math.atan2(direction.y, direction.x);
      const relativeAngle = (newAtomRingIndex / ringSize) * 2 * Math.PI - Math.PI / 2;
      return baseAngle + Math.PI - relativeAngle;
    }
    
    // 3D环：在局部坐标系中计算旋转角度
    // 计算与calculateRingPosition相同的(u, v)基
    let u_raw: { x: number; y: number; z: number };
    if (Math.abs(ringNormal.x) < 0.9) {
      u_raw = { x: 0, y: 1, z: 0 };
    } else {
      u_raw = { x: 1, y: 0, z: 0 };
    }
    
    let u = {
      x: ringNormal.y * u_raw.z - ringNormal.z * u_raw.y,
      y: ringNormal.z * u_raw.x - ringNormal.x * u_raw.z,
      z: ringNormal.x * u_raw.y - ringNormal.y * u_raw.x
    };
    const uLen = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z) || 1;
    u = { x: u.x / uLen, y: u.y / uLen, z: u.z / uLen };
    
    const v = {
      x: ringNormal.y * u.z - ringNormal.z * u.y,
      y: ringNormal.z * u.x - ringNormal.x * u.z,
      z: ringNormal.x * u.y - ringNormal.y * u.x
    };
    
    // 目标：连接原子应在环中心 + radius * (-dirNorm) 的位置
    // 在(u, v)坐标系中：cos(angle) * u + sin(angle) * v = -dirNorm
    const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z) || 1;
    const dirNorm = { x: direction.x / dirLen, y: direction.y / dirLen, z: direction.z / dirLen };
    const targetDir = { x: -dirNorm.x, y: -dirNorm.y, z: -dirNorm.z };
    
    const targetCos = targetDir.x * u.x + targetDir.y * u.y + targetDir.z * u.z;
    const targetSin = targetDir.x * v.x + targetDir.y * v.y + targetDir.z * v.z;
    const targetAngle = Math.atan2(targetSin, targetCos);
    
    const defaultAngle = (newAtomRingIndex / ringSize) * 2 * Math.PI - Math.PI / 2;
    return targetAngle - defaultAngle;
  }
  
  function findChainToRingConnection(
    ring: RingInfo
  ): { existingAtomIdx: number; newAtomIdx: number } | null {
    for (const newAtomIdx of ring.atoms) {
      for (let i = 0; i < parsedAtoms.length; i++) {
        if (i === newAtomIdx) continue;
        if (atomPositions.has(parsedAtoms[i].id)) {
          const hasBond = parsedBonds.some(b => 
            (b.a1 === newAtomIdx && b.a2 === i) || 
            (b.a1 === i && b.a2 === newAtomIdx)
          );
          if (hasBond) {
            return { existingAtomIdx: i, newAtomIdx };
          }
        }
      }
    }
    return null;
  }

  function findSharedEdgeAtoms(ring1: RingInfo, ring2: RingInfo): number[] {
    const shared: number[] = [];
    const ring1Set = new Set(ring1.atoms);
    for (const atom of ring2.atoms) {
      if (ring1Set.has(atom)) {
        shared.push(atom);
      }
    }
    
    console.log(`findSharedEdgeAtoms: ring1=[${ring1.atoms.join(',')}], ring2=[${ring2.atoms.join(',')}], shared=[${shared.join(',')}]`);
    
    // 在ring1中找最长连续共享序列
    let longestInRing1: number[] = [];
    for (let start = 0; start < ring1.atoms.length; start++) {
      if (!shared.includes(ring1.atoms[start])) continue;
      let seq = [ring1.atoms[start]];
      for (let offset = 1; offset < ring1.atoms.length; offset++) {
        const idx = (start + offset) % ring1.atoms.length;
        if (shared.includes(ring1.atoms[idx])) {
          seq.push(ring1.atoms[idx]);
        } else {
          break;
        }
      }
      if (seq.length > longestInRing1.length) longestInRing1 = [...seq];
      
      seq = [ring1.atoms[start]];
      for (let offset = 1; offset < ring1.atoms.length; offset++) {
        const idx = (start - offset + ring1.atoms.length) % ring1.atoms.length;
        if (shared.includes(ring1.atoms[idx])) {
          seq.push(ring1.atoms[idx]);
        } else {
          break;
        }
      }
      if (seq.length > longestInRing1.length) longestInRing1 = [...seq];
    }
    
    console.log(`findSharedEdgeAtoms: longestInRing1=[${longestInRing1.join(',')}]`);
    
    // 返回完整的共享序列！
    if (longestInRing1.length >= 2) {
      return longestInRing1;
    }
    
    // 否则找任意相邻对
    for (let i = 0; i < shared.length; i++) {
      for (let j = i + 1; j < shared.length; j++) {
        const a = shared[i];
        const b = shared[j];
        const isBonded = parsedBonds.some(bond => 
          (bond.a1 === a && bond.a2 === b) || (bond.a1 === b && bond.a2 === a)
        );
        if (isBonded) {
          return [a, b];
        }
      }
    }
    
    return shared.slice(0, 2);
  }

  function findChainToRing(existingAtomIdx: number, targetRing: RingInfo): number[] | null {
    const ringSet = new Set(targetRing.atoms);
    const visited = new Set<number>();
    const chain: number[] = [];
    
    function dfs(current: number, from: number): boolean {
      if (visited.has(current)) return false;
      visited.add(current);
      
      if (ringSet.has(current)) {
        chain.push(current);
        return true;
      }
      
      const neighbors = getBondedAtoms(current, parsedBonds);
      for (const neighbor of neighbors) {
        if (neighbor !== from) {
          if (dfs(neighbor, current)) {
            chain.push(current);
            return true;
          }
        }
      }
      return false;
    }
    
    if (dfs(existingAtomIdx, -1) && chain.length > 1) {
      chain.reverse();
      return chain;
    }
    return null;
  }

  // 将方向投影到xy平面并过滤键角不合理的方向
  // 3D方向投影后可能变成指向邻居方向（键角~180°），需要过滤掉
  function projectAndFilterDirections(
    dirs: { x: number; y: number; z: number }[],
    currentPos: { x: number; y: number; z: number },
    neighborPositions: { x: number; y: number; z: number }[],
    hyb: string
  ): { x: number; y: number; z: number }[] {
    // 投影到xy平面并归一化
    const projected = dirs.map(d => {
      const xyLen = Math.sqrt(d.x * d.x + d.y * d.y);
      if (xyLen > 0.001) {
        return { x: d.x / xyLen, y: d.y / xyLen, z: 0 };
      }
      return null;
    }).filter((d): d is { x: number; y: number; z: number } => d !== null);

    if (neighborPositions.length === 0) return projected;

    // 过滤掉键角不合理的方向
    // 计算每个方向与每个邻居方向的夹角
    const minAngle = hyb === 'sp2' ? 90 : 80;  // sp2最小90°, sp3最小80°
    const maxAngle = hyb === 'sp2' ? 150 : 150; // 最大150°

    return projected.filter(dir => {
      for (const nPos of neighborPositions) {
        const v1 = { x: nPos.x - currentPos.x, y: nPos.y - currentPos.y };
        const v2 = { x: dir.x, y: dir.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (len1 < 0.001 || len2 < 0.001) continue;
        const angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
        // 键角 = 180° - angle，所以 angle < 30° 意味着键角 > 150°
        if (angle < 30 || angle > maxAngle + 30) return false;
      }
      return true;
    });
  }

  // 空间位阻回避：从多个候选方向中选择远离已有结构的方向
  function chooseBestDirection(
    currentPos: { x: number; y: number; z: number },
    directions: { x: number; y: number; z: number }[],
    bondLength: number,
    excludeIds: string[]
  ): number {
    if (directions.length <= 1) return 0;

    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let di = 0; di < directions.length; di++) {
      const dir = directions[di];
      const newPos = {
        x: currentPos.x + dir.x * bondLength,
        y: currentPos.y + dir.y * bondLength,
        z: (currentPos.z || 0) + (dir.z || 0) * bondLength
      };

      // 计算新位置到所有已有原子的最小距离（排除当前原子和其邻居）
      let minDist = Infinity;
      atomPositions.forEach((pos, id) => {
        if (excludeIds.includes(id)) return;
        const dx = newPos.x - pos.x;
        const dy = newPos.y - pos.y;
        const dz = (newPos.z || 0) - (pos.z || 0);
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < minDist) minDist = dist;
      });

      // 距离越大（远离已有结构），分数越高
      if (minDist > bestScore) {
        bestScore = minDist;
        bestIndex = di;
      }
    }

    return bestIndex;
  }

  // ringBuilt is already declared and populated by fragment matching above
  
  console.log('[generate3DCoordinates] === Starting Ring Building ===');
  console.log(`  Total rings: ${ringInfos.length}`);
  console.log(`  Already built via fragments: ${ringBuilt.size}/${ringInfos.length}`);
  
  // 按环的大小排序！先构建最小的环！
  const ringOrder = ringInfos.map((_, idx) => idx).sort((a, b) => {
    return ringInfos[a].atoms.length - ringInfos[b].atoms.length;
  });
  
  // 打印所有环的信息
  for (let i = 0; i < ringInfos.length; i++) {
    const atomsInfo = ringInfos[i].atoms.map(idx => `${parsedAtoms[idx].symbol}(${idx})`).join(', ');
    console.log(`  Ring ${i}: atoms=[${atomsInfo}], aromatic=${ringInfos[i].isAromatic}, built=${ringBuilt.has(i)}, size=${ringInfos[i].atoms.length}`);
  }
  
  if (ringInfos.length > 0) {
    // 找到最小的环！作为起始环！
    let minSizeRingIdx = 0;
    let minSize = ringInfos[0].atoms.length;
    for (let i = 1; i < ringInfos.length; i++) {
      if (ringInfos[i].atoms.length < minSize) {
        minSize = ringInfos[i].atoms.length;
        minSizeRingIdx = i;
      }
    }
    
    // 只构建最小的环如果它还没被构建！
    if (!ringBuilt.has(minSizeRingIdx)) {
      console.log(`  Building Ring ${minSizeRingIdx} at position (0, 0, 0)`);
      buildRingAtPosition(ringInfos[minSizeRingIdx], { x: 0, y: 0, z: 0 }, 0);
      ringBuilt.add(minSizeRingIdx);
    }
    
    let builtCount = ringBuilt.size;
    while (builtCount < ringInfos.length) {
      let foundConnection = false;
      
      // 按从小到大顺序构建剩余环！
      for (const i of ringOrder) {
        if (ringBuilt.has(i)) continue;
        
        // 检查是否有碎片匹配
        if (fragmentMatchByRing.has(i)) {
          const { fragment, atomMap } = fragmentMatchByRing.get(i)!;
          
          // 找连接原子：碎片外的已构建原子，通过键连接到碎片原子
          // 这些连接原子确定了碎片在分子中的位置和方向
          interface Connection { outsideIdx: number; outsidePos: { x: number; y: number; z: number }; fragMolIdx: number; fragIdx: number; }
          const connections: Connection[] = [];
          
          for (const [molIdx, fragIdx] of atomMap) {
            const bondedAtoms = getBondedAtoms(molIdx, parsedBonds);
            for (const bIdx of bondedAtoms) {
              if (!atomMap.has(bIdx) && atomPositions.has(parsedAtoms[bIdx].id)) {
                connections.push({
                  outsideIdx: bIdx,
                  outsidePos: atomPositions.get(parsedAtoms[bIdx].id)!,
                  fragMolIdx: molIdx,
                  fragIdx: fragIdx
                });
              }
            }
          }
          
          // 去重：同一个outsideIdx只保留一个
          const seenOutside = new Set<number>();
          const uniqueConnections = connections.filter(c => {
            if (seenOutside.has(c.outsideIdx)) return false;
            seenOutside.add(c.outsideIdx);
            return true;
          });
          
          if (uniqueConnections.length >= 1) {
            const conn1 = uniqueConnections[0];
            const fragAtom1 = fragment.atoms.find(a => a.idx === conn1.fragIdx)!;
            const bondLen1 = getBondLength(parsedAtoms[conn1.outsideIdx].symbol, parsedAtoms[conn1.fragMolIdx].symbol, 1);
            
            // 计算从连接原子到碎片原子的方向
            // 使用连接原子的杂化和已有邻居来确定可用方向
            const connHyb = hybridizationMap.get(parsedAtoms[conn1.outsideIdx].id) || 'sp3';
            const connNeighbors = getBondedAtoms(conn1.outsideIdx, parsedBonds);
            const connExistingPositions: { x: number; y: number; z: number }[] = [];
            for (const nIdx of connNeighbors) {
              if (nIdx !== conn1.fragMolIdx) {
                const pos = atomPositions.get(parsedAtoms[nIdx].id);
                if (pos) connExistingPositions.push(pos);
              }
            }
            
            const availableDirs = getAvailableDirections(conn1.outsidePos, connExistingPositions, connHyb as 'sp' | 'sp2' | 'sp3');
            const bestDirIdx = chooseBestDirection(conn1.outsidePos, availableDirs, bondLen1, [parsedAtoms[conn1.outsideIdx].id]);
            const molDir = availableDirs[bestDirIdx] || { x: 1, y: 0, z: 0 };
            
            // 碎片中：从fragAtom1指向碎片中心的方向
            let fragCx = 0, fragCy = 0;
            for (const a of fragment.atoms) { fragCx += a.x; fragCy += a.y; }
            fragCx /= fragment.atoms.length;
            fragCy /= fragment.atoms.length;
            
            // 旋转：使碎片中fragAtom1→中心方向与分子中连接方向一致
            const fragAngle = Math.atan2(fragCy - fragAtom1.y, fragCx - fragAtom1.x);
            const molAngle = Math.atan2(molDir.y, molDir.x);
            const rotation = molAngle - fragAngle;
            
            // fragAtom1的目标位置
            const targetPos = {
              x: conn1.outsidePos.x + molDir.x * bondLen1,
              y: conn1.outsidePos.y + molDir.y * bondLen1,
              z: (conn1.outsidePos.z || 0) + (molDir.z || 0) * bondLen1
            };
            
            // 旋转后fragAtom1的位置
            const r1x = fragAtom1.x * Math.cos(rotation) - fragAtom1.y * Math.sin(rotation);
            const r1y = fragAtom1.x * Math.sin(rotation) + fragAtom1.y * Math.cos(rotation);
            
            const tx = targetPos.x - r1x;
            const ty = targetPos.y - r1y;
            
            console.log(`  [FragmentPlacement] Placing "${fragment.name}" via connection atom ${conn1.outsideIdx}, rotation=${(rotation * 180 / Math.PI).toFixed(1)}°`);
            console.log(`  [FragmentPlacement] conn1.outsidePos=(${conn1.outsidePos.x.toFixed(2)},${conn1.outsidePos.y.toFixed(2)}), targetPos=(${targetPos.x.toFixed(2)},${targetPos.y.toFixed(2)})`);
            
            for (const [molIdx, fragIdx] of atomMap) {
              const fragAtom = fragment.atoms.find(a => a.idx === fragIdx);
              if (!fragAtom) continue;
              
              const rx = fragAtom.x * Math.cos(rotation) - fragAtom.y * Math.sin(rotation);
              const ry = fragAtom.x * Math.sin(rotation) + fragAtom.y * Math.cos(rotation);
              
              atomPositions.set(parsedAtoms[molIdx].id, {
                x: parseFloat((rx + tx).toFixed(6)),
                y: parseFloat((ry + ty).toFixed(6)),
                z: targetPos.z,
              });
              builtAtoms.add(molIdx);
            }
            
            // 标记碎片中所有环为已构建
            let newlyBuiltCount = 0;
            for (const [ringIdx, matchData] of fragmentMatchByRing) {
              if (matchData.fragment === fragment && !ringBuilt.has(ringIdx)) {
                ringBuilt.add(ringIdx);
                newlyBuiltCount++;
              }
            }
            builtCount += newlyBuiltCount;
            foundConnection = true;
            console.log(`  [FragmentPlacement] Applied fragment "${fragment.name}", built ${newlyBuiltCount} rings`);
            continue;
          }
          
          // 没有连接原子，跳过，等下一轮
          console.log(`  [FragmentPlacement] No connections yet for fragment "${fragment.name}", skipping`);
          continue;
        }
        
        console.log(`  Checking Ring ${i} for connections...`);
        console.log(`    Ring ${i} atoms: [${ringInfos[i].atoms.join(',')}]`);
        
        // 首先检查是否有环原子已经有位置
        let hasAllPositions = true;
        for (const atomIdx of ringInfos[i].atoms) {
          if (!atomPositions.has(parsedAtoms[atomIdx].id)) {
            hasAllPositions = false;
          }
        }
        
        if (hasAllPositions) {
          console.log(`    Ring ${i} already has all positions (likely from fragment), skipping`);
          ringBuilt.add(i);
          builtCount++;
          foundConnection = true;
          continue;
        }
        
        // ========== 优先检查共享边构建！ ==========
        let sharedEdgeFound = false;
        for (let existingRingIdx = 0; existingRingIdx < ringInfos.length; existingRingIdx++) {
          if (ringBuilt.has(existingRingIdx)) {
            const sharedAtoms = findSharedEdgeAtoms(ringInfos[i], ringInfos[existingRingIdx]);
            if (sharedAtoms.length >= 2) {
              // 使用完整的共享序列！取最后两个作为构建起点
              const useShared0 = sharedAtoms[sharedAtoms.length - 2];
              const useShared1 = sharedAtoms[sharedAtoms.length - 1];
              
              // 检查共享原子是否都有位置
              const pos1 = atomPositions.get(parsedAtoms[useShared0].id);
              const pos2 = atomPositions.get(parsedAtoms[useShared1].id);
              if (pos1 && pos2) {
                console.log(`  Building Ring ${i} via shared edge with Ring ${existingRingIdx}: atoms [${sharedAtoms.join(',')}] using [${useShared0},${useShared1}] as start`);
                
                const n = ringInfos[i].atoms.length;
                const bondLength = ringInfos[i].isAromatic ? 1.39 : 1.54;
                
                const sharedIdx0 = ringInfos[i].atoms.indexOf(useShared0);
                const sharedIdx1 = ringInfos[i].atoms.indexOf(useShared1);
                
                const edgeMid = {
                  x: (pos1.x + pos2.x) / 2,
                  y: (pos1.y + pos2.y) / 2,
                  z: ((pos1.z || 0) + (pos2.z || 0)) / 2
                };
                
                let existingCenter = { x: 0, y: 0, z: 0 };
                let existingCenterCount = 0;
                for (const atomIdx of ringInfos[existingRingIdx].atoms) {
                  const p = atomPositions.get(parsedAtoms[atomIdx].id);
                  if (p) {
                    existingCenter.x += p.x;
                    existingCenter.y += p.y;
                    existingCenter.z += p.z || 0;
                    existingCenterCount++;
                  }
                }
                if (existingCenterCount > 0) {
                  existingCenter.x /= existingCenterCount;
                  existingCenter.y /= existingCenterCount;
                  existingCenter.z /= existingCenterCount;
                }
                
                const perpDir = {
                  x: (pos1.y - pos2.y),
                  y: -(pos1.x - pos2.x),
                  z: 0
                };
                
                const exteriorAngle = 2 * Math.PI / n;
                const forwardStep = (sharedIdx1 - sharedIdx0 + n) % n;
                let buildStartIdx: number;
                let buildPrevPos: { x: number; y: number; z: number };
                let buildCurrPos: { x: number; y: number; z: number };
                let buildEdgeAngle: number;
                
                if (forwardStep === 1) {
                  buildStartIdx = sharedIdx1;
                  buildPrevPos = pos1;
                  buildCurrPos = pos2;
                  buildEdgeAngle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
                } else {
                  buildStartIdx = sharedIdx0;
                  buildPrevPos = pos2;
                  buildCurrPos = pos1;
                  buildEdgeAngle = Math.atan2(pos1.y - pos2.y, pos1.x - pos2.x);
                }
                
                // 标记所有共享原子为已构建！
                for (const atomIdx of sharedAtoms) {
                  builtAtoms.add(atomIdx);
                }
                
                let turnSign = 0;
                
                for (let step = 1; step < n; step++) {
                  const ri = (buildStartIdx + step) % n;
                  const atomIdx = ringInfos[i].atoms[ri];
                  
                  if (sharedAtoms.includes(atomIdx)) {
                    // 遇到共享原子！保持它的位置不动！
                    const actualPos = atomPositions.get(parsedAtoms[atomIdx].id)!;
                    console.log(`    Found shared atom ${atomIdx} at ${JSON.stringify(actualPos)}, keeping it!`);
                    buildEdgeAngle = Math.atan2(actualPos.y - buildCurrPos.y, actualPos.x - buildCurrPos.x);
                    buildPrevPos = buildCurrPos;
                    buildCurrPos = actualPos;
                    builtAtoms.add(atomIdx);
                    turnSign = 0; // 重置turnSign，因为方向改变了
                  } else {
                    if (turnSign === 0) {
                      const testAngleL = buildEdgeAngle + exteriorAngle;
                      const testPosL = {
                        x: buildCurrPos.x + bondLength * Math.cos(testAngleL),
                        y: buildCurrPos.y + bondLength * Math.sin(testAngleL),
                        z: 0,
                      };
                      const testAngleR = buildEdgeAngle - exteriorAngle;
                      const testPosR = {
                        x: buildCurrPos.x + bondLength * Math.cos(testAngleR),
                        y: buildCurrPos.y + bondLength * Math.sin(testAngleR),
                        z: 0,
                      };
                      // 选择离existingCenter更远的方向，避免和第一个环重叠！
                      const distL = (testPosL.x - existingCenter.x) ** 2 + (testPosL.y - existingCenter.y) ** 2;
                      const distR = (testPosR.x - existingCenter.x) ** 2 + (testPosR.y - existingCenter.y) ** 2;
                      turnSign = distL > distR ? 1 : -1;
                      console.log(`    turnSign calculated: ${turnSign}, distL=${distL}, distR=${distR}`);
                    }
                    
                    buildEdgeAngle += turnSign * exteriorAngle;
                    const nextPos = {
                      x: buildCurrPos.x + bondLength * Math.cos(buildEdgeAngle),
                      y: buildCurrPos.y + bondLength * Math.sin(buildEdgeAngle),
                      z: 0,
                    };
                    builtAtoms.add(atomIdx);
                    atomPositions.set(parsedAtoms[atomIdx].id, nextPos);
                    buildPrevPos = buildCurrPos;
                    buildCurrPos = nextPos;
                  }
                }
                
                console.log(`    Built Ring ${i} via shared edge, kept shared atoms [${sharedAtoms.join(',')}] in place`);
                ringBuilt.add(i);
                builtCount++;
                foundConnection = true;
                sharedEdgeFound = true;
                break;
              }
            }
          }
        }
        
        if (sharedEdgeFound) continue;
        
        // ========== 没有共享边，再检查链连接 ==========
        let chainConnectedAtomIdx = -1;
        for (const atomIdx of ringInfos[i].atoms) {
          if (atomPositions.has(parsedAtoms[atomIdx].id)) {
            console.log(`    Ring ${i} atom ${atomIdx}(${parsedAtoms[atomIdx].symbol}) already has position!`);
            const isInBuiltRing = ringInfos.some((r, idx) => ringBuilt.has(idx) && r.atoms.includes(atomIdx));
            if (!isInBuiltRing) {
              chainConnectedAtomIdx = atomIdx;
              break;
            }
          }
        }
        
        // 如果有链连接的原子，从那里构建环
        if (chainConnectedAtomIdx >= 0) {
          const existingAtomPos = atomPositions.get(parsedAtoms[chainConnectedAtomIdx].id)!;
          console.log(`  Building Ring ${i} via chain connection: atom ${chainConnectedAtomIdx}(${parsedAtoms[chainConnectedAtomIdx].symbol})`);
          
          const n = ringInfos[i].atoms.length;
          const bondLength = ringInfos[i].isAromatic ? 1.39 : 1.54;
          const radius = bondLength / (2 * Math.sin(Math.PI / n));
          
          const existingNeighbors = getBondedAtoms(chainConnectedAtomIdx, parsedBonds);
          const existingNeighborPositions: { x: number; y: number; z: number }[] = [];
          
          for (const nIdx of existingNeighbors) {
            const pos = atomPositions.get(parsedAtoms[nIdx].id);
            if (pos) existingNeighborPositions.push(pos);
          }
          
          const existingHyb = hybridizationMap.get(parsedAtoms[chainConnectedAtomIdx].id) || 'sp3';
          
          // 对于sp3杂化，保持3D方向以维持四面体几何；对于其他杂化使用投影方向
          const availableDirsRaw = getAvailableDirections(existingAtomPos, existingNeighborPositions, existingHyb);
          let ringNormal: { x: number; y: number; z: number } | null = null;
          
          let direction: { x: number; y: number; z: number };
          if (existingHyb === 'sp3') {
            // sp3杂化：使用原始3D方向
            if (availableDirsRaw.length >= 1) {
              const bestIdx = chooseBestDirection(existingAtomPos, availableDirsRaw, radius, [parsedAtoms[chainConnectedAtomIdx].id]);
              direction = availableDirsRaw[bestIdx];
            } else {
              direction = { x: 1, y: 0, z: 0 };
            }
            
            // 计算环法向量：垂直于连接方向的向量
            const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z) || 1;
            const dirNorm = { x: direction.x / dirLen, y: direction.y / dirLen, z: direction.z / dirLen };
            
            // 找到一个与dirNorm不共线的辅助向量
            let helper = { x: 1, y: 0, z: 0 };
            if (Math.abs(dirNorm.x) > 0.9) {
              helper = { x: 0, y: 1, z: 0 };
            }
            
            // 叉乘得到垂直于连接方向的法向量
            ringNormal = {
              x: dirNorm.y * helper.z - dirNorm.z * helper.y,
              y: dirNorm.z * helper.x - dirNorm.x * helper.z,
              z: dirNorm.x * helper.y - dirNorm.y * helper.x
            };
            
            // 规范化
            const normalLen = Math.sqrt(ringNormal.x * ringNormal.x + ringNormal.y * ringNormal.y + ringNormal.z * ringNormal.z) || 1;
            ringNormal = { x: ringNormal.x / normalLen, y: ringNormal.y / normalLen, z: ringNormal.z / normalLen };
          } else {
            // sp/sp2杂化：使用投影方向
            const availableDirsFiltered = projectAndFilterDirections(availableDirsRaw, existingAtomPos, existingNeighborPositions, existingHyb);
            
            if (availableDirsFiltered.length >= 1) {
              const bestIdx = chooseBestDirection(existingAtomPos, availableDirsFiltered, radius, [parsedAtoms[chainConnectedAtomIdx].id]);
              direction = availableDirsFiltered[bestIdx];
            } else {
              direction = { x: 1, y: 0, z: 0 };
            }
          }
          
          // 环中心
          const ringCenter = {
            x: existingAtomPos.x + direction.x * radius,
            y: existingAtomPos.y + direction.y * radius,
            z: (existingAtomPos.z || 0) + (direction.z || 0) * radius
          };
          
          const newAtomRingIndex = ringInfos[i].atoms.indexOf(chainConnectedAtomIdx);
          const rotationAngle = compute3DRingRotationAngle(direction, ringNormal, newAtomRingIndex, n);
          
          // sp3杂化时使用计算的法向量构建3D环；其他杂化使用xy平面
          buildRingAtPosition(ringInfos[i], ringCenter, rotationAngle, ringNormal);
          ringBuilt.add(i);
          builtCount++;
          foundConnection = true;
          continue;
        }
        
        const connection = findRingConnection(ringInfos[i], ringInfos);
        if (connection) {
          const { existingRing, existingAtomIdx, newAtomIdx } = connection;
          const existingAtomPos = atomPositions.get(parsedAtoms[existingAtomIdx].id);
          
          if (existingAtomPos) {
            // 注意：共享边构建已经在前面检查过了，这里只处理非共享边连接
            {
              console.log(`  Building Ring ${i} via ring-ring connection: ${existingAtomIdx}(${parsedAtoms[existingAtomIdx].symbol}) -> ${newAtomIdx}(${parsedAtoms[newAtomIdx].symbol})`);
              const existingNeighbors = getBondedAtoms(existingAtomIdx, parsedBonds);
              const existingNeighborPositions: { x: number; y: number; z: number }[] = [];
              
              for (const nIdx of existingNeighbors) {
                if (nIdx !== newAtomIdx) {
                  const pos = atomPositions.get(parsedAtoms[nIdx].id);
                  if (pos) existingNeighborPositions.push(pos);
                }
              }
              
              let direction: { x: number; y: number; z: number };
              const existingHyb = hybridizationMap.get(parsedAtoms[existingAtomIdx].id) || 'sp3';
              
              // 先计算环参数，用于方向评分
              const n = ringInfos[i].atoms.length;
              const ringBondLength = ringInfos[i].isAromatic ? 1.39 : 1.54;
              const ringRadius = ringBondLength / (2 * Math.sin(Math.PI / n));
              const connectBondLength = getBondLength(parsedAtoms[existingAtomIdx].symbol, parsedAtoms[newAtomIdx].symbol, 1);
              
              // 对于sp3杂化，保持3D方向以维持四面体几何；对于其他杂化使用投影方向
              const availableDirsRaw = getAvailableDirections(existingAtomPos, existingNeighborPositions, existingHyb);
              let availableDirs: { x: number; y: number; z: number }[];
              let ringNormal: { x: number; y: number; z: number } | null = null;
              
              if (existingHyb === 'sp3') {
                // sp3杂化：使用原始3D方向，评估时考虑z分量
                availableDirs = availableDirsRaw;
                // 评估时也用3D方向
                if (availableDirs.length >= 1) {
                  const bestIdx = chooseBestDirection(existingAtomPos, availableDirs, connectBondLength + ringRadius, [parsedAtoms[existingAtomIdx].id]);
                  direction = availableDirs[bestIdx];
                } else {
                  direction = { x: 1, y: 0, z: 0 };
                }
                
                // 计算环法向量：垂直于连接方向的向量
                const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z) || 1;
                const dirNorm = { x: direction.x / dirLen, y: direction.y / dirLen, z: direction.z / dirLen };
                
                // 找到一个与dirNorm不共线的辅助向量
                let helper = { x: 1, y: 0, z: 0 };
                if (Math.abs(dirNorm.x) > 0.9) {
                  helper = { x: 0, y: 1, z: 0 };
                }
                
                // 叉乘得到垂直于连接方向的法向量
                ringNormal = {
                  x: dirNorm.y * helper.z - dirNorm.z * helper.y,
                  y: dirNorm.z * helper.x - dirNorm.x * helper.z,
                  z: dirNorm.x * helper.y - dirNorm.y * helper.x
                };
                
                // 规范化
                const normalLen = Math.sqrt(ringNormal.x * ringNormal.x + ringNormal.y * ringNormal.y + ringNormal.z * ringNormal.z) || 1;
                ringNormal = { x: ringNormal.x / normalLen, y: ringNormal.y / normalLen, z: ringNormal.z / normalLen };
              } else {
                // sp/sp2杂化：使用投影方向，环在xy平面构建
                const availableDirsFiltered = projectAndFilterDirections(availableDirsRaw, existingAtomPos, existingNeighborPositions, existingHyb);
                
                if (availableDirsFiltered.length >= 1) {
                  const bestIdx = chooseBestDirection(existingAtomPos, availableDirsFiltered, connectBondLength + ringRadius, [parsedAtoms[existingAtomIdx].id]);
                  direction = availableDirsFiltered[bestIdx];
                } else {
                  direction = { x: 1, y: 0, z: 0 };
                }
              }
              
              // 环中心
              const ringCenter = {
                x: existingAtomPos.x + direction.x * (connectBondLength + ringRadius),
                y: existingAtomPos.y + direction.y * (connectBondLength + ringRadius),
                z: (existingAtomPos.z || 0) + (direction.z || 0) * (connectBondLength + ringRadius)
              };
              
              const newAtomPos = {
                x: existingAtomPos.x + direction.x * connectBondLength,
                y: existingAtomPos.y + direction.y * connectBondLength,
                z: (existingAtomPos.z || 0) + (direction.z || 0) * connectBondLength
              };
              
              atomPositions.set(parsedAtoms[newAtomIdx].id, newAtomPos);
              builtAtoms.add(newAtomIdx);
              
              // 计算旋转角度（3D环使用局部坐标系）
              const newAtomRingIndex = ringInfos[i].atoms.indexOf(newAtomIdx);
              const rotationAngle = compute3DRingRotationAngle(direction, ringNormal, newAtomRingIndex, n);
              
              // sp3杂化时使用计算的法向量构建3D环；其他杂化使用xy平面
              buildRingAtPosition(ringInfos[i], ringCenter, rotationAngle, ringNormal);
            }
            
            ringBuilt.add(i);
            builtCount++;
            foundConnection = true;
            break;
          }
        } else {
          // 检查链到环的连接
          console.log(`  Ring ${i} has no ring-ring connection, checking chain-ring connection...`);
          let chainConnection = findChainToRingConnection(ringInfos[i]);
          
          if (!chainConnection) {
            // 如果没有找到已构建的链连接，检查是否有未构建的链原子连接到这个环
            for (const ringAtomIdx of ringInfos[i].atoms) {
              for (let j = 0; j < parsedAtoms.length; j++) {
                if (j === ringAtomIdx) continue;
                const hasBond = parsedBonds.some(b => 
                  (b.a1 === ringAtomIdx && b.a2 === j) || 
                  (b.a1 === j && b.a2 === ringAtomIdx)
                );
                if (hasBond && !ringInfos.some(r => r.atoms.includes(j))) {
                  // 找到连接的链原子，检查是否能通过DFS找到已构建的原子
                  const pathToBuilt = findPathToBuiltAtom(j);
                  if (pathToBuilt) {
                    console.log(`  Ring ${i} has chain atom ${j}(${parsedAtoms[j].symbol}) connected to ${ringAtomIdx}(${parsedAtoms[ringAtomIdx].symbol})`);
                    console.log(`  Found path to built atom: ${pathToBuilt.join(' -> ')}`);
                    // 先构建这条路径
                    buildChainToRing(pathToBuilt, ringAtomIdx, i);
                    // 使用路径中离环最近的原子作为连接点
                    chainConnection = { existingAtomIdx: pathToBuilt[0], newAtomIdx: ringAtomIdx };
                    break;
                  }
                }
              }
              if (chainConnection) break;
            }
          }
          
          if (chainConnection) {
            const { existingAtomIdx, newAtomIdx } = chainConnection;
            const existingAtomPos = atomPositions.get(parsedAtoms[existingAtomIdx].id);
            if (!existingAtomPos) {
              console.log(`  No position for chain connection atom ${existingAtomIdx}(${parsedAtoms[existingAtomIdx].symbol}), skipping ring ${i}`);
              chainConnection = null;
              continue;
            }
            console.log(`  Building Ring ${i} via chain-ring connection: ${existingAtomIdx}(${parsedAtoms[existingAtomIdx].symbol}) -> ${newAtomIdx}(${parsedAtoms[newAtomIdx].symbol})`);
            
            const n = ringInfos[i].atoms.length;
            const bondLength = ringInfos[i].isAromatic ? 1.39 : 1.54;
            const radius = bondLength / (2 * Math.sin(Math.PI / n));
            const connectBondLength = getBondLength(parsedAtoms[existingAtomIdx].symbol, parsedAtoms[newAtomIdx].symbol, 1);
            
            const existingNeighbors = getBondedAtoms(existingAtomIdx, parsedBonds);
            const existingNeighborPositions: { x: number; y: number; z: number }[] = [];
            
            for (const nIdx of existingNeighbors) {
              if (nIdx !== newAtomIdx) {
                const pos = atomPositions.get(parsedAtoms[nIdx].id);
                if (pos) existingNeighborPositions.push(pos);
              }
            }
            
            let direction: { x: number; y: number; z: number };
            const existingHyb = hybridizationMap.get(parsedAtoms[existingAtomIdx].id) || 'sp3';
            
            // 对于sp3杂化，保持3D方向以维持四面体几何；对于其他杂化使用投影方向
            const availableDirsRaw = getAvailableDirections(existingAtomPos, existingNeighborPositions, existingHyb);
            let ringNormal: { x: number; y: number; z: number } | null = null;
            
            if (existingHyb === 'sp3') {
              // sp3杂化：优先选择xy平面内的方向（z=0），确保环与第一个环共面
              // 过滤出z分量接近0的方向
              const planarDirs = availableDirsRaw.filter(d => Math.abs(d.z) < 0.1);
              const dirsToUse = planarDirs.length > 0 ? planarDirs : availableDirsRaw;
              
              if (dirsToUse.length >= 1) {
                const bestIdx = chooseBestDirection(existingAtomPos, dirsToUse, connectBondLength + radius, [parsedAtoms[existingAtomIdx].id]);
                direction = dirsToUse[bestIdx];
              } else {
                direction = { x: 1, y: 0, z: 0 };
              }
              
              // 计算环法向量：垂直于连接方向的向量
              const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z) || 1;
              const dirNorm = { x: direction.x / dirLen, y: direction.y / dirLen, z: direction.z / dirLen };
              
              // 找到一个与dirNorm不共线的辅助向量
              let helper = { x: 1, y: 0, z: 0 };
              if (Math.abs(dirNorm.x) > 0.9) {
                helper = { x: 0, y: 1, z: 0 };
              }
              
              // 叉乘得到垂直于连接方向的法向量
              ringNormal = {
                x: dirNorm.y * helper.z - dirNorm.z * helper.y,
                y: dirNorm.z * helper.x - dirNorm.x * helper.z,
                z: dirNorm.x * helper.y - dirNorm.y * helper.x
              };
              
              // 规范化
              const normalLen = Math.sqrt(ringNormal.x * ringNormal.x + ringNormal.y * ringNormal.y + ringNormal.z * ringNormal.z) || 1;
              ringNormal = { x: ringNormal.x / normalLen, y: ringNormal.y / normalLen, z: ringNormal.z / normalLen };
            } else {
              // sp/sp2杂化：使用投影方向
              const availableDirsFiltered = projectAndFilterDirections(availableDirsRaw, existingAtomPos, existingNeighborPositions, existingHyb);
              
              if (availableDirsFiltered.length >= 1) {
                const bestIdx = chooseBestDirection(existingAtomPos, availableDirsFiltered, connectBondLength + radius, [parsedAtoms[existingAtomIdx].id]);
                direction = availableDirsFiltered[bestIdx];
              } else {
                direction = { x: 1, y: 0, z: 0 };
              }
            }
            
            // 环中心
            const ringCenter = {
              x: existingAtomPos.x + direction.x * (connectBondLength + radius),
              y: existingAtomPos.y + direction.y * (connectBondLength + radius),
              z: (existingAtomPos.z || 0) + (direction.z || 0) * (connectBondLength + radius)
            };
            
            const newAtomPos = {
              x: existingAtomPos.x + direction.x * connectBondLength,
              y: existingAtomPos.y + direction.y * connectBondLength,
              z: (existingAtomPos.z || 0) + (direction.z || 0) * connectBondLength
            };
            
            atomPositions.set(parsedAtoms[newAtomIdx].id, newAtomPos);
            builtAtoms.add(newAtomIdx);
            
            // 计算旋转角度（3D环使用局部坐标系）
            const newAtomRingIndex = ringInfos[i].atoms.indexOf(newAtomIdx);
            const rotationAngle = compute3DRingRotationAngle(direction, ringNormal, newAtomRingIndex, n);
            
            // sp3杂化时使用计算的法向量构建3D环；其他杂化使用xy平面
            buildRingAtPosition(ringInfos[i], ringCenter, rotationAngle, ringNormal);
            
            ringBuilt.add(i);
            builtCount++;
            foundConnection = true;
            break;
          }
        }
      }
      
      if (!foundConnection) {
        console.log(`  No connection found for remaining rings, placing at offset positions`);
        for (let i = 0; i < ringInfos.length; i++) {
          if (!ringBuilt.has(i)) {
            const offsetX = ringBuilt.size * 8;
            console.log(`  Building Ring ${i} at offset position (${offsetX}, 0, 0)`);
            buildRingAtPosition(ringInfos[i], { x: offsetX, y: 0, z: 0 }, 0);
            ringBuilt.add(i);
            builtCount++;
            foundConnection = true;
            break;
          }
        }
      }
    }
  }
  
  console.log('[generate3DCoordinates] === After Ring Building ===');
  console.log(`  Built rings: ${ringBuilt.size}/${ringInfos.length}`);
  console.log(`  Built atoms: ${builtAtoms.size}/${parsedAtoms.length}`);

  // 4. 构建邻接表
  const adjacencyList: { neighborIdx: number, order: number }[][] = Array(parsedAtoms.length).fill(0).map(() => []);
  parsedBonds.forEach(b => {
    adjacencyList[b.a1].push({ neighborIdx: b.a2, order: b.order });
    adjacencyList[b.a2].push({ neighborIdx: b.a1, order: b.order });
  });

  // 构建环原子索引集合，用于BFS中判断是否跳过avoidAtomOverlap
  const ringAtomIndices = new Set<number>();
  for (const ringInfo of ringInfos) {
    for (const atomIdx of ringInfo.atoms) {
      ringAtomIndices.add(atomIdx);
    }
  }

  // 5. 使用 BFS 遍历所有原子（跳过碎片匹配已构建的原子）
  const queue: number[] = [];
  
  // 构建延迟碎片原子集合，BFS不放置这些原子
  const deferredFragmentAtoms = new Set<number>();
  for (const [, { atomMap }] of fragmentMatchByRing) {
    for (const molIdx of atomMap.keys()) {
      deferredFragmentAtoms.add(molIdx);
    }
  }
  if (deferredFragmentAtoms.size > 0) {
    console.log(`  [BFS] Skipping ${deferredFragmentAtoms.size} deferred fragment atoms: [${Array.from(deferredFragmentAtoms).join(',')}]`);
  }
  
  // 将碎片匹配已构建的原子加入 builtAtoms 和队列
  for (let i = 0; i < parsedAtoms.length; i++) {
    if (atomPositions.has(parsedAtoms[i].id) && !builtAtoms.has(i)) {
      builtAtoms.add(i);
    }
  }
  
  // 如果有已经构建的原子，从它们开始
  if (builtAtoms.size > 0) {
    queue.push(...Array.from(builtAtoms));
  } else {
    // 否则从第一个原子开始
    queue.push(0);
    atomPositions.set(parsedAtoms[0].id, { x: 0, y: 0, z: 0 });
    builtAtoms.add(0);
  }

  // 简单的方向生成函数
  function getAvailableDirections(
    currentPos: { x: number, y: number, z: number },
    existingNeighborPositions: { x: number, y: number, z: number }[],
    hyb: 'sp' | 'sp2' | 'sp3'
  ): { x: number, y: number, z: number }[] {
    const directions: { x: number, y: number, z: number }[] = [];
    const cos109 = -1 / 3;
    const sin109 = Math.sqrt(8) / 3;
    const cos120 = -0.5;
    const sin120 = Math.sqrt(3) / 2;

    // sp3 使用真正的3D四面体几何，不投影到2D
    if (hyb === 'sp3') {
      return getSp3Directions3D(currentPos, existingNeighborPositions);
    }

    // sp 使用3D直线形几何（三键）
    if (hyb === 'sp') {
      return getSpDirections3D(currentPos, existingNeighborPositions);
    }

    // sp2 使用2D投影（平面结构）
    const existing2D = existingNeighborPositions.map(p => ({ ...p, z: 0 }));

    if (existing2D.length === 0) {
      directions.push({ x: 1, y: 0, z: 0 });
      directions.push({ x: -0.5, y: Math.sqrt(3) / 2, z: 0 });
      directions.push({ x: -0.5, y: -Math.sqrt(3) / 2, z: 0 });
    } else if (existing2D.length === 1) {
      const existing = existing2D[0];
      const ux = currentPos.x - existing.x;
      const uy = currentPos.y - existing.y;
      const uLen = Math.sqrt(ux * ux + uy * uy) || 1;
      const u = { x: ux / uLen, y: uy / uLen, z: 0 };
      const p1 = { x: -u.y, y: u.x, z: 0 };

      directions.push({
        x: -cos120 * u.x + sin120 * p1.x,
        y: -cos120 * u.y + sin120 * p1.y,
        z: 0
      });
      directions.push({
        x: -cos120 * u.x - sin120 * p1.x,
        y: -cos120 * u.y - sin120 * p1.y,
        z: 0
      });
    } else {
      const sum = existing2D.reduce((acc, pos) => ({
        x: acc.x + (pos.x - currentPos.x),
        y: acc.y + (pos.y - currentPos.y),
        z: 0
      }), { x: 0, y: 0, z: 0 });

      const sLen = Math.sqrt(sum.x * sum.x + sum.y * sum.y) || 1;
      const avgDir = { x: -sum.x / sLen, y: -sum.y / sLen, z: 0 };
      const perp1 = { x: -avgDir.y, y: avgDir.x, z: 0 };
      const existingCount = existing2D.length;

      if (existingCount === 2) {
        directions.push({ x: avgDir.x, y: avgDir.y, z: 0 });
      } else {
        directions.push({
          x: cos120 * avgDir.x + sin120 * perp1.x,
          y: cos120 * avgDir.y + sin120 * perp1.y,
          z: 0
        });
        directions.push({
          x: cos120 * avgDir.x - sin120 * perp1.x,
          y: cos120 * avgDir.y - sin120 * perp1.y,
          z: 0
        });
      }
    }

    return directions;
  }

  /** sp直线形3D方向计算（三键）：使用真正的直线形几何 */
  function getSpDirections3D(
    currentPos: { x: number, y: number, z: number },
    existingNeighborPositions: { x: number, y: number, z: number }[]
  ): { x: number, y: number, z: number }[] {
    const directions: { x: number, y: number, z: number }[] = [];

    if (existingNeighborPositions.length === 0) {
      // 孤立sp原子：两个相反方向（直线形）
      directions.push({ x: 1, y: 0, z: 0 });
      directions.push({ x: -1, y: 0, z: 0 });
    } else if (existingNeighborPositions.length === 1) {
      // 已有一个邻居：添加反方向（三键的另一端）
      const existing = existingNeighborPositions[0];
      const dx = currentPos.x - existing.x;
      const dy = currentPos.y - existing.y;
      const dz = (currentPos.z || 0) - (existing.z || 0);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      // 反方向（三键的另一端）
      directions.push({ x: dx / len, y: dy / len, z: dz / len });
    }
    // sp杂化最多只能有2个键（三键视为一个键），已有2个邻居时不再添加方向

    return directions;
  }

  /** sp3四面体3D方向计算：使用真正的四面体几何，不投影到2D */
  function getSp3Directions3D(
    currentPos: { x: number, y: number, z: number },
    existingNeighborPositions: { x: number, y: number, z: number }[]
  ): { x: number, y: number, z: number }[] {
    const directions: { x: number, y: number, z: number }[] = [];
    const cos109 = -1 / 3;
    const sin109 = Math.sqrt(8) / 3;

    // 计算已有邻居的方向向量（从中心指向邻居）
    const existingDirs = existingNeighborPositions.map(p => {
      const dx = p.x - currentPos.x;
      const dy = p.y - currentPos.y;
      const dz = (p.z || 0) - (currentPos.z || 0);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      return { x: dx / len, y: dy / len, z: dz / len };
    });

    if (existingDirs.length === 0) {
      // 无已有邻居：提供4个四面体方向
      directions.push({ x: 1, y: 0, z: 0 });
      directions.push({ x: cos109, y: sin109, z: 0 });
      directions.push({ x: cos109, y: -sin109, z: 0 });
      directions.push({ x: cos109, y: 0, z: sin109 });
    } else if (existingDirs.length === 1) {
      // 1个已有邻居：3个剩余方向在垂直于已有键的平面内均匀分布（120°间隔）
      // 四面体零和性质：d1 + d2 + d3 + d4 = 0
      // 所以 d2 + d3 + d4 = -d1
      // 3个方向在垂直于d1的平面内120°均匀分布
      const u = existingDirs[0]; // 从中心指向已有邻居

      // 找两个垂直于u的正交基向量
      const candidates = [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 }
      ];
      let p1 = { x: 0, y: 0, z: 0 };
      for (const cand of candidates) {
        const cross = {
          x: u.y * cand.z - u.z * cand.y,
          y: u.z * cand.x - u.x * cand.z,
          z: u.x * cand.y - u.y * cand.x
        };
        const crossLen = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
        if (crossLen > 0.1) {
          p1 = { x: cross.x / crossLen, y: cross.y / crossLen, z: cross.z / crossLen };
          break;
        }
      }
      // p2 = u × p1
      const p2 = {
        x: u.y * p1.z - u.z * p1.y,
        y: u.z * p1.x - u.x * p1.z,
        z: u.x * p1.y - u.y * p1.x
      };

      // 3个四面体方向：-cos109*u + sin109*(cos(θ)*p1 + sin(θ)*p2)
      // θ = 0, 2π/3, 4π/3
      for (let k = 0; k < 3; k++) {
        const theta = k * 2 * Math.PI / 3;
        const ct = Math.cos(theta);
        const st = Math.sin(theta);
        directions.push({
          x: cos109 * u.x + sin109 * (ct * p1.x + st * p2.x),
          y: cos109 * u.y + sin109 * (ct * p1.y + st * p2.y),
          z: cos109 * u.z + sin109 * (ct * p1.z + st * p2.z)
        });
      }
    } else if (existingDirs.length === 2) {
      // 2个已有邻居：2个剩余方向
      // 四面体零和：d3 + d4 = -(d1 + d2) = -S
      // d3 = -1/√3 * Ŝ + √(2/3) * n̂
      // d4 = -1/√3 * Ŝ - √(2/3) * n̂
      const d1 = existingDirs[0];
      const d2 = existingDirs[1];
      const S = { x: d1.x + d2.x, y: d1.y + d2.y, z: d1.z + d2.z };
      const sLen = Math.sqrt(S.x * S.x + S.y * S.y + S.z * S.z) || 1;
      const sHat = { x: S.x / sLen, y: S.y / sLen, z: S.z / sLen };

      // 找垂直于S的向量n
      // n̂ 必须垂直于d1和d2，即 n̂ = d1×d2/|d1×d2|
      // 这样才能保证新方向与d1、d2都形成109.5°角
      const cross12 = {
        x: d1.y * d2.z - d1.z * d2.y,
        y: d1.z * d2.x - d1.x * d2.z,
        z: d1.x * d2.y - d1.y * d2.x
      };
      const cross12Len = Math.sqrt(cross12.x * cross12.x + cross12.y * cross12.y + cross12.z * cross12.z);
      let n: { x: number; y: number; z: number };
      if (cross12Len > 0.01) {
        n = { x: cross12.x / cross12Len, y: cross12.y / cross12Len, z: cross12.z / cross12Len };
      } else {
        // d1和d2近似平行（不应该发生在四面体中），回退到垂直于S的向量
        const candidates = [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 }
        ];
        n = { x: 0, y: 0, z: 0 };
        for (const cand of candidates) {
          const cross = {
            x: sHat.y * cand.z - sHat.z * cand.y,
            y: sHat.z * cand.x - sHat.x * cand.z,
            z: sHat.x * cand.y - sHat.y * cand.x
          };
          const crossLen = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
          if (crossLen > 0.1) {
            n = { x: cross.x / crossLen, y: cross.y / crossLen, z: cross.z / crossLen };
            break;
          }
        }
      }

      const cosAlpha = 1 / Math.sqrt(3);  // 1/√3
      const sinAlpha = Math.sqrt(2 / 3);  // √(2/3)

      directions.push({
        x: -cosAlpha * sHat.x + sinAlpha * n.x,
        y: -cosAlpha * sHat.y + sinAlpha * n.y,
        z: -cosAlpha * sHat.z + sinAlpha * n.z
      });
      directions.push({
        x: -cosAlpha * sHat.x - sinAlpha * n.x,
        y: -cosAlpha * sHat.y - sinAlpha * n.y,
        z: -cosAlpha * sHat.z - sinAlpha * n.z
      });
    } else if (existingDirs.length === 3) {
      // 3个已有邻居：1个剩余方向 = -(d1 + d2 + d3)
      const sum = existingDirs.reduce((acc, d) => ({
        x: acc.x + d.x, y: acc.y + d.y, z: acc.z + d.z
      }), { x: 0, y: 0, z: 0 });
      const len = Math.sqrt(sum.x * sum.x + sum.y * sum.y + sum.z * sum.z) || 1;
      directions.push({ x: -sum.x / len, y: -sum.y / len, z: -sum.z / len });
    }

    return directions;
  }

  // BFS 主循环
  while (queue.length > 0) {
    const currentIdx = queue.shift()!;
    const currentAtom = parsedAtoms[currentIdx];
    const currentPos = atomPositions.get(currentAtom.id);
    if (!currentPos) continue;
    
    // 找出所有未构建的邻居
    const neighbors = adjacencyList[currentIdx];
    const existingNeighborPositions: { x: number, y: number, z: number }[] = [];
    const existingNeighborIds: string[] = [];
    const unbuiltNeighbors: { idx: number, order: number }[] = [];
    
    for (const { neighborIdx, order } of neighbors) {
      const neighborPos = atomPositions.get(parsedAtoms[neighborIdx].id);
      const neighborSymbol = parsedAtoms[neighborIdx].symbol;
      const isBuilt = builtAtoms.has(neighborIdx);
      
      if (neighborPos) {
        existingNeighborPositions.push(neighborPos);
        existingNeighborIds.push(parsedAtoms[neighborIdx].id);
      } else if (!isBuilt) {
        unbuiltNeighbors.push({ idx: neighborIdx, order });
      }
      
      if (!neighborPos && !isBuilt) {
        console.log(`[BFS] Atom ${currentIdx}(${currentAtom.symbol}) found unbuilt neighbor ${neighborIdx}(${neighborSymbol})`);
      }
    }
    
    // 为未构建的邻居生成位置
    if (unbuiltNeighbors.length > 0) {
      // 使用当前原子的杂化类型计算方向
      // 注意：对于链延伸，键角由新原子（neighbor）的杂化类型决定
      // 但方向是从当前原子指向新原子，所以使用当前原子的杂化类型
      // 当当前原子是sp2（环碳）而新原子是sp3（链碳）时，
      // 方向计算基于当前原子的sp2杂化（120°），但新原子需要sp3的109.5°
      // 因此，对于链延伸场景，使用新原子的杂化类型更合适
      // 当当前原子是sp2（环碳）而新原子是sp3（链碳）时，
      // 方向应该基于新原子的sp3杂化（109.5°）来计算
      const currentHyb = hybridizationMap.get(currentAtom.id) || 'sp3';
      const hyb = currentHyb;
      const availableDirs = getAvailableDirections(currentPos, existingNeighborPositions, hyb);
      const excludeIds = [currentAtom.id, ...existingNeighborIds];
      
      // 详细日志（12,13,14原子）
      if ([12,13,14].includes(currentIdx)) {
        console.log(`[DEBUG BFS ${currentIdx}] 处理原子 ${parsedAtoms[currentIdx].symbol}, hyb=${hyb}`);
        console.log(`  现有邻居 (count=${existingNeighborPositions.length}):`, existingNeighborIds.map((id, j) => {
          const idx = atomIdToIdx.get(id);
          const sym = idx != null ? parsedAtoms[idx].symbol : '?';
          const pos = existingNeighborPositions[j];
          return `${idx}(${sym}) at (${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)})`;
        }).join(', '));
        console.log(`  可用方向 (count=${availableDirs.length}):`, availableDirs.map((d, i) => 
          `[${i}]:(${d.x.toFixed(3)},${d.y.toFixed(3)},${d.z.toFixed(3)})`
        ).join(', '));
      }

      // 分离重原子和氢原子，优先处理重原子
      const heavyNeighbors = unbuiltNeighbors.filter(n => parsedAtoms[n.idx].symbol !== 'H');
      const hydrogenNeighbors = unbuiltNeighbors.filter(n => parsedAtoms[n.idx].symbol === 'H');
      const orderedNeighbors = [...heavyNeighbors, ...hydrogenNeighbors];

      // sp3原子有多个未构建邻居时：一次性计算所有方向，为每个邻居分配不同方向
      // 避免chooseBestDirection把所有邻居放到同一方向导致方向退化
      let assignedDirs: ({ x: number; y: number; z: number } | null)[] = [];
      if (hyb === 'sp3' && orderedNeighbors.length > 1) {
        // 基于已有邻居计算所有可用方向（不包含本轮要放置的邻居）
        const allDirs = getAvailableDirections(currentPos, existingNeighborPositions, hyb);
        const allExcludeIds = [currentAtom.id, ...existingNeighborIds];
        const usedDirIndices = new Set<number>();

        // 为每个邻居贪心分配最佳方向（每个方向只分配一次）
        for (let ni = 0; ni < orderedNeighbors.length; ni++) {
          const neighbor = orderedNeighbors[ni];
          const neighborAtom = parsedAtoms[neighbor.idx];
          const bondLength = getBondLength(currentAtom.symbol, neighborAtom.symbol, neighbor.order);

          let bestIdx = 0;
          let bestScore = -Infinity;

          for (let di = 0; di < allDirs.length; di++) {
            if (usedDirIndices.has(di)) continue;
            const d = allDirs[di];
            const newPos = {
              x: currentPos.x + d.x * bondLength,
              y: currentPos.y + d.y * bondLength,
              z: (currentPos.z || 0) + d.z * bondLength
            };
            let minDist = Infinity;
            atomPositions.forEach((pos, id) => {
              if (allExcludeIds.includes(id)) return;
              const dx = newPos.x - pos.x;
              const dy = newPos.y - pos.y;
              const dz = (newPos.z || 0) - (pos.z || 0);
              const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
              if (dist < minDist) minDist = dist;
            });
            if (minDist > bestScore) {
              bestScore = minDist;
              bestIdx = di;
            }
          }

          usedDirIndices.add(bestIdx);
          assignedDirs.push(allDirs[bestIdx]);
        }
      } else {
        // 非sp3或只有1个邻居：标记为null，使用原有逻辑
        assignedDirs = orderedNeighbors.map(() => null);
      }

      for (let i = 0; i < orderedNeighbors.length; i++) {
        const neighbor = orderedNeighbors[i];
        const neighborAtom = parsedAtoms[neighbor.idx];
        
        // 跳过延迟碎片原子，不在BFS中放置
        if (deferredFragmentAtoms.has(neighbor.idx)) {
          console.log(`[BFS] Skipping deferred fragment atom ${neighbor.idx}(${neighborAtom.symbol})`);
          continue;
        }
        
        const bondLength = getBondLength(currentAtom.symbol, neighborAtom.symbol, neighbor.order);

        // 确定方向
        let dir: { x: number; y: number; z: number };

        if (assignedDirs[i] !== null) {
          // sp3多邻居：直接使用预分配的方向向量
          dir = assignedDirs[i]!;
        } else {
          // 单邻居或非sp3：使用原有逻辑
          const updatedNeighborPositions = [...existingNeighborPositions];
          const updatedNeighborIds = [...existingNeighborIds];
          for (let j = 0; j < i; j++) {
            const prevNeighbor = orderedNeighbors[j];
            const prevPos = atomPositions.get(parsedAtoms[prevNeighbor.idx].id);
            if (prevPos) {
              updatedNeighborPositions.push(prevPos);
              updatedNeighborIds.push(parsedAtoms[prevNeighbor.idx].id);
            }
          }

          const dirsForPlacement = getAvailableDirections(currentPos, updatedNeighborPositions, hyb);
          const updatedExcludeIds = [currentAtom.id, ...updatedNeighborIds];
          const neighborHyb = hybridizationMap.get(neighborAtom.id) || 'sp3';

          let dirIndex: number;
          if (dirsForPlacement.length > 1) {
            if (hyb === 'sp3' && existingNeighborPositions.length === 1 && neighborHyb === 'sp3' && unbuiltNeighbors.length === 1) {
              dirIndex = (currentIdx + 1) % 2;
              if (dirIndex >= dirsForPlacement.length) dirIndex = 0;
            } else {
              dirIndex = chooseBestDirection(currentPos, dirsForPlacement, bondLength, updatedExcludeIds);
            }
          } else {
            dirIndex = 0;
          }

          dir = dirsForPlacement[dirIndex] || { x: 1, y: 0, z: 0 };

          // 更新excludeIds用于avoidAtomOverlap
          var _updatedExcludeIds = [currentAtom.id, ...updatedNeighborIds];
          var _ringAtomExclude = ringAtomIndices;
        }

        // 丁烷调试日志 - 覆盖原子0-4的链
        if (currentAtom.symbol === 'C' && neighborAtom.symbol === 'C' && currentIdx <= 4 && neighbor.idx <= 4) {
          console.log(`[丁烷调试] 当前原子 ${currentIdx}(${currentAtom.symbol}) -> 邻居 ${neighbor.idx}(${neighborAtom.symbol})`);
          console.log(`  当前位置: (${currentPos.x.toFixed(3)}, ${currentPos.y.toFixed(3)}, ${currentPos.z.toFixed(3)})`);
          console.log(`  选择的方向: (${dir.x.toFixed(3)}, ${dir.y.toFixed(3)}, ${dir.z.toFixed(3)})`);
          console.log(`  预分配方向: ${assignedDirs[i] !== null ? '是' : '否'}`);
        }

        const newPos = {
          x: currentPos.x + dir.x * bondLength,
          y: currentPos.y + dir.y * bondLength,
          z: (currentPos.z || 0) + dir.z * bondLength
        };

        // 使用预分配方向时，跳过avoidAtomOverlap，因为它会破坏四面体键角
        // 冲突由全局resolveConflictByRotation处理
        let finalPos: { x: number; y: number; z: number };
        if (assignedDirs[i] !== null) {
          // 预分配方向：直接使用计算位置，保持四面体几何
          finalPos = newPos;
        } else if (ringAtomIndices.has(currentIdx)) {
          const excludeIdsForOverlap = [currentAtom.id, ...existingNeighborIds];
          for (const ringAtomIdx of ringAtomIndices) {
            excludeIdsForOverlap.push(parsedAtoms[ringAtomIdx].id);
          }
          finalPos = avoidAtomOverlap(newPos, neighborAtom.symbol, atomPositions, bondLength, excludeIdsForOverlap);
        } else {
          finalPos = avoidAtomOverlap(newPos, neighborAtom.symbol, atomPositions, bondLength, [currentAtom.id, ...existingNeighborIds]);
        }

        atomPositions.set(neighborAtom.id, finalPos);
        builtAtoms.add(neighbor.idx);
        queue.push(neighbor.idx);
        console.log(`[BFS] Placed atom ${neighbor.idx}(${neighborAtom.symbol}) at (${finalPos.x.toFixed(3)}, ${finalPos.y.toFixed(3)}, ${finalPos.z?.toFixed(3) || 0}), hyb=${hyb}, current=${currentIdx}(${currentAtom.symbol})`);
      }
    }
  }

  // 处理孤立原子
  for (let i = 0; i < parsedAtoms.length; i++) {
    if (!builtAtoms.has(i)) {
      atomPositions.set(parsedAtoms[i].id, {
        x: i * 3,
        y: 0,
        z: 0
      });
    }
  }

  // ============ 延迟碎片放置 ============
  // BFS链构建后，碎片原子没有被BFS放置，现在用连接原子确定碎片位置
  if (fragmentMatchByRing.size > 0) {
    console.log('[generate3DCoordinates] === Deferred Fragment Placement ===');
    const placedFragments = new Set<FusedRingFragment>();
    
    for (const [ringIdx, { fragment, atomMap }] of fragmentMatchByRing) {
      if (ringBuilt.has(ringIdx)) continue;
      if (placedFragments.has(fragment)) continue;
      
      // 找连接原子：碎片外的已构建原子，通过键连接到碎片原子
      // 这些连接原子确定了碎片在分子中的位置和方向
      interface Connection { outsideIdx: number; outsidePos: { x: number; y: number; z: number }; fragMolIdx: number; fragIdx: number; }
      const connections: Connection[] = [];
      
      for (const [molIdx, fragIdx] of atomMap) {
        const bondedAtoms = getBondedAtoms(molIdx, parsedBonds);
        for (const bIdx of bondedAtoms) {
          if (!atomMap.has(bIdx) && atomPositions.has(parsedAtoms[bIdx].id)) {
            // bIdx 是碎片外的已构建原子，molIdx 是碎片原子
            connections.push({
              outsideIdx: bIdx,
              outsidePos: atomPositions.get(parsedAtoms[bIdx].id)!,
              fragMolIdx: molIdx,
              fragIdx: fragIdx
            });
          }
        }
        if (connections.length >= 2) break;
      }
      
      if (connections.length >= 2) {
        // 两个连接原子：可以确定旋转+平移
        const conn1 = connections[0];
        const conn2 = connections[1];
        const fragAtom1 = fragment.atoms.find(a => a.idx === conn1.fragIdx)!;
        const fragAtom2 = fragment.atoms.find(a => a.idx === conn2.fragIdx)!;
        
        // 碎片中两个连接点的方向
        const fragDx = fragAtom2.x - fragAtom1.x;
        const fragDy = fragAtom2.y - fragAtom1.y;
        const fragAngle = Math.atan2(fragDy, fragDx);
        
        // 分子中两个连接点的方向
        const molDx = conn2.outsidePos.x - conn1.outsidePos.x;
        const molDy = conn2.outsidePos.y - conn1.outsidePos.y;
        const molAngle = Math.atan2(molDy, molDx);
        
        const rotation = molAngle - fragAngle;
        
        // 计算平移：使fragAtom1对齐到conn1.outsidePos
        // 但注意：fragAtom1是碎片原子，不是连接原子。连接原子在碎片外面。
        // 我们需要让碎片原子fragAtom1在正确的键长距离和方向上相对于conn1.outsidePos
        // 简化处理：用fragAtom1的位置作为参考点，计算变换后对齐
        const r1x = fragAtom1.x * Math.cos(rotation) - fragAtom1.y * Math.sin(rotation);
        const r1y = fragAtom1.x * Math.sin(rotation) + fragAtom1.y * Math.cos(rotation);
        
        // conn1.outsidePos 到 fragAtom1 的方向应该是键的方向
        // 在碎片坐标系中，conn1不在碎片内，我们需要用键长来确定偏移
        // 简化：直接用两个连接原子的中点作为参考
        // 更好的方法：用conn1的位置加上键方向来确定fragAtom1的位置
        
        // 实际上，我们应该这样计算：
        // 变换后，fragAtom1 应该在 conn1.outsidePos 的键方向上
        // 变换后，fragAtom2 应该在 conn2.outsidePos 的键方向上
        // 但我们不知道键方向，只知道连接原子的位置
        
        // 用两个连接点确定变换：让碎片中fragAtom1-fragAtom2的方向
        // 与分子中conn1-conn2的方向一致
        // 然后平移使fragAtom1对齐到正确的位置
        
        // fragAtom1 应该在 conn1 的键方向上，距离为键长
        // 但我们不知道确切方向，所以用另一种方法：
        // 让碎片中fragAtom1到fragAtom2的向量与分子中对应向量对齐
        // 然后通过fragAtom1应该在conn1附近的约束来确定平移
        
        // 简化：假设fragAtom1的位置就是从conn1出发沿键方向偏移一个键长的位置
        // 键方向由conn1到conn2的方向近似
        const bondLen1 = getBondLength(parsedAtoms[conn1.outsideIdx].symbol, parsedAtoms[conn1.fragMolIdx].symbol, 1);
        const connDir = { x: molDx, y: molDy };
        const connLen = Math.sqrt(connDir.x ** 2 + connDir.y ** 2) || 1;
        // fragAtom1 在 conn1 沿 conn1→conn2 方向偏移 bondLen1 处
        // 但这不准确，因为fragAtom1不一定在conn1→conn2方向上
        
        // 更好的方法：直接用两个约束点计算
        // 变换后fragAtom1的位置 = conn1.outsidePos + bondLen1 * (从conn1指向fragAtom1的方向)
        // 但方向未知...
        
        // 最简单的方法：让fragAtom1和fragAtom2分别对齐到它们"应该"在的位置
        // fragAtom1应该在conn1附近（距离约bondLen1）
        // fragAtom2应该在conn2附近（距离约bondLen2）
        // 用这两个约束计算变换
        
        // 实际上，最直接的方法：
        // 1. 旋转使fragAtom1→fragAtom2方向与mol中对应方向一致
        // 2. 平移使fragAtom1在conn1的正确位置
        
        // fragAtom1的正确位置：从conn1出发，沿某个方向偏移bondLen1
        // 这个方向需要从碎片几何中推断
        // 在碎片坐标系中，conn1不在碎片内，但fragAtom1是碎片原子
        // 从conn1到fragAtom1的方向 = 从conn1.outsidePos到变换后fragAtom1位置的方向
        
        // 用两个连接点的中点方法：
        // 变换后fragAtom1和fragAtom2的中点应该与conn1和conn2的中点附近
        // 然后用键长约束微调
        
        // 最实用的方法：直接用旋转+平移使两个碎片原子对齐到"理想位置"
        // 理想位置：从连接原子出发，沿连接方向偏移键长
        
        const bondLen2 = getBondLength(parsedAtoms[conn2.outsideIdx].symbol, parsedAtoms[conn2.fragMolIdx].symbol, 1);
        
        // 理想位置：fragAtom1 在 conn1 沿某个方向偏移 bondLen1 处
        // 方向：从碎片几何推断 - 在碎片中，fragAtom1相对于整体的方向
        // 简化：用conn1→conn2方向旋转90度作为近似方向
        // 不，这太hacky了
        
        // 最终方案：用旋转对齐方向，然后用fragAtom1到conn1的距离约束确定平移
        // 变换后fragAtom1的位置 = R * fragAtom1 + T
        // 我们需要 |R * fragAtom1 + T - conn1.outsidePos| ≈ bondLen1
        // 以及 |R * fragAtom2 + T - conn2.outsidePos| ≈ bondLen2
        
        // 先旋转对齐方向
        // 然后T = conn1.outsidePos + bondLen1 * normalized(R*fragAtom1 - conn1.outsidePos) - R*fragAtom1
        // 但这还是需要知道方向...
        
        // 好吧，用最简单的方法：
        // 1. 旋转使碎片中fragAtom1→fragAtom2方向与分子中conn1→conn2方向一致
        // 2. 平移使fragAtom1对齐到"从conn1出发，沿conn1→fragAtom1方向偏移bondLen1"的位置
        //    但conn1→fragAtom1方向在变换前未知
        
        // 实际上，我可以用另一种方法：
        // 在碎片坐标系中，计算fragAtom1相对于碎片中心的方向
        // 在分子坐标系中，计算conn1相对于分子中某个参考点的方向
        // 然后对齐这两个方向
        
        // 最简单有效的方法：用两个连接点作为"虚拟锚点"
        // 假设fragAtom1的理想位置 = conn1.outsidePos（近似，忽略键长差异）
        // 假设fragAtom2的理想位置 = conn2.outsidePos（近似）
        // 这样变换就是把碎片中的fragAtom1→fragAtom2对齐到conn1→conn2
        // 然后整体偏移一个键长
        
        // 不对，这样fragAtom1会跑到conn1的位置上，而不是在键长距离处
        
        // 正确方法：
        // 1. 计算旋转使fragAtom1→fragAtom2方向与conn1→conn2方向一致
        // 2. 计算平移使fragAtom1在conn1的正确位置
        //    fragAtom1的正确位置 = conn1.outsidePos + bondLen1 * dirFromConn1ToFragAtom1
        //    dirFromConn1ToFragAtom1 = 从conn1指向fragAtom1的方向
        //    在旋转后的碎片坐标系中，这个方向 = normalized(R * fragAtom1 - conn1.outsidePos)
        //    但这需要T，形成循环...
        
        // 打破循环：先假设T=0，计算R*fragAtom1的位置，然后计算方向，然后计算T
        const r1x_noT = fragAtom1.x * Math.cos(rotation) - fragAtom1.y * Math.sin(rotation);
        const r1y_noT = fragAtom1.x * Math.sin(rotation) + fragAtom1.y * Math.cos(rotation);
        
        // 从conn1到旋转后fragAtom1的方向
        const dirX = r1x_noT - conn1.outsidePos.x;
        const dirY = r1y_noT - conn1.outsidePos.y;
        const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
        
        // fragAtom1应该在conn1沿这个方向偏移bondLen1处
        const targetFragAtom1 = {
          x: conn1.outsidePos.x + (dirX / dirLen) * bondLen1,
          y: conn1.outsidePos.y + (dirY / dirLen) * bondLen1,
          z: conn1.outsidePos.z || 0
        };
        
        // 平移量
        const tx = targetFragAtom1.x - r1x_noT;
        const ty = targetFragAtom1.y - r1y_noT;
        const tz = (conn1.outsidePos.z || 0) - (r1y_noT === r1y_noT ? 0 : 0); // z=0 for now
        
        console.log(`  [DeferredPlacement] Placing "${fragment.name}" with 2 connections, rotation=${(rotation * 180 / Math.PI).toFixed(1)}°`);
        
        for (const [molIdx, fragIdx] of atomMap) {
          const fragAtom = fragment.atoms.find(a => a.idx === fragIdx);
          if (!fragAtom) continue;
          
          const rx = fragAtom.x * Math.cos(rotation) - fragAtom.y * Math.sin(rotation);
          const ry = fragAtom.x * Math.sin(rotation) + fragAtom.y * Math.cos(rotation);
          
          atomPositions.set(parsedAtoms[molIdx].id, {
            x: parseFloat((rx + tx).toFixed(6)),
            y: parseFloat((ry + ty).toFixed(6)),
            z: tz,
          });
          builtAtoms.add(molIdx);
        }
        
        for (const [ri, md] of fragmentMatchByRing) {
          if (md.fragment === fragment) ringBuilt.add(ri);
        }
        placedFragments.add(fragment);
        
      } else if (connections.length === 1) {
        // 只有一个连接原子，用连接方向确定旋转
        const conn = connections[0];
        const fragAtom = fragment.atoms.find(a => a.idx === conn.fragIdx)!;
        const bondLen = getBondLength(parsedAtoms[conn.outsideIdx].symbol, parsedAtoms[conn.fragMolIdx].symbol, 1);
        
        // 从连接原子到碎片原子的方向
        // 在分子中：从conn.outsidePos出发，沿某个方向偏移bondLen
        // 方向：使用连接原子的杂化和已有邻居来确定
        const connHyb = hybridizationMap.get(parsedAtoms[conn.outsideIdx].id) || 'sp3';
        const connNeighbors = getBondedAtoms(conn.outsideIdx, parsedBonds);
        const connExistingPositions: { x: number; y: number; z: number }[] = [];
        for (const nIdx of connNeighbors) {
          if (nIdx !== conn.fragMolIdx) {
            const pos = atomPositions.get(parsedAtoms[nIdx].id);
            if (pos) connExistingPositions.push(pos);
          }
        }
        
        const availableDirs = getAvailableDirections(conn.outsidePos, connExistingPositions, connHyb as 'sp' | 'sp2' | 'sp3');
        const bestDirIdx = chooseBestDirection(conn.outsidePos, availableDirs, bondLen, [parsedAtoms[conn.outsideIdx].id]);
        const molDir = availableDirs[bestDirIdx] || { x: 1, y: 0, z: 0 };
        
        // 碎片中：从fragAtom指向碎片中心的方向
        let fragCx = 0, fragCy = 0;
        for (const a of fragment.atoms) { fragCx += a.x; fragCy += a.y; }
        fragCx /= fragment.atoms.length;
        fragCy /= fragment.atoms.length;
        
        const fragDir = { x: fragCx - fragAtom.x, y: fragCy - fragAtom.y };
        const fragDirLen = Math.sqrt(fragDir.x ** 2 + fragDir.y ** 2) || 1;
        
        // 旋转：使碎片中fragAtom→中心方向与分子中连接方向一致
        const fragAngle = Math.atan2(fragDir.y, fragDir.x);
        const molAngle = Math.atan2(molDir.y, molDir.x);
        const rotation = molAngle - fragAngle;
        
        // fragAtom的目标位置
        const targetPos = {
          x: conn.outsidePos.x + molDir.x * bondLen,
          y: conn.outsidePos.y + molDir.y * bondLen,
          z: (conn.outsidePos.z || 0) + (molDir.z || 0) * bondLen
        };
        
        // 旋转后fragAtom的位置
        const rFx = fragAtom.x * Math.cos(rotation) - fragAtom.y * Math.sin(rotation);
        const rFy = fragAtom.x * Math.sin(rotation) + fragAtom.y * Math.cos(rotation);
        
        const tx = targetPos.x - rFx;
        const ty = targetPos.y - rFy;
        
        console.log(`  [DeferredPlacement] Placing "${fragment.name}" with 1 connection, rotation=${(rotation * 180 / Math.PI).toFixed(1)}°`);
        
        for (const [molIdx, fIdx] of atomMap) {
          const fAtom = fragment.atoms.find(a => a.idx === fIdx);
          if (!fAtom) continue;
          
          const rx = fAtom.x * Math.cos(rotation) - fAtom.y * Math.sin(rotation);
          const ry = fAtom.x * Math.sin(rotation) + fAtom.y * Math.cos(rotation);
          
          atomPositions.set(parsedAtoms[molIdx].id, {
            x: parseFloat((rx + tx).toFixed(6)),
            y: parseFloat((ry + ty).toFixed(6)),
            z: targetPos.z,
          });
          builtAtoms.add(molIdx);
        }
        
        for (const [ri, md] of fragmentMatchByRing) {
          if (md.fragment === fragment) ringBuilt.add(ri);
        }
        placedFragments.add(fragment);
      } else {
        console.log(`  [DeferredPlacement] No connections found for "${fragment.name}", ring ${ringIdx}`);
      }
    }
  }

  // ============ 全局空间冲突检测与旋转矫正 ============
  // BFS逐原子放置后，检测所有非键原子间的空间冲突
  // 对每个冲突，尝试绕可旋转键旋转冲突原子所在的子结构来消除冲突
  console.log('[generate3DCoordinates] === Starting Global Conflict Resolution ===');
  resolveGlobalConflicts(parsedAtoms, parsedBonds, atomPositions, ringAtomIndices);

  // 构建结果原子
  parsedAtoms.forEach((pa, idx) => {
    const pos = atomPositions.get(pa.id);
    if (!pos) return;

    const hyb = hybridizationMap.get(pa.id) || 'sp3';
    resultAtoms.push({
      id: pa.id,
      symbol: pa.symbol,
      position: pos,
      atomicNumber: getElementFromLib(pa.symbol)?.atomicNumber || 6,
      color: getElementColor(pa.symbol),
      hybridization: hyb,
    });
  });

  // 构建结果键
  parsedBonds.forEach(b => {
    const a1 = resultAtoms.find(a => a.id === parsedAtoms[b.a1].id);
    const a2 = resultAtoms.find(a => a.id === parsedAtoms[b.a2].id);
    if (a1 && a2) {
      resultBonds.push({
        id: generateUUID(),
        atom1Id: a1.id,
        atom2Id: a2.id,
        order: b.order,
      });
    }
  });

  // 添加隐式氢原子
  const hAtomsToAdd: { 
    parentId: string; 
    parentSymbol: string;
    direction: { x: number; y: number; z: number }; 
    parentNeighborIds: string[] 
  }[] = [];

  parsedAtoms.forEach((pa, idx) => {
    const hCount = calculateImplicitHydrogens(pa, parsedAtoms, parsedBonds);
    const parentPos = atomPositions.get(pa.id);
    
    if (idx === 12 || idx === 13 || idx === 1 || idx === 2 || (pa.symbol === 'C' && !pa.aromatic && idx >= 10 && idx <= 16)) {
      const bonds = Array.from(pa.bonds.entries());
      console.log(`[非芳香C原子] idx=${idx}, symbol=${pa.symbol}, bonds=${bonds.length}, bonds详情:`, bonds.map(([id, order]) => `${id}:${order}`).join(', '));
      console.log(`  hCount=${hCount}, hasPosition=${!!parentPos}`);
      if (parentPos) {
        console.log(`  position=(${parentPos.x.toFixed(3)}, ${parentPos.y.toFixed(3)}, ${parentPos.z.toFixed(3)})`);
      }
    }
    
    if (hCount <= 0) return;
    if (!parentPos) return;

    const hyb = hybridizationMap.get(pa.id) || 'sp3';
    const existingPositions = getNeighborPositions(
      idx,
      parsedAtoms,
      atomPositions,
      atomIdToIdx
    );

    // 收集每个邻居的其他邻居位置（用于推断sp2双键平面）
    const neighborOtherPositions: { x: number; y: number; z: number }[][] = [];
    pa.bonds.forEach((order, neighborId) => {
      const nIdx = atomIdToIdx.get(neighborId);
      if (nIdx === undefined) {
        neighborOtherPositions.push([]);
        return;
      }
      const neighborAtom = parsedAtoms[nIdx];
      const otherPositions: { x: number; y: number; z: number }[] = [];
      neighborAtom.bonds.forEach((_, otherNeighborId) => {
        if (otherNeighborId === pa.id) return;
        const otherPos = atomPositions.get(otherNeighborId);
        if (otherPos) otherPositions.push(otherPos);
      });
      neighborOtherPositions.push(otherPositions);
    });

    if (idx === 12 || idx === 13 || idx === 1 || idx === 2 || (pa.symbol === 'C' && !pa.aromatic && idx >= 10 && idx <= 16)) {
      console.log(`  杂化=${hyb}, existingNeighbors=${existingPositions.positions.length}`);
      console.log(`  existingPositions.symbols:`, existingPositions.symbols);
      console.log(`  existingPositions.positions:`, existingPositions.positions.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`).join(', '));
    }

    // sp3甲基H原子：根据原子索引奇偶性交替偏移60°，实现交叉式构象
    const hAngleOffset = (hyb === 'sp3' && existingPositions.positions.length === 1) ? (idx % 2) * Math.PI / 3 : 0;
    const hDirections = calculateHydrogenDirections(parentPos, existingPositions, hyb, cosPhi, sinPhi, hAngleOffset, neighborOtherPositions);
    
    if (idx === 12 || idx === 13 || idx === 1 || idx === 2 || (pa.symbol === 'C' && !pa.aromatic && idx >= 10 && idx <= 16)) {
      console.log(`  hDirections.length=${hDirections.length}, hCount=${hCount}, 实际添加H数=${Math.min(hCount, hDirections.length)}`);
      if (idx === 12 || hCount > 0) {
        hDirections.forEach((dir, i) => {
          console.log(`    direction[${i}]=(${dir.x.toFixed(3)}, ${dir.y.toFixed(3)}, ${dir.z.toFixed(3)})`);
        });
      }
    }
    
    // 收集父原子的所有现有邻居 id
    const parentNeighborIds = getBondedAtoms(idx, parsedBonds)
      .map(n => parsedAtoms[n]?.id)
      .filter(id => id && atomPositions.has(id)) as string[];
    
    for (let i = 0; i < Math.min(hCount, hDirections.length); i++) {
      hAtomsToAdd.push({
        parentId: pa.id,
        parentSymbol: pa.symbol,
        direction: hDirections[i],
        parentNeighborIds,
      });
    }
  });

  console.log(`[H原子添加完成] 总共添加 ${hAtomsToAdd.length} 个H原子`);

  hAtomsToAdd.forEach((h) => {
    const parentPos = atomPositions.get(h.parentId);
    if (!parentPos) return;

    // 根据父原子类型使用正确的键长
    const hBondLength = getBondLength(h.parentSymbol, 'H', 1);

    const hId = generateUUID();
    let hPos = {
      x: parentPos.x + h.direction.x * hBondLength,
      y: parentPos.y + h.direction.y * hBondLength,
      z: (parentPos.z || 0) + h.direction.z * hBondLength,
    };

    // H原子位置由化学键方向精确确定，不做avoidAtomOverlap（避免破坏键角和键长）
    atomPositions.set(hId, hPos);

    resultAtoms.push({
      id: hId,
      symbol: 'H',
      position: hPos,
      atomicNumber: 1,
      color: getElementColor('H'),
      hybridization: 'sp3',
    });

    resultBonds.push({
      id: generateUUID(),
      atom1Id: h.parentId,
      atom2Id: hId,
      order: 1,
    });
  });

  // 检查并解决重叠 - 使用基于旋转的冲突矫正
  const overlapWarnings = checkForOverlaps(atomPositions);
  if (overlapWarnings.length > 0) {
    console.warn('原子空间重叠警告:', overlapWarnings);
    // 对H原子冲突，尝试绕父原子的可旋转键旋转
    resolveHAtomConflicts(resultAtoms, resultBonds, atomPositions, parsedAtoms, parsedBonds, ringAtomIndices);
  }

  // 更新原子位置（可能被 resolveOverlaps 修改了）
  for (const atom of resultAtoms) {
    const pos = atomPositions.get(atom.id);
    if (pos) {
      atom.position = pos;
    }
  }

  // 后处理：sp3连接的环组旋转（在隐式H添加后，旋转所有原子包括H）
  postProcessRotateSp3Rings(parsedAtoms, parsedBonds, atomPositions, resultAtoms, resultBonds);

  return { atoms: resultAtoms, bonds: resultBonds };
}

/**
 * 辅助函数：根据键级判断原子杂化类型（用于后处理）
 */
function getLocalHybridization(atom: ParsedAtom): 'sp' | 'sp2' | 'sp3' {
  if (atom.symbol === 'H') return 'sp3';
  if (atom.aromatic) return 'sp2';
  const maxBondOrder = Array.from(atom.bonds.values()).reduce((max, o) => Math.max(max, o), 1);
  if (maxBondOrder >= 3) return 'sp';
  if (maxBondOrder >= 2) return 'sp2';
  return 'sp3';
}

/**
 * 后处理：找到连接两个环的sp3原子，将下游环组整体旋转，使sp3键角偏离平面
 * 在所有原子（包括隐式H）放置完成后调用，作为刚体旋转不破坏内部几何
 */
function postProcessRotateSp3Rings(
  parsedAtoms: ParsedAtom[],
  parsedBonds: { a1: number; a2: number; order: number }[],
  atomPositions: Map<string, { x: number; y: number; z: number }>,
  resultAtoms: { id: string; position: { x: number; y: number; z: number }; symbol: string }[],
  resultBonds: { id: string; atom1Id: string | null; atom2Id: string | null; order: number }[]
) {
  // 1. 检测所有环
  const rings: number[][] = [];
  const ringVisited = new Set<number>();
  for (let i = 0; i < parsedAtoms.length; i++) {
    if (ringVisited.has(i)) continue;
    const ring = findRingDFS(i, -1, [], ringVisited, parsedAtoms as any, parsedBonds);
    if (ring.length >= 3) {
      rings.push(ring);
    }
  }
  if (rings.length < 2) return;

  // 辅助：判断原子是否在环中
  const atomToRing = new Map<number, number>();
  rings.forEach((ring, ri) => {
    ring.forEach(atomIdx => atomToRing.set(atomIdx, ri));
  });

  // 2. 找到连接两个不同环的sp3桥原子
  interface Sp3Bridge {
    sp3AtomIdx: number;
    upstreamAtomIdx: number;   // sp3原子在上游环侧的邻居
    downstreamAtomIdx: number; // sp3原子在下游环侧的邻居
    upstreamRingIdx: number;
    downstreamRingIdx: number;
  }
  const bridges: Sp3Bridge[] = [];

  for (let atomIdx = 0; atomIdx < parsedAtoms.length; atomIdx++) {
    // 跳过环内原子
    if (atomToRing.has(atomIdx)) continue;

    const atomHyb = getLocalHybridization(parsedAtoms[atomIdx]);
    if (atomHyb !== 'sp3') continue;

    // 找到这个sp3原子连接的环邻居
    const neighbors = getBondedAtoms(atomIdx, parsedBonds);
    const ringNeighbors: { ringIdx: number; atomInRing: number }[] = [];
    for (const nIdx of neighbors) {
      const ringIdx = atomToRing.get(nIdx);
      if (ringIdx !== undefined) {
        ringNeighbors.push({ ringIdx, atomInRing: nIdx });
      }
    }

    // 如果sp3原子连接了两个不同的环
    const uniqueRingIndices = new Set(ringNeighbors.map(rn => rn.ringIdx));
    if (uniqueRingIndices.size >= 2) {
      const rn0 = ringNeighbors[0];
      const rn1 = ringNeighbors[1];
      bridges.push({
        sp3AtomIdx: atomIdx,
        upstreamAtomIdx: rn0.atomInRing,
        downstreamAtomIdx: rn1.atomInRing,
        upstreamRingIdx: rn0.ringIdx,
        downstreamRingIdx: rn1.ringIdx,
      });
    }
  }

  if (bridges.length === 0) return;

  // 3. 对每个sp3桥，识别下游环组（通过非sp3连接到达的所有环）
  for (const bridge of bridges) {
    const sp3Pos = atomPositions.get(parsedAtoms[bridge.sp3AtomIdx].id);
    const upstreamPos = atomPositions.get(parsedAtoms[bridge.upstreamAtomIdx].id);
    if (!sp3Pos || !upstreamPos) continue;

    // BFS从downstreamAtomIdx出发，不穿过sp3桥原子，收集所有可达的环
    const downstreamRings = new Set<number>();
    const bfsVisited = new Set<number>([bridge.sp3AtomIdx]);
    const bfsQueue: number[] = [bridge.downstreamAtomIdx];

    while (bfsQueue.length > 0) {
      const curIdx = bfsQueue.shift()!;
      if (bfsVisited.has(curIdx)) continue;
      bfsVisited.add(curIdx);

      const ringIdx = atomToRing.get(curIdx);
      if (ringIdx !== undefined) {
        downstreamRings.add(ringIdx);
      }

      const neighbors = getBondedAtoms(curIdx, parsedBonds);
      for (const nIdx of neighbors) {
        if (bfsVisited.has(nIdx)) continue;
        // 不穿过其他sp3桥原子（连接两个不同环的sp3原子）
        if (!atomToRing.has(nIdx)) {
          const nHyb = getLocalHybridization(parsedAtoms[nIdx]);
          const nRingNeighbors = getBondedAtoms(nIdx, parsedBonds).filter(nn => atomToRing.has(nn));
          const nUniqueRings = new Set(nRingNeighbors.map(nn => atomToRing.get(nn)!));
          if (nHyb === 'sp3' && nUniqueRings.size >= 2 && ![...nUniqueRings].every(r => downstreamRings.has(r))) {
            continue; // 不穿过其他sp3桥
          }
        }
        bfsQueue.push(nIdx);
      }
    }

    // 收集下游环组中所有原子的ID
    const downstreamAtomIds = new Set<string>();
    // 先加环内原子
    for (const ringIdx of downstreamRings) {
      for (const atomIdx of rings[ringIdx]) {
        downstreamAtomIds.add(parsedAtoms[atomIdx].id);
      }
    }
    // 再从环原子BFS扩展，收集取代基和H原子，不穿过sp3桥
    const expandVisited = new Set<number>([bridge.sp3AtomIdx]);
    const expandQueue: number[] = [];
    for (const ringIdx of downstreamRings) {
      for (const atomIdx of rings[ringIdx]) {
        expandQueue.push(atomIdx);
      }
    }
    while (expandQueue.length > 0) {
      const curIdx = expandQueue.shift()!;
      if (expandVisited.has(curIdx)) continue;
      expandVisited.add(curIdx);
      downstreamAtomIds.add(parsedAtoms[curIdx].id);

      const neighbors = getBondedAtoms(curIdx, parsedBonds);
      for (const nIdx of neighbors) {
        if (expandVisited.has(nIdx)) continue;
        // 不穿过其他sp3桥原子
        if (!atomToRing.has(nIdx)) {
          const nHyb = getLocalHybridization(parsedAtoms[nIdx]);
          const nRingNeighbors = getBondedAtoms(nIdx, parsedBonds).filter(nn => atomToRing.has(nn));
          const nUniqueRings = new Set(nRingNeighbors.map(nn => atomToRing.get(nn)!));
          if (nHyb === 'sp3' && nUniqueRings.size >= 2) {
            const allInDownstream = [...nUniqueRings].every(r => downstreamRings.has(r));
            if (!allInDownstream) continue;
          }
        }
        expandQueue.push(nIdx);
      }
    }

    if (downstreamAtomIds.size === 0) continue;

    // 从resultAtoms中收集与下游环原子键合的H原子
    for (const atom of resultAtoms) {
      if (atom.symbol === 'H') {
        // 找到H原子的父原子（通过bonds查找）
        const bond = resultBonds.find(b => b.atom2Id === atom.id);
        if (bond && bond.atom1Id !== null && downstreamAtomIds.has(bond.atom1Id)) {
          downstreamAtomIds.add(atom.id);
        }
      }
    }

    // 4. 绕sp3-upstream键旋转下游环组
    const bondDir = {
      x: sp3Pos.x - upstreamPos.x,
      y: sp3Pos.y - upstreamPos.y,
      z: (sp3Pos.z || 0) - (upstreamPos.z || 0)
    };
    const bondLen = Math.sqrt(bondDir.x * bondDir.x + bondDir.y * bondDir.y + bondDir.z * bondDir.z);
    if (bondLen < 0.001) continue;
    const bondUnit = {
      x: bondDir.x / bondLen,
      y: bondDir.y / bondLen,
      z: bondDir.z / bondLen
    };

    // 检查sp3原子到下游环连接原子的方向，如果已经接近四面体角则跳过旋转
    const downstreamPos = atomPositions.get(parsedAtoms[bridge.downstreamAtomIdx].id);
    if (downstreamPos) {
      const dDir = {
        x: downstreamPos.x - sp3Pos.x,
        y: downstreamPos.y - sp3Pos.y,
        z: (downstreamPos.z || 0) - (sp3Pos.z || 0)
      };
      const dLen = Math.sqrt(dDir.x * dDir.x + dDir.y * dDir.y + dDir.z * dDir.z) || 1;
      const dUnit = { x: dDir.x / dLen, y: dDir.y / dLen, z: dDir.z / dLen };
      const dot = dUnit.x * bondUnit.x + dUnit.y * bondUnit.y + dUnit.z * bondUnit.z;
      const currentAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
      const targetAngle = Math.acos(1 / 3); // 70.5°
      // 如果当前角度与目标角度偏差小于5度，跳过旋转
      if (Math.abs(currentAngle - targetAngle) < 0.087) { // 5度 ≈ 0.087弧度
        console.log(`[sp3旋转跳过] 桥原子${bridge.sp3AtomIdx}, 当前角度${(currentAngle * 180 / Math.PI).toFixed(1)}°已接近目标${(targetAngle * 180 / Math.PI).toFixed(1)}°`);
        continue;
      }
    }

    const rotateAngle = Math.acos(1 / 3); // 70.5°
    const cosA = Math.cos(rotateAngle);
    const sinA = Math.sin(rotateAngle);

    // 以sp3原子为旋转中心，旋转下游所有原子
    for (const atomId of downstreamAtomIds) {
      const pos = atomPositions.get(atomId);
      if (!pos) continue;

      const relPos = {
        x: pos.x - sp3Pos.x,
        y: pos.y - sp3Pos.y,
        z: (pos.z || 0) - (sp3Pos.z || 0)
      };

      const dot = relPos.x * bondUnit.x + relPos.y * bondUnit.y + relPos.z * bondUnit.z;
      const cross = {
        x: bondUnit.y * relPos.z - bondUnit.z * relPos.y,
        y: bondUnit.z * relPos.x - bondUnit.x * relPos.z,
        z: bondUnit.x * relPos.y - bondUnit.y * relPos.x
      };

      const newPos = {
        x: relPos.x * cosA + cross.x * sinA + bondUnit.x * dot * (1 - cosA) + sp3Pos.x,
        y: relPos.y * cosA + cross.y * sinA + bondUnit.y * dot * (1 - cosA) + sp3Pos.y,
        z: relPos.z * cosA + cross.z * sinA + bondUnit.z * dot * (1 - cosA) + (sp3Pos.z || 0)
      };

      atomPositions.set(atomId, newPos);
    }

    // 同步更新resultAtoms中的位置
    for (const atom of resultAtoms) {
      if (downstreamAtomIds.has(atom.id)) {
        const pos = atomPositions.get(atom.id);
        if (pos) atom.position = pos;
      }
    }

    console.log(`[sp3旋转] 桥原子${bridge.sp3AtomIdx}(${parsedAtoms[bridge.sp3AtomIdx].symbol}), 下游环: [${Array.from(downstreamRings).join(',')}], 旋转${downstreamAtomIds.size}个原子`);
  }
}

function findRingDFS(
  curr: number,
  parent: number,
  path: number[],
  visited: Set<number>,
  atoms: Atom[],
  bonds: { a1: number; a2: number; order: number }[]
): number[] {
  if (visited.has(curr)) {
    // 检查是否有环
    const idx = path.indexOf(curr);
    if (idx !== -1 && path.length - idx >= 3) {
      return path.slice(idx);
    }
    return [];
  }
  visited.add(curr);
  path.push(curr);
  const neighbors = getBondedAtoms(curr, bonds);
  for (const next of neighbors) {
    if (next === parent) continue;
    const ring = findRingDFS(next, curr, path, new Set(visited), atoms, bonds);
    if (ring.length >= 3) return ring;
  }
  path.pop();
  return [];
}

function calculateAttachmentDirection(
  fromPos: { x: number; y: number; z: number },
  existingPositions: { x: number; y: number; z: number }[],
  hyb: 'sp' | 'sp2' | 'sp3'
): { x: number; y: number; z: number } {
  const phi = Math.acos(-1 / 3);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  if (existingPositions.length === 0) {
    return { x: 1, y: 0, z: 0 };
  } else if (existingPositions.length === 1) {
    const existingDir = {
      x: fromPos.x - existingPositions[0].x,
      y: fromPos.y - existingPositions[0].y,
      z: fromPos.z - existingPositions[0].z
    };
    const len = Math.sqrt(existingDir.x * existingDir.x + existingDir.y * existingDir.y + existingDir.z * existingDir.z) || 1;
    const axisDir = { x: existingDir.x / len, y: existingDir.y / len, z: existingDir.z / len };

    let perp1 = { x: -axisDir.y, y: axisDir.x, z: 0 };
    let perp1Len = Math.sqrt(perp1.x * perp1.x + perp1.y * perp1.y);
    if (perp1Len < 0.001) {
      perp1 = { x: 1, y: 0, z: 0 };
      perp1Len = 1;
    }
    perp1.x /= perp1Len; perp1.y /= perp1Len;

    if (hyb === 'sp2') {
      return normalize({
        x: -axisDir.x + perp1.x,
        y: -axisDir.y + perp1.y,
        z: -axisDir.z + perp1.z
      });
    } else {
      return normalize({
        x: cosPhi * axisDir.x + sinPhi * perp1.x,
        y: cosPhi * axisDir.y + sinPhi * perp1.y,
        z: cosPhi * axisDir.z
      });
    }
  } else {
    const dirs = existingPositions.map(p => ({
      x: p.x - fromPos.x,
      y: p.y - fromPos.y,
      z: p.z - fromPos.z
    }));
    const normDirs = dirs.map(d => normalize(d));
    const sum = normDirs.reduce((acc, d) => ({
      x: acc.x + d.x,
      y: acc.y + d.y,
      z: acc.z + d.z
    }), { x: 0, y: 0, z: 0 });
    return normalize({ x: -sum.x, y: -sum.y, z: -sum.z });
  }
}

function normalize(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function calculateHydrogenDirections(
  parentPos: { x: number; y: number; z: number },
  existingPositions: { positions: { x: number; y: number; z: number }[]; symbols: string[]; orders: number[] },
  hyb: 'sp' | 'sp2' | 'sp3',
  cosPhi: number,
  sinPhi: number,
  angleOffset: number = 0,
  neighborOtherPositions: ({ x: number; y: number; z: number }[])[] = []
): { x: number; y: number; z: number }[] {
  const directions: { x: number; y: number; z: number }[] = [];
  const existingCount = existingPositions.positions.length;
  const cos109 = -1 / 3;
  const sin109 = Math.sqrt(8) / 3;
  const cos120 = -0.5;
  const sin120 = Math.sqrt(3) / 2;

  if (hyb === 'sp') {
    if (existingCount === 0) {
      directions.push({ x: 1, y: 0, z: 0 });
      directions.push({ x: -1, y: 0, z: 0 });
    } else if (existingCount === 1) {
      // sp有1个邻居时（三键一端），C-H键与三键共线（180°反方向）
      const e1 = existingPositions.positions[0];
      const dx = parentPos.x - e1.x;
      const dy = parentPos.y - e1.y;
      const dz = (parentPos.z || 0) - (e1.z || 0);
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      // H方向 = 从邻居指向当前原子的反方向（与三键共线）
      directions.push({ x: dx / len, y: dy / len, z: dz / len });
    }
    // sp有2个邻居时（如三键中间的C），没有H原子
  } else if (hyb === 'sp2') {
    if (existingCount === 0) {
      directions.push({ x: 1, y: 0, z: 0 });
      directions.push({ x: -0.5, y: Math.sqrt(3) / 2, z: 0 });
      directions.push({ x: -0.5, y: -Math.sqrt(3) / 2, z: 0 });
    } else if (existingCount === 1) {
      // sp2有1个邻居时，需要2个H方向，使用3D位置
      const e1 = existingPositions.positions[0];
      const dx = e1.x - parentPos.x;
      const dy = e1.y - parentPos.y;
      const dz = e1.z - parentPos.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      // axisDir: 从当前原子指向现有邻居的方向
      const axisDir = { x: dx / len, y: dy / len, z: dz / len };

      // 关键修复：用邻居的其他邻居推断双键平面法向量，确保相邻sp2碳平面共面
      // 平面法向量 n = (邻居→当前原子) × (邻居→其他邻居)
      // perp1 = n × axisDir（平面内与axisDir正交的方向）
      const otherNeighborPositions = neighborOtherPositions[0] || [];
      let perp1: { x: number; y: number; z: number } | null = null;

      for (const otherPos of otherNeighborPositions) {
        const d1x = parentPos.x - e1.x;
        const d1y = parentPos.y - e1.y;
        const d1z = (parentPos.z || 0) - (e1.z || 0);
        const d2x = otherPos.x - e1.x;
        const d2y = otherPos.y - e1.y;
        const d2z = (otherPos.z || 0) - (e1.z || 0);
        // n = d1 × d2 即 (邻居→当前原子) × (邻居→其他邻居) —— 平面法向量
        const nx = d1y * d2z - d1z * d2y;
        const ny = d1z * d2x - d1x * d2z;
        const nz = d1x * d2y - d1y * d2x;
        const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nLen > 0.01) {
          const nNorm = { x: nx / nLen, y: ny / nLen, z: nz / nLen };
          // perp1 = n × axisDir —— 平面内与axisDir正交的方向
          const px = nNorm.y * axisDir.z - nNorm.z * axisDir.y;
          const py = nNorm.z * axisDir.x - nNorm.x * axisDir.z;
          const pz = nNorm.x * axisDir.y - nNorm.y * axisDir.x;
          perp1 = { x: px, y: py, z: pz };
          break;
        }
      }

      // 如果没有邻居上下文可参考，用多候选向量测试（回退到原逻辑）
      if (!perp1) {
        const candidates = [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 0, y: 0, z: 1 }
        ];
        for (const cand of candidates) {
          const cross = {
            x: axisDir.y * cand.z - axisDir.z * cand.y,
            y: axisDir.z * cand.x - axisDir.x * cand.z,
            z: axisDir.x * cand.y - axisDir.y * cand.x
          };
          const crossLen = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
          if (crossLen > 0.1) {
            perp1 = cross;
            break;
          }
        }
        if (perp1) {
          const perp1Len = Math.sqrt(perp1.x * perp1.x + perp1.y * perp1.y + perp1.z * perp1.z) || 1;
          perp1 = { x: perp1.x / perp1Len, y: perp1.y / perp1Len, z: perp1.z / perp1Len };
        } else {
          // 最终回退
          perp1 = { x: 0, y: 0, z: 1 };
        }
      }

      // H原子应与C-C键方向（axisDir）形成120°角（sp2平面三角形）
      directions.push({
        x: cos120 * axisDir.x + sin120 * perp1.x,
        y: cos120 * axisDir.y + sin120 * perp1.y,
        z: cos120 * axisDir.z + sin120 * perp1.z,
      });
      directions.push({
        x: cos120 * axisDir.x - sin120 * perp1.x,
        y: cos120 * axisDir.y - sin120 * perp1.y,
        z: cos120 * axisDir.z - sin120 * perp1.z,
      });
    } else if (existingCount === 2) {
      // sp2有2个邻居时，只需要1个H方向
      // backDir（两个C-C键方向之和的反方向）就是正确的H方向
      // 它与每个C-C键都形成120°角
      const e1 = existingPositions.positions[0];
      const e2 = existingPositions.positions[1];
      const d1 = { x: e1.x - parentPos.x, y: e1.y - parentPos.y, z: e1.z - parentPos.z };
      const d2 = { x: e2.x - parentPos.x, y: e2.y - parentPos.y, z: e2.z - parentPos.z };
      
      // 归一化
      const len1 = Math.sqrt(d1.x * d1.x + d1.y * d1.y + d1.z * d1.z) || 1;
      const len2 = Math.sqrt(d2.x * d2.x + d2.y * d2.y + d2.z * d2.z) || 1;
      const nd1 = { x: d1.x / len1, y: d1.y / len1, z: d1.z / len1 };
      const nd2 = { x: d2.x / len2, y: d2.y / len2, z: d2.z / len2 };
      
      // H方向 = -(d1+d2)归一化，与两个C-C键各成120°
      const sum = { x: nd1.x + nd2.x, y: nd1.y + nd2.y, z: nd1.z + nd2.z };
      const sumLen = Math.sqrt(sum.x * sum.x + sum.y * sum.y + sum.z * sum.z) || 1;
      directions.push({ x: -sum.x / sumLen, y: -sum.y / sumLen, z: -sum.z / sumLen });
    }
  } else {
    if (existingCount === 0) {
      const t = 1 / Math.sqrt(3);
      directions.push({ x: t, y: t, z: t });
      directions.push({ x: t, y: -t, z: -t });
      directions.push({ x: -t, y: t, z: -t });
      directions.push({ x: -t, y: -t, z: t });
    } else if (existingCount === 1) {
      // sp3有1个邻居时，需要3个H方向，使用3D位置
      const e1 = existingPositions.positions[0];
      const dx = parentPos.x - e1.x;
      const dy = parentPos.y - e1.y;
      const dz = parentPos.z - e1.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      // u: 从现有邻居指向当前原子的方向
      const u = { x: dx / len, y: dy / len, z: dz / len };

      // 找到垂直于u的两个正交方向
      // 测试多个候选辅助向量，选择与u叉乘不为零的那个
      const candidates = [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 }
      ];
      
      let p1 = { x: 0, y: 0, z: 0 };
      for (const cand of candidates) {
        const cross = {
          x: u.y * cand.z - u.z * cand.y,
          y: u.z * cand.x - u.x * cand.z,
          z: u.x * cand.y - u.y * cand.x
        };
        const crossLen = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
        if (crossLen > 0.1) {
          p1 = cross;
          break;
        }
      }
      
      const p1Len = Math.sqrt(p1.x * p1.x + p1.y * p1.y + p1.z * p1.z) || 1;
      const p1n = { x: p1.x / p1Len, y: p1.y / p1Len, z: p1.z / p1Len };
      // p2 = u × p1n
      const p2 = {
        x: u.y * p1n.z - u.z * p1n.y,
        y: u.z * p1n.x - u.x * p1n.z,
        z: u.x * p1n.y - u.y * p1n.x
      };
      const p2Len = Math.sqrt(p2.x * p2.x + p2.y * p2.y + p2.z * p2.z) || 1;
      const p2n = { x: p2.x / p2Len, y: p2.y / p2Len, z: p2.z / p2Len };

      for (let i = 0; i < 3; i++) {
        const angle = i * 2 * Math.PI / 3 + angleOffset;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        directions.push({
          x: -cos109 * u.x + sin109 * (c * p1n.x + s * p2n.x),
          y: -cos109 * u.y + sin109 * (c * p1n.y + s * p2n.y),
          z: -cos109 * u.z + sin109 * (c * p1n.z + s * p2n.z)
        });
      }
    } else if (existingCount === 2) {
      // sp3有2个邻居时，使用四面体零和性质：d1+d2+h1+h2=0
      // h1 = -(d1+d2)/2 + sqrt(2/3)*n, h2 = -(d1+d2)/2 - sqrt(2/3)*n
      const e1 = existingPositions.positions[0];
      const e2 = existingPositions.positions[1];
      const d1 = normalize({ x: e1.x - parentPos.x, y: e1.y - parentPos.y, z: e1.z - parentPos.z });
      const d2 = normalize({ x: e2.x - parentPos.x, y: e2.y - parentPos.y, z: e2.z - parentPos.z });

      const halfSum = { x: -(d1.x + d2.x) / 2, y: -(d1.y + d2.y) / 2, z: -(d1.z + d2.z) / 2 };
      const normal = { x: d1.y * d2.z - d1.z * d2.y, y: d1.z * d2.x - d1.x * d2.z, z: d1.x * d2.y - d1.y * d2.x };
      const nLen = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z) || 1;
      const n = { x: normal.x / nLen, y: normal.y / nLen, z: normal.z / nLen };
      const t = Math.sqrt(2 / 3);

      directions.push({
        x: halfSum.x + t * n.x,
        y: halfSum.y + t * n.y,
        z: halfSum.z + t * n.z
      });
      directions.push({
        x: halfSum.x - t * n.x,
        y: halfSum.y - t * n.y,
        z: halfSum.z - t * n.z
      });
    } else if (existingCount === 3) {
      // sp3有3个邻居时，H方向为-(d1+d2+d3)归一化
      const e1 = existingPositions.positions[0];
      const e2 = existingPositions.positions[1];
      const e3 = existingPositions.positions[2];
      const d1 = { x: e1.x - parentPos.x, y: e1.y - parentPos.y, z: e1.z - parentPos.z };
      const d2 = { x: e2.x - parentPos.x, y: e2.y - parentPos.y, z: e2.z - parentPos.z };
      const d3 = { x: e3.x - parentPos.x, y: e3.y - parentPos.y, z: e3.z - parentPos.z };
      const sum = { x: d1.x + d2.x + d3.x, y: d1.y + d2.y + d3.y, z: d1.z + d2.z + d3.z };
      const sumLen = Math.sqrt(sum.x * sum.x + sum.y * sum.y + sum.z * sum.z) || 1;
      directions.push({ x: -sum.x / sumLen, y: -sum.y / sumLen, z: -sum.z / sumLen });
    }
  }

  return directions.map(d => {
    const len = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z) || 1;
    return { x: d.x / len, y: d.y / len, z: d.z / len };
  });
}

function calculateFormula(atoms: Atom[]): string {
  const counts: Record<string, number> = {};
  atoms.forEach(a => {
    counts[a.symbol] = (counts[a.symbol] || 0) + 1;
  });
  const order = ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'Na'];
  return order
    .filter(s => counts[s])
    .map(s => counts[s] > 1 ? `${s}${counts[s]}` : s)
    .join('');
}

function calculateMolecularWeight(atoms: Atom[]): number {
  const weights: Record<string, number> = {
    'H': 1.008, 'C': 12.011, 'N': 14.007, 'O': 15.999, 'F': 18.998,
    'Cl': 35.453, 'Br': 79.904, 'I': 126.904, 'S': 32.065, 'P': 30.974,
    'Na': 22.990,
  };
  return atoms.reduce((sum, a) => sum + (weights[a.symbol] || 0), 0);
}

function calculateUnsaturation(atoms: Atom[], bonds: Bond[]): number {
  const counts: Record<string, number> = {};
  atoms.forEach(a => {
    counts[a.symbol] = (counts[a.symbol] || 0) + 1;
  });
  const c = counts['C'] || 0;
  const h = counts['H'] || 0;
  const n = counts['N'] || 0;
  const halogens = (counts['F'] || 0) + (counts['Cl'] || 0) + (counts['Br'] || 0) + (counts['I'] || 0);
  return (2 * c + 2 + n - h - halogens) / 2;
}

export function parseSmilesToMolecule(smiles: string): Molecule | null {
  try {
    console.log('[parseSmilesToMolecule] Input:', smiles);
    const { atoms: parsedAtoms, bonds: parsedBonds } = parseSmiles(smiles);
    console.log('[parseSmilesToMolecule] Parsed atoms:', parsedAtoms.length, 'bonds:', parsedBonds.length);
    if (parsedAtoms.length === 0) {
      console.error('[parseSmilesToMolecule] No atoms parsed');
      return null;
    }
    
    // 打印解析的原子信息
    console.log('[parseSmilesToMolecule] Parsed atoms details:');
    parsedAtoms.forEach((a, i) => {
      console.log(`  ${i}: ${a.symbol} (charge: ${a.charge || 0})`);
    });

    const { atoms, bonds } = generate3DCoordinates(parsedAtoms, parsedBonds);
    console.log('[parseSmilesToMolecule] Generated coords - atoms:', atoms.length, 'bonds:', bonds.length);

    const molecule: Molecule = {
      atoms,
      bonds,
      name: smiles,
      smiles,
      formula: calculateFormula(atoms),
      molecularWeight: Math.round(calculateMolecularWeight(atoms) * 100) / 100,
      unsaturation: calculateUnsaturation(atoms, bonds),
    };

    const validation = validateMoleculeConstraints(molecule);
    if (!validation.isValid) {
      console.warn('分子约束验证失败:', validation.violations);
    }

    const conformation = calculateMolecularConformation(molecule);
    console.info('分子构象分析:', {
      '可旋转键数': conformation.rotatableBonds,
      '刚性基团数': conformation.rigidGroups,
      '平面性得分': (conformation.planarityScore * 100).toFixed(1) + '%',
      '应变能': conformation.strainEnergy.toFixed(2)
    });

    return molecule;
  } catch (e) {
    console.error('[parseSmilesToMolecule] Error:', e);
    console.error('[parseSmilesToMolecule] Stack:', (e as Error).stack);
    console.error(`解析SMILES失败: ${(e as Error).message}`);
    return null;
  }
}
