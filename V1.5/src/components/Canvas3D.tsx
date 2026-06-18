import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useMolecule } from '../context/MoleculeContext';
import { useDrag } from '../context/DragContext';
import type { Atom } from '../types';
import { 
  findRigidGroup,
  getCovalentRadius,
  getUsedValence,
  getAvailableValence,
  hasFreeValence,
  getAvailableBondDirections,
  getSnappedPosition,
  findNearbyAtomWithFreeValence,
  findNearbyBondEndpoint,
  optimizeGeometryAroundAtom,
  adjustAtomPreserveSubtree,
  validateMolecule
} from '../utils/chemistry';
import { Gyroscope } from './Gyroscope';

const CARBON_BASE_RADIUS = 0.6;
const CARBON_RADIUS = CARBON_BASE_RADIUS * (2 / 3);
const CARBON_DIAMETER = CARBON_RADIUS * 2;
const BOND_LENGTH = CARBON_DIAMETER * 1.5;
const BOND_RADIUS = CARBON_RADIUS / 6;

const RELATIVE_RADII: { [key: string]: number } = {
  'H': 1.0,
  'C': 1.35,
  'N': 1.30,
  'O': 1.25,
  'F': 1.10,
  'S': 1.50,
  'Cl': 1.75,
  'Br': 1.95,
  'I': 2.20,
};

const ELEMENT_RADII: { [key: string]: number } = {
  'C': CARBON_RADIUS,
  'H': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['H'],
  'O': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['O'],
  'N': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['N'],
  'F': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['F'],
  'Cl': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['Cl'],
  'Br': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['Br'],
  'I': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['I'],
  'S': CARBON_RADIUS / RELATIVE_RADII['C'] * RELATIVE_RADII['S'],
  'P': CARBON_RADIUS * 1.05,
};

type RotationDirection = 'up' | 'down' | 'left' | 'right' | 'up-left' | 'up-right' | 'down-left' | 'down-right' | null;

export function Canvas3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number>();
  const tempBondRef = useRef<THREE.Line | null>(null);
  // 分子中心缓存：只在分子结构变化时更新，拖拽期间保持不变
  const moleculeCenterRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const [message, setMessage] = useState<string>('');
  
  

  // 显示消息并自动清除
  const showMessage = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }, []);

  // 判断三个或更多点是否共线
  const areColinear = (points: THREE.Vector3[]): boolean => {
    if (points.length < 2) return true;
    
    const v1 = new THREE.Vector3().subVectors(points[1], points[0]);
    for (let i = 2; i < points.length; i++) {
      const v2 = new THREE.Vector3().subVectors(points[i], points[0]);
      const cross = new THREE.Vector3().crossVectors(v1, v2);
      if (cross.lengthSq() > 0.0001) {
        return false;
      }
    }
    return true;
  };

  // 判断三个或更多点是否共面
  const areCoplanar = (points: THREE.Vector3[]): boolean => {
    if (points.length < 3) return true;
    
    const v1 = new THREE.Vector3().subVectors(points[1], points[0]);
    const v2 = new THREE.Vector3().subVectors(points[2], points[0]);
    
    for (let i = 3; i < points.length; i++) {
      const v3 = new THREE.Vector3().subVectors(points[i], points[0]);
      const cross = new THREE.Vector3().crossVectors(v1, v2);
      const dot = cross.dot(v3);
      if (Math.abs(dot) > 0.0001) {
        return false;
      }
    }
    return true;
  };

  // 计算分子的边界盒，用于确定左侧位置
  const getMoleculeBounds = (): { minX: number, maxX: number } => {
    let minX = Infinity;
    let maxX = -Infinity;
    
    state.molecule.atoms.forEach(atom => {
      if (atom.position.x < minX) minX = atom.position.x;
      if (atom.position.x > maxX) maxX = atom.position.x;
    });
    
    return { minX, maxX };
  };

  // 计算分子的3D边界盒
  const getMoleculeBounds3D = (): { minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number } => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    state.molecule.atoms.forEach(atom => {
      if (atom.position.x < minX) minX = atom.position.x;
      if (atom.position.x > maxX) maxX = atom.position.x;
      if (atom.position.y < minY) minY = atom.position.y;
      if (atom.position.y > maxY) maxY = atom.position.y;
      if (atom.position.z < minZ) minZ = atom.position.z;
      if (atom.position.z > maxZ) maxZ = atom.position.z;
    });
    
    return { minX, maxX, minY, maxY, minZ, maxZ };
  };

  const {
    state,
    selectAtom,
    selectBond,
    updateSelectedAtoms,
    updateAtomPosition,
    updateBondPosition,
    bindAtomToBondEndpoint,
    removeBond,
    removeAtom,
    addAtom,
    addBond,
    addAtomsWithBond,
    setInsertAtom,
    setInsertBond,
    insertFunctionalGroup,
    setInsertFunctionalGroup
  } = useMolecule();

  const {
    draggedAtom,
    draggedBondOrder,
    bondStartAtom,
    tempBondEnd,
    setBondStartAtom,
    setTempBondEnd,
    clearDrag
  } = useDrag();

  const [showLabels, setShowLabels] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [hoveredObject, setHoveredObject] = useState<{ type: 'atom' | 'bond'; id: string } | null>(null);

  const [showReferencePlane, setShowReferencePlane] = useState(false);
  const [showGyroscopeRotation, setShowGyroscopeRotation] = useState(false);
  const [gyroscopeResetKey, setGyroscopeResetKey] = useState(0);
  const [gyroSelectedAtomId, setGyroSelectedAtomId] = useState<string | null>(null);
  const { 
    state: { cameraSpherical, zoomLevel }, 
    setCameraSpherical 
  } = useMolecule();
  const cameraSphericalRef = useRef(cameraSpherical);
  const zoomLevelRef = useRef(zoomLevel);
  const activeDirectionRef = useRef<RotationDirection>(null);
  const referenceLineRef = useRef<THREE.Mesh | null>(null);
  const referencePlaneRef = useRef<THREE.Mesh | null>(null);
  // 保存参考线/面的信息
  const referenceInfoRef = useRef<{
    line?: {
      center: THREE.Vector3;
      dir: THREE.Vector3;
      atomIds: string[];
    };
    plane?: {
      center: THREE.Vector3;
      normal: THREE.Vector3;
      atomIds: string[];
    };
    markedAtoms?: Set<string>;
  }>({});

  const interactionRef = useRef({
    isDragging: false,
    dragMode: 'rotate' as 'rotate' | 'moveAtom' | 'moveBond' | 'rotateView' | 'moveRef' | 'moveBondEndpoint',
    previousPosition: { x: 0, y: 0 },
    draggedAtomId: null as string | null,
    draggedBondId: null as string | null,
    draggedBondEndpoint: null as 'atom1' | 'atom2' | null,
    dragPlaneCenter: new THREE.Vector3(0, 0, 0),
    dragNeighborCenter: new THREE.Vector3(0, 0, 0),
    cameraSpherical: { theta: 0, phi: Math.PI / 2, radius: 20 },
    startSpherical: { theta: 0, phi: Math.PI / 2 },
    animationSpherical: { theta: 0, phi: Math.PI / 2 },
    animationStartTime: 0,
    animationDuration: 3000,
    // 约束基团相关
    constrainedAtoms: [] as string[], // 需要一起移动的原子ID
    initialPositions: {} as Record<string, { x: number; y: number; z: number }>, // 初始位置
    dragStartMousePosition: { x: 0, y: 0 }, // 鼠标拖拽起始位置
    // 单键旋转相关
    rotationFixedAtomId: null as string | null, // 固定在旋转轴上的原子ID
    rotationAxis: null as THREE.Vector3 | null, // 旋转轴向量
    rotationCenterId: null as string | null, // 真正的旋转中心原子ID
    noRotation: false as boolean, // 标记是否完全不允许旋转
    // 当前原子位置（拖拽过程中实时更新）
    currentAtomPositions: {} as Record<string, { x: number; y: number; z: number }>,
    // 上一帧鼠标位置（用于每帧增量方向判断）
    lastMousePosition: { x: 0, y: 0 },
    // 累积旋转角度（角度追踪方案）
    accumulatedAngle: 0,
    // 上一帧鼠标相对于旋转中心的角度
    lastMouseAngle: 0,
    // 参考线/面拖动相关
    draggedRefType: null as 'line' | 'plane' | null,
    draggedRef: null as any,
    initialRefPosition: { x: 0, y: 0, z: 0 },
    refNormal: new THREE.Vector3(0, 0, 1),
    // 插入原子相关
    insertAtomPending: false as boolean,
    insertAtomPosition: null as { x: number; y: number; z: number } | null,
    // 插入官能团相关
    insertFunctionalGroupPending: false as boolean,
    insertFunctionalGroupPosition: null as { x: number; y: number; z: number } | null,
    // 插入键相关
    insertBondPending: false as boolean,
    insertBondPosition: null as { x: number; y: number; z: number } | null,
    // 延迟启动键拖拽
    pendingBondDrag: false as boolean,
    // 单个原子拖拽
    isSingleAtomDrag: false,
    singleAtomOriginalPosition: { x: 0, y: 0, z: 0 },
    // 单个键拖拽
    isSingleBondDrag: false,
    bondOriginalAtom1Position: { x: 0, y: 0, z: 0 },
    bondOriginalAtom2Position: { x: 0, y: 0, z: 0 },
    // 刚性基团原始位置（键拖拽时，BFS收集的所有原子及其初始位置）
    rigidGroupOriginalPositions: {} as Record<string, { x: number; y: number; z: number }>,
    // 刚性基团中其他键的空头原始位置（键拖拽时需要一起移动）
    rigidGroupEmptyBondPositions: {} as Record<string, { bondId: string, endpoint: 'atom1' | 'atom2', originalPosition: { x: number; y: number; z: number } }>,
    // 键拖拽起始时的dragPlaneCenter（用于计算总位移）
    bondDragStartCenter: new THREE.Vector3(0, 0, 0),
    // 吸附目标原子
    snapTargetAtomId: null as string | null,
    // 吸附目标键（空头吸附）
    snapTargetBondId: null as string | null,
    snapTargetEndpoint: null as 'atom1' | 'atom2' | null,
    // 单个键拖拽时的吸附目标
    snapTarget1: null as { atomId: string, position: { x: number, y: number, z: number } } | null,
    snapTarget2: null as { atomId: string, position: { x: number, y: number, z: number } } | null,
    // === 键端小球交互 ===
    selectedBondEndpoint: null as { bondId: string, end: 'atom1' | 'atom2' } | null,
    bondEndpointOriginalPosition: { x: 0, y: 0, z: 0 },
    bondEndpointOriginalColor: 0 as number,
    bondEndpointIsDragging: false,
  });

  const moleculeRotationRef = useRef(new THREE.Quaternion()); // 空白拖拽产生的分子旋转

  // 视角四元数：视角旋转的真实来源，避免欧拉角转换导致晃动
  // 默认为 identity（不旋转），相机固定在(0,0,20)看向原点，直接看到分子+Z面（南方）
  const viewQuaternionRef = useRef(new THREE.Quaternion());

  // 从 cameraSpherical 计算 viewQuaternion（仅用于方向按钮等需要从theta/phi设置视角的场景）
  const getViewQuaternion = useCallback((theta: number, phi: number): THREE.Quaternion => {
    const quatY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), theta);
    const quatX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), phi - Math.PI / 2);
    return quatY.multiply(quatX);
  }, []);

  // 从 viewQuaternion 反算球坐标 theta/phi（用于万向仪显示）
  // 视野方向 = viewQuat.invert() * (0,0,1)
  const quaternionToSpherical = useCallback((quat: THREE.Quaternion): { theta: number, phi: number } => {
    const viewDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat.clone().invert());
    const vx = viewDir.x, vy = viewDir.y, vz = viewDir.z;
    // 视野方向即为观察者面向的方向，反算球坐标
    let phi = Math.acos(Math.max(-1, Math.min(1, vy)));
    let theta: number;
    if (Math.abs(Math.sin(phi)) < 0.001) {
      theta = 0;
    } else {
      theta = Math.atan2(vx, vz);
    }
    return { theta, phi };
  }, []);

  // 更新 group.quaternion = viewQuaternion * moleculeRotation
  const updateGroupQuaternion = useCallback(() => {
    if (!groupRef.current) return;
    groupRef.current.quaternion.copy(viewQuaternionRef.current.clone().multiply(moleculeRotationRef.current.clone()));
  }, []);

  // 同步 viewQuaternion 到 cameraSpherical（供万向仪显示）
  const syncViewToSpherical = useCallback(() => {
    const { theta, phi } = quaternionToSpherical(viewQuaternionRef.current);
    const newSpherical = { theta, phi, radius: cameraSphericalRef.current.radius };
    cameraSphericalRef.current = newSpherical;
    setCameraSpherical(newSpherical);
  }, [quaternionToSpherical]);

  // 从 viewQuaternion 判断当前视角方向
  // 相机在(0,0,-20)看向+Z(南方)，视野方向 = viewQuat.invert() * (0,0,1)
  // 原则1：+Z=南(屏幕内侧)，-Z=北(屏幕外侧)，-X=东，+X=西，+Y=上，-Y=下
  // 方向映射：z>0=南，z<0=北，x<0=东，x>0=西，y>0=上，y<0=下
  const getViewDirectionFromQuat = useCallback((quat: THREE.Quaternion): string => {
    const viewDir = new THREE.Vector3(0, 0, 1).applyQuaternion(quat.clone().invert());
    const vx = viewDir.x, vy = viewDir.y, vz = viewDir.z;
    const absX = Math.abs(vx), absY = Math.abs(vy), absZ = Math.abs(vz);
    if (absY >= absX && absY >= absZ) return vy > 0 ? 'up' : 'down';
    if (absX >= absZ) return vx < 0 ? 'east' : 'west';
    return vz > 0 ? 'south' : 'north';
  }, []);

  // 临时向量用于旋转计算
  
  const stateRef = useRef(state);
  const selectAtomRef = useRef(selectAtom);
  const selectBondRef = useRef(selectBond);
  const updateSelectedAtomsRef = useRef(updateSelectedAtoms);
  const updateAtomPositionRef = useRef(updateAtomPosition);
  const updateBondPositionRef = useRef(updateBondPosition);
  const bindAtomToBondEndpointRef = useRef(bindAtomToBondEndpoint);
  const removeBondRef = useRef(removeBond);
  const removeAtomRef = useRef(removeAtom);
  const addAtomRef = useRef(addAtom);
  const addBondRef = useRef(addBond);
  const addAtomsWithBondRef = useRef(addAtomsWithBond);
  const draggedAtomRef = useRef(draggedAtom);
  const draggedBondOrderRef = useRef(draggedBondOrder);
  const bondStartAtomRef = useRef(bondStartAtom);
  const tempBondEndRef = useRef(tempBondEnd);
  const setBondStartAtomRef = useRef(setBondStartAtom);
  const setTempBondEndRef = useRef(setTempBondEnd);
  const clearDragRef = useRef(clearDrag);
  const setInsertAtomRef = useRef(setInsertAtom);
  const setInsertBondRef = useRef(setInsertBond);
  const insertFunctionalGroupRef = useRef(insertFunctionalGroup);
  const setInsertFunctionalGroupRef = useRef(setInsertFunctionalGroup);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { selectAtomRef.current = selectAtom; }, [selectAtom]);
  useEffect(() => { selectBondRef.current = selectBond; }, [selectBond]);
  useEffect(() => { updateSelectedAtomsRef.current = updateSelectedAtoms; }, [updateSelectedAtoms]);
  useEffect(() => { updateAtomPositionRef.current = updateAtomPosition; }, [updateAtomPosition]);
  useEffect(() => { updateBondPositionRef.current = updateBondPosition; }, [updateBondPosition]);
  useEffect(() => { bindAtomToBondEndpointRef.current = bindAtomToBondEndpoint; }, [bindAtomToBondEndpoint]);
  useEffect(() => { removeBondRef.current = removeBond; }, [removeBond]);
  useEffect(() => { removeAtomRef.current = removeAtom; }, [removeAtom]);
  useEffect(() => { addAtomRef.current = addAtom; }, [addAtom]);
  useEffect(() => { addBondRef.current = addBond; }, [addBond]);
  useEffect(() => { addAtomsWithBondRef.current = addAtomsWithBond; }, [addAtomsWithBond]);
  useEffect(() => { draggedAtomRef.current = draggedAtom; }, [draggedAtom]);
  useEffect(() => { draggedBondOrderRef.current = draggedBondOrder; }, [draggedBondOrder]);
  useEffect(() => { bondStartAtomRef.current = bondStartAtom; }, [bondStartAtom]);
  useEffect(() => { tempBondEndRef.current = tempBondEnd; }, [tempBondEnd]);
  useEffect(() => { setBondStartAtomRef.current = setBondStartAtom; }, [setBondStartAtom]);
  useEffect(() => { setTempBondEndRef.current = setTempBondEnd; }, [setTempBondEnd]);
  useEffect(() => { clearDragRef.current = clearDrag; }, [clearDrag]);
  useEffect(() => { setInsertAtomRef.current = setInsertAtom; }, [setInsertAtom]);
  useEffect(() => { setInsertBondRef.current = setInsertBond; }, [setInsertBond]);
  useEffect(() => { insertFunctionalGroupRef.current = insertFunctionalGroup; }, [insertFunctionalGroup]);
  useEffect(() => { setInsertFunctionalGroupRef.current = setInsertFunctionalGroup; }, [setInsertFunctionalGroup]);
  
  // Sync cameraSpherical state with ref
  useEffect(() => {
    cameraSphericalRef.current = cameraSpherical;
  }, [cameraSpherical]);

  // Sync zoomLevel state with ref
  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const updateCameraFromSpherical = useCallback(() => {
    if (!cameraRef.current) return;
    
    // 正交相机模式：相机固定在 (0, 0, -20)，看向+Z(南方)，只旋转 group
    // cameraSpherical 仅用于万向仪显示，不移动相机
    if (cameraRef.current instanceof THREE.OrthographicCamera) {
      cameraRef.current.position.set(0, 0, -20);
      cameraRef.current.lookAt(0, 0, 0);
      return;
    }
    
    // 透视相机模式：移动相机位置
    const { theta, phi, radius } = cameraSpherical;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);
    
    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(0, 0, 0);
  }, [cameraSpherical]);

  const stopRotationAnimation = useCallback(() => {
    activeDirectionRef.current = null;
  }, []);

  // 计算避免原子重叠的安全位置
  const calculateSafeAtomPosition = useCallback((
    symbol: string,
    targetPosition: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } => {
    const allAtoms = stateRef.current.molecule.atoms;
    const newRadius = ELEMENT_RADII[symbol] || CARBON_RADIUS;
    
    // 检查是否需要调整位置
    let needAdjust = false;
    let closestAtom: typeof allAtoms[0] | null = null;
    let minDistance = Infinity;
    
    for (const otherAtom of allAtoms) {
      const otherRadius = ELEMENT_RADII[otherAtom.symbol] || CARBON_RADIUS;
      const minDist = newRadius + otherRadius;
      
      const dx = targetPosition.x - otherAtom.position.x;
      const dy = targetPosition.y - otherAtom.position.y;
      const dz = targetPosition.z - otherAtom.position.z;
      const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (currentDist < minDist * 1.1 && currentDist < minDistance) {
        needAdjust = true;
        minDistance = currentDist;
        closestAtom = otherAtom;
      }
    }
    
    if (!needAdjust) {
      return targetPosition;
    }
    
    // 需要调整，尝试在最近原子周围找安全位置
    // 以最近原子为中心，在垂直于视图的平面上尝试位置
    if (closestAtom && cameraRef.current) {
      // 获取相机到世界原点的方向向量
      const cameraDir = cameraRef.current.getWorldDirection(new THREE.Vector3()).normalize();
      
      // 创建垂直于相机方向的平面
      const up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(cameraDir.dot(up)) > 0.9) {
        up.set(1, 0, 0);
      }
      
      const right = new THREE.Vector3().crossVectors(up, cameraDir).normalize();
      const planeUp = new THREE.Vector3().crossVectors(cameraDir, right).normalize();
      
      const centerPos = new THREE.Vector3(
        closestAtom.position.x,
        closestAtom.position.y,
        closestAtom.position.z
      );
      
      const otherRadius = ELEMENT_RADII[closestAtom.symbol] || CARBON_RADIUS;
      const safeDistance = (newRadius + otherRadius) * 1.2;
      
      // 尝试多个角度找空位置
      const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4];
      for (const angle of angles) {
        const offset = new THREE.Vector3(
          Math.cos(angle) * right.x + Math.sin(angle) * planeUp.x,
          Math.cos(angle) * right.y + Math.sin(angle) * planeUp.y,
          Math.cos(angle) * right.z + Math.sin(angle) * planeUp.z
        ).normalize().multiplyScalar(safeDistance);
        
        const candidatePos = {
          x: centerPos.x + offset.x,
          y: centerPos.y + offset.y,
          z: centerPos.z + offset.z
        };
        
        // 检查这个位置是否与其他所有原子都不重叠
        let isSafe = true;
        for (const atom of allAtoms) {
          const aRadius = ELEMENT_RADII[atom.symbol] || CARBON_RADIUS;
          const dx = candidatePos.x - atom.position.x;
          const dy = candidatePos.y - atom.position.y;
          const dz = candidatePos.z - atom.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < (newRadius + aRadius) * 1.1) {
            isSafe = false;
            break;
          }
        }
        
        if (isSafe) {
          return candidatePos;
        }
      }
      
      // 如果都不行，就直接返回在最近原子右边的位置（沿X轴）
      return {
        x: closestAtom.position.x + safeDistance,
        y: closestAtom.position.y,
        z: closestAtom.position.z
      };
    }
    
    return targetPosition;
  }, []);
  
  // 检查单个原子是否与其他原子重叠
  const checkSingleAtomCollision = useCallback((
    atomId: string,
    position: { x: number; y: number; z: number }
  ): boolean => {
    const allAtoms = stateRef.current.molecule.atoms;
    const atom = allAtoms.find(a => a.id === atomId);
    if (!atom) return false;
    
    const thisRadius = ELEMENT_RADII[atom.symbol] || CARBON_RADIUS;
    
    // 收集不应算碰撞的原子：正在吸附的键空头所连接的原子
    const noCollisionAtomIds = new Set<string>();
    if (interactionRef.current.snapTargetBondId && interactionRef.current.snapTargetEndpoint) {
      const snapBond = stateRef.current.molecule.bonds.find(b => b.id === interactionRef.current.snapTargetBondId);
      if (snapBond) {
        const connectedId = interactionRef.current.snapTargetEndpoint === 'atom1' ? snapBond.atom2Id : snapBond.atom1Id;
        if (connectedId) noCollisionAtomIds.add(connectedId);
      }
    }
    
    for (const otherAtom of allAtoms) {
      if (otherAtom.id === atomId) continue; // 跳过自己
      if (noCollisionAtomIds.has(otherAtom.id)) continue; // 跳过正在吸附的原子
      
      const otherRadius = ELEMENT_RADII[otherAtom.symbol] || CARBON_RADIUS;
      const minDist = thisRadius + otherRadius;
      
      const dx = position.x - otherAtom.position.x;
      const dy = position.y - otherAtom.position.y;
      const dz = position.z - otherAtom.position.z;
      const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      if (currentDist < minDist * 0.9) {
        return true; // 有碰撞
      }
    }
    return false; // 无碰撞
  }, []);
  
  // 检查单个键的两个原子是否与其他原子重叠
  const checkSingleBondCollision = useCallback((
    bondId: string,
    atom1Pos: { x: number; y: number; z: number },
    atom2Pos: { x: number; y: number; z: number }
  ): boolean => {
    const bond = stateRef.current.molecule.bonds.find(b => b.id === bondId);
    if (!bond) return false;
    
    const atom1 = stateRef.current.molecule.atoms.find(a => a.id === bond.atom1Id);
    const atom2 = stateRef.current.molecule.atoms.find(a => a.id === bond.atom2Id);
    if (!atom1 || !atom2) return false;
    
    // 检查这两个原子是否与其他所有原子重叠
    const radius1 = ELEMENT_RADII[atom1.symbol] || CARBON_RADIUS;
    const radius2 = ELEMENT_RADII[atom2.symbol] || CARBON_RADIUS;
    
    for (const otherAtom of stateRef.current.molecule.atoms) {
      if (otherAtom.id === bond.atom1Id || otherAtom.id === bond.atom2Id) continue;
      
      const otherRadius = ELEMENT_RADII[otherAtom.symbol] || CARBON_RADIUS;
      
      // 检查与第一个原子
      const dx1 = atom1Pos.x - otherAtom.position.x;
      const dy1 = atom1Pos.y - otherAtom.position.y;
      const dz1 = atom1Pos.z - otherAtom.position.z;
      const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1 + dz1 * dz1);
      if (dist1 < (radius1 + otherRadius) * 0.9) {
        return true;
      }
      
      // 检查与第二个原子
      const dx2 = atom2Pos.x - otherAtom.position.x;
      const dy2 = atom2Pos.y - otherAtom.position.y;
      const dz2 = atom2Pos.z - otherAtom.position.z;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
      if (dist2 < (radius2 + otherRadius) * 0.9) {
        return true;
      }
    }
    return false;
  }, []);

  // 插入单独的空头键（不带原子）
  const insertSingleBond = useCallback((order: number, centerPos: { x: number; y: number; z: number }) => {
    const bondLength = 1.5; // 默认C-C键长
    
    // 计算当前视图平面的水平方向（在group局部坐标中）
    // 投影到Z=centerPos.z平面，确保键与原子共面
    let dirX = 1, dirY = 0;
    if (groupRef.current) {
      const groupInvQuat = groupRef.current.quaternion.clone().invert();
      const camRight = new THREE.Vector3(1, 0, 0);
      camRight.applyQuaternion(groupInvQuat);
      // 投影到XY平面（忽略Z分量），保证键两端Z坐标相同
      dirX = camRight.x;
      dirY = camRight.y;
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len > 0.001) {
        dirX /= len;
        dirY /= len;
      } else {
        // 相机右方向几乎沿Z轴时，使用Y轴方向
        dirX = 0;
        dirY = 1;
      }
    }
    
    const pos1 = { x: centerPos.x - dirX * bondLength / 2, y: centerPos.y - dirY * bondLength / 2, z: centerPos.z };
    const pos2 = { x: centerPos.x + dirX * bondLength / 2, y: centerPos.y + dirY * bondLength / 2, z: centerPos.z };
    
    addBondRef.current(null, null, order, pos1, pos2);
    return true;
  }, []);

  const createReferenceLine = useCallback(() => {
    if (!groupRef.current) return;

    // 如果已存在直线，删除它（包括附属的交点）
    if (referenceLineRef.current) {
      // 先找出所有与直线相关的子对象（交点标记）
      const toRemove: THREE.Object3D[] = [];
      groupRef.current.traverse((obj) => {
        if (obj.userData.type === 'referenceLine' || obj.userData.type === 'referenceLineIntersection') {
          toRemove.push(obj);
        }
      });
      toRemove.forEach(obj => {
        groupRef.current!.remove(obj);
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });
      referenceLineRef.current = null;
      referenceInfoRef.current.line = undefined;
      if (referenceInfoRef.current.markedAtoms) {
        referenceInfoRef.current.markedAtoms.clear();
      }
      return; // 删除后直接返回
    }

    const selectedAtoms = stateRef.current.selectedAtoms;
    let lineCenter = new THREE.Vector3(0, 0, 0);
    let lineDir = new THREE.Vector3(1, 0, 0);
    let selectedPointsForLine: THREE.Vector3[] = [];
    
    // 先计算分子的边界盒中心，因为在显示时分子会被居中
    const heavyAtoms = stateRef.current.molecule.atoms.filter(a => a.symbol !== 'H');
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    heavyAtoms.forEach(a => {
      minX = Math.min(minX, a.position.x);
      maxX = Math.max(maxX, a.position.x);
      minY = Math.min(minY, a.position.y);
      maxY = Math.max(maxY, a.position.y);
      minZ = Math.min(minZ, a.position.z);
      maxZ = Math.max(maxZ, a.position.z);
    });
    const displayCenter = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );
    
    if (selectedAtoms.length === 0) {
      // 不选择任何原子：直线经过画布中心点（0,0,0），默认沿X轴
      lineCenter = new THREE.Vector3(0, 0, 0);
      lineDir = new THREE.Vector3(1, 0, 0);
      showMessage('参考线已插入到画布中心');
    } else if (selectedAtoms.length === 1) {
      // 选择1个原子：默认沿X轴穿过此原子
      const atom = stateRef.current.molecule.atoms.find(a => a.id === selectedAtoms[0]);
      if (atom) {
        lineCenter = new THREE.Vector3(
          atom.position.x - displayCenter.x,
          atom.position.y - displayCenter.y,
          atom.position.z - displayCenter.z
        );
        lineDir = new THREE.Vector3(1, 0, 0);
        selectedPointsForLine.push(lineCenter.clone());
        showMessage('参考线已插入穿过选中原子');
      }
    } else if (selectedAtoms.length === 2) {
      // 选择2个原子：穿过这两个原子
      const points = selectedAtoms.map(atomId => {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        return atom ? new THREE.Vector3(
          atom.position.x - displayCenter.x, 
          atom.position.y - displayCenter.y, 
          atom.position.z - displayCenter.z
        ) : null;
      }).filter((p): p is THREE.Vector3 => p !== null);
      if (points.length === 2) {
        // 中心点在两点之间
        lineCenter.addVectors(points[0], points[1]).multiplyScalar(0.5);
        lineDir.subVectors(points[1], points[0]).normalize();
        selectedPointsForLine = [...points];
        showMessage('参考线已插入穿过两个选中原子');
      }
    } else {
      // 选择3个及以上原子：检查是否共线
      const points = selectedAtoms.map(atomId => {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        return atom ? new THREE.Vector3(
          atom.position.x - displayCenter.x, 
          atom.position.y - displayCenter.y, 
          atom.position.z - displayCenter.z
        ) : null;
      }).filter((p): p is THREE.Vector3 => p !== null);
      
      if (points.length >=3) {
        if (areColinear(points)) {
          // 计算所有点的中心
          const center = new THREE.Vector3();
          points.forEach(p => center.add(p));
          center.divideScalar(points.length);
          
          // 计算方向向量（使用最远的两个点）
          let maxDist = 0;
          let dir = new THREE.Vector3(1,0,0);
          for (let i =0; i<points.length; i++) {
            for (let j = i+1; j<points.length; j++) {
              const d = points[i].distanceTo(points[j]);
              if (d>maxDist) {
                maxDist = d;
                dir.subVectors(points[j], points[i]).normalize();
              }
            }
          }
          lineCenter = center;
          lineDir = dir;
          selectedPointsForLine = [...points];
          showMessage('参考线已插入穿过共线原子');
        } else {
          showMessage('所选原子不共线，无法插入直线');
          return;
        }
      }
    }
    
    // 计算直线长度：基于分子中最远两个原子的距离
    const allAtoms = stateRef.current.molecule.atoms;
    let maxDist = 0;
    for (let i = 0; i < allAtoms.length; i++) {
      for (let j = i + 1; j < allAtoms.length; j++) {
        const dx = allAtoms[i].position.x - allAtoms[j].position.x;
        const dy = allAtoms[i].position.y - allAtoms[j].position.y;
        const dz = allAtoms[i].position.z - allAtoms[j].position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > maxDist) maxDist = dist;
      }
    }
    const extent = Math.max(maxDist * 0.8, 5); // 最远原子距离的80%，至少5单位
    const p1 = new THREE.Vector3().copy(lineCenter).addScaledVector(lineDir, -extent);
    const p2 = new THREE.Vector3().copy(lineCenter).addScaledVector(lineDir, extent);
    
    // 创建更粗的直线（使用圆柱体）
    const lineColor = 0x4488ff; // 蓝色
    const lineRadius = 0.01; // 直线半径
    const linePath = new THREE.LineCurve3(p1, p2);
    const tubeGeometry = new THREE.TubeGeometry(linePath, 2, lineRadius, 8, false);
    const tubeMaterial = new THREE.MeshBasicMaterial({ color: lineColor });
    const tubeLine = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tubeLine.userData = { type: 'referenceLine' };
    groupRef.current.add(tubeLine);
    referenceLineRef.current = tubeLine as any;
    
    // 保存参考线信息，初始化 markedAtoms
    referenceInfoRef.current.line = {
      center: lineCenter.clone(),
      dir: lineDir.clone(),
      atomIds: [...selectedAtoms]
    };
    // 初始化 markedAtoms Set
    if (!referenceInfoRef.current.markedAtoms) {
      referenceInfoRef.current.markedAtoms = new Set();
    } else {
      referenceInfoRef.current.markedAtoms.clear();
    }

    // 添加原子球面与直线相交处的交点示意
    if (selectedPointsForLine.length > 0) {
      // 使用更突出的颜色：深色背景用亮黄色，浅色背景用亮紫色
      const intersectionColor = isDarkMode ? 0xffff00 : 0xff00ff;
      
      selectedPointsForLine.forEach((atomCenter, idx) => {
        const atomId = selectedAtoms[idx];
        // 将原子添加到 markedAtoms 中
        if (referenceInfoRef.current.markedAtoms) {
          referenceInfoRef.current.markedAtoms.add(atomId);
        }
        
        // 原子球体的半径
        const atomRadius = 0.3;
        
        // 计算直线与球面的两个交点
        const r = atomRadius;
        const intersection1 = atomCenter.clone().addScaledVector(lineDir, r);
        const intersection2 = atomCenter.clone().addScaledVector(lineDir, -r);
        
        // 在两个交点处绘制小球标记
        const markerRadius = 0.03;
        const markerGeometry = new THREE.SphereGeometry(markerRadius, 32, 32);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
          color: intersectionColor
        });
        
        const marker1 = new THREE.Mesh(markerGeometry, markerMaterial);
        marker1.position.copy(intersection1);
        marker1.userData = { type: 'referenceLineIntersection', atomId, pairId: 0 };
        if (groupRef.current) {
          groupRef.current.add(marker1);
        }
        
        const marker2 = new THREE.Mesh(markerGeometry.clone(), markerMaterial.clone());
        marker2.position.copy(intersection2);
        marker2.userData = { type: 'referenceLineIntersection', atomId, pairId: 1 };
        if (groupRef.current) {
          groupRef.current.add(marker2);
        }
      });
    }
  }, [areColinear, getMoleculeBounds, getMoleculeBounds3D, showMessage, isDarkMode]);

  const createReferencePlane = useCallback(() => {
    if (!groupRef.current) return;

    // 如果已存在平面，删除它（包括附属的相交圆）
    if (referencePlaneRef.current) {
      // 先找出所有与平面相关的子对象（相交圆）
      const toRemove: THREE.Object3D[] = [];
      groupRef.current.traverse((obj) => {
        if (obj.userData.type === 'referencePlane' || obj.userData.type === 'referencePlaneIntersection') {
          toRemove.push(obj);
        }
      });
      toRemove.forEach(obj => {
        groupRef.current!.remove(obj);
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });
      referencePlaneRef.current = null;
      referenceInfoRef.current.plane = undefined;
      if (referenceInfoRef.current.markedAtoms) {
        referenceInfoRef.current.markedAtoms.clear();
      }
      return; // 删除后直接返回
    }

    const selectedAtoms = stateRef.current.selectedAtoms;
    let planeCenter = new THREE.Vector3(0, 0, 0);
    let planeNormal = new THREE.Vector3(0, 0, 1); // 默认法线沿Z轴
    let selectedPointsForPlane: THREE.Vector3[] = [];
    
    // 先计算分子的边界盒中心
    const heavyAtoms = stateRef.current.molecule.atoms.filter(a => a.symbol !== 'H');
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    heavyAtoms.forEach(a => {
      minX = Math.min(minX, a.position.x);
      maxX = Math.max(maxX, a.position.x);
      minY = Math.min(minY, a.position.y);
      maxY = Math.max(maxY, a.position.y);
      minZ = Math.min(minZ, a.position.z);
      maxZ = Math.max(maxZ, a.position.z);
    });
    const displayCenter = new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );
    
    if (selectedAtoms.length === 0) {
      // 不选择任何原子：平面经过画布中心点（0,0,0）
      planeCenter = new THREE.Vector3(0, 0, 0);
      planeNormal = new THREE.Vector3(0, 0, 1);
      showMessage('参考平面已插入到画布中心');
    } else if (selectedAtoms.length === 1) {
      // 选择1个原子：平面垂直于Z轴，穿过此原子
      const atom = stateRef.current.molecule.atoms.find(a => a.id === selectedAtoms[0]);
      if (atom) {
        planeCenter = new THREE.Vector3(
          atom.position.x - displayCenter.x,
          atom.position.y - displayCenter.y,
          atom.position.z - displayCenter.z
        );
        planeNormal = new THREE.Vector3(0, 0, 1);
        selectedPointsForPlane.push(planeCenter.clone());
        showMessage('参考平面已插入穿过选中原子');
      }
    } else if (selectedAtoms.length === 2) {
      // 选择2个原子：构造平面
      const points = selectedAtoms.map(atomId => {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        return atom ? new THREE.Vector3(
          atom.position.x - displayCenter.x, 
          atom.position.y - displayCenter.y, 
          atom.position.z - displayCenter.z
        ) : null;
      }).filter((p): p is THREE.Vector3 => p !== null);
      if (points.length === 2) {
        planeCenter.addVectors(points[0], points[1]).multiplyScalar(0.5);
        // 两点方向向量作为其中一个方向，再加一个垂直方向构造平面
        const dir1 = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
        let up = new THREE.Vector3(0,1,0);
        if (Math.abs(dir1.dot(up)) > 0.9) {
          up = new THREE.Vector3(0,0,1);
        }
        const dir2 = new THREE.Vector3().crossVectors(dir1, up).normalize();
        planeNormal = new THREE.Vector3().crossVectors(dir1, dir2).normalize();
        selectedPointsForPlane = [...points];
        showMessage('参考平面已插入穿过两个选中原子');
      }
    } else if (selectedAtoms.length === 3) {
      // 选择3个原子：直接通过这三个
      const points = selectedAtoms.map(atomId => {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        return atom ? new THREE.Vector3(
          atom.position.x - displayCenter.x, 
          atom.position.y - displayCenter.y, 
          atom.position.z - displayCenter.z
        ) : null;
      }).filter((p): p is THREE.Vector3 => p !== null);
      
      if (points.length === 3) {
        // 计算中心
        planeCenter = new THREE.Vector3(0,0,0);
        points.forEach(p => planeCenter.add(p));
        planeCenter.divideScalar(3);
        
        // 计算法向量
        const v1 = new THREE.Vector3().subVectors(points[1], points[0]);
        const v2 = new THREE.Vector3().subVectors(points[2], points[0]);
        planeNormal = new THREE.Vector3().crossVectors(v1, v2).normalize();
        selectedPointsForPlane = [...points];
        showMessage('参考平面已插入穿过三个选中原子');
      }
    } else {
      // 4个及以上原子：检查是否共面
      const points = selectedAtoms.map(atomId => {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        return atom ? new THREE.Vector3(
          atom.position.x - displayCenter.x, 
          atom.position.y - displayCenter.y, 
          atom.position.z - displayCenter.z
        ) : null;
      }).filter((p): p is THREE.Vector3 => p !== null);
      
      if (points.length >= 4) {
        if (areCoplanar(points)) {
          // 计算平面中心
          planeCenter = new THREE.Vector3(0,0,0);
          points.forEach(p => planeCenter.add(p));
          planeCenter.divideScalar(points.length);
          
          // 找到三个不共线的点来计算平面
          let v1 = new THREE.Vector3().subVectors(points[1], points[0]);
          let v2 = new THREE.Vector3().subVectors(points[2], points[0]);
          
          if (v1.cross(v2).lengthSq() < 0.001) {
            for (let i = 2; i < points.length; i++) {
              v2.subVectors(points[i], points[0]);
              if (v1.cross(v2).lengthSq() > 0.001) break;
            }
          }
          
          planeNormal = new THREE.Vector3().crossVectors(v1, v2).normalize();
          selectedPointsForPlane = [...points];
          showMessage('参考平面已插入穿过共面原子');
        } else {
          showMessage('所选原子不共面，无法插入平面');
          return;
        }
      }
    }
    
    // 平面大小：基于分子中最远两个原子的距离
    const planeAtoms = stateRef.current.molecule.atoms;
    let planeMaxDist = 0;
    for (let i = 0; i < planeAtoms.length; i++) {
      for (let j = i + 1; j < planeAtoms.length; j++) {
        const dx = planeAtoms[i].position.x - planeAtoms[j].position.x;
        const dy = planeAtoms[i].position.y - planeAtoms[j].position.y;
        const dz = planeAtoms[i].position.z - planeAtoms[j].position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > planeMaxDist) planeMaxDist = dist;
      }
    }
    const planeSize = Math.max(planeMaxDist * 1.5, 5);
    
    // 构建平面几何和旋转
    // 构造正交基
    let tangent = new THREE.Vector3(1, 0, 0);
    let bitangent = new THREE.Vector3(0, 1, 0);
    if (planeNormal.lengthSq() > 0.0001) {
      if (Math.abs(planeNormal.dot(new THREE.Vector3(1,0,0))) < 0.9) {
        tangent = new THREE.Vector3().crossVectors(planeNormal, new THREE.Vector3(1,0,0)).normalize();
      } else {
        tangent = new THREE.Vector3().crossVectors(planeNormal, new THREE.Vector3(0,1,0)).normalize();
      }
      bitangent = new THREE.Vector3().crossVectors(planeNormal, tangent).normalize();
    }
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(tangent, bitangent, planeNormal);
    const planeQuaternion = new THREE.Quaternion();
    planeQuaternion.setFromRotationMatrix(rotationMatrix);
    
    // 创建平面
    const planeColor = 0x4488ff; // 蓝色
    const planeGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    const material = new THREE.MeshBasicMaterial({
      color: planeColor,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      wireframe: false
    });
    const plane = new THREE.Mesh(planeGeometry, material);
    plane.userData = { type: 'referencePlane' };
    plane.position.copy(planeCenter);
    plane.quaternion.copy(planeQuaternion);
    groupRef.current.add(plane);
    referencePlaneRef.current = plane;
    
    // 保存参考面信息，初始化 markedAtoms
    referenceInfoRef.current.plane = {
      center: planeCenter.clone(),
      normal: planeNormal.clone(),
      atomIds: [...selectedAtoms]
    };
    // 初始化 markedAtoms Set
    if (!referenceInfoRef.current.markedAtoms) {
      referenceInfoRef.current.markedAtoms = new Set();
    } else {
      referenceInfoRef.current.markedAtoms.clear();
    }
    
    // 添加原子与平面相交处的相交圆示意
    if (selectedPointsForPlane.length > 0) {
      // 使用更突出的颜色：深色背景用亮黄色，浅色背景用亮紫色
      const intersectionColor = isDarkMode ? 0xffff00 : 0xff00ff;
      selectedPointsForPlane.forEach((atomCenter, idx) => {
        const atomId = selectedAtoms[idx];
        // 将原子添加到 markedAtoms 中
        if (referenceInfoRef.current.markedAtoms) {
          referenceInfoRef.current.markedAtoms.add(atomId);
        }
        
        // 原子球体的半径
        const atomRadius = 0.3;
        
        // 平面穿过原子球心时，截面圆半径等于原子半径
        const circleRadius = atomRadius;
        
        // 绘制相交圆环
        const circleGeometry = new THREE.TorusGeometry(circleRadius, 0.02, 16, 64);
        const circleMaterial = new THREE.MeshBasicMaterial({
          color: intersectionColor,
          side: THREE.DoubleSide
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        
        // 设置位置（原子球心位置）
        circle.position.copy(atomCenter);
        // 圆朝向与平面法线一致
        circle.quaternion.copy(planeQuaternion);
        
        circle.userData = { type: 'referencePlaneIntersection', atomId };
        if (groupRef.current) {
          groupRef.current.add(circle);
        }
      });
    }
  }, [areCoplanar, getMoleculeBounds, getMoleculeBounds3D, showMessage, isDarkMode]);

  const clearReferences = useCallback(() => {
    // 清理所有相关对象，包括主参考线/平面和附属标记
    if (groupRef.current) {
      const toRemove: THREE.Object3D[] = [];
      groupRef.current.traverse((obj) => {
        if (
          obj.userData.type === 'referenceLine' || 
          obj.userData.type === 'referenceLineIntersection' || 
          obj.userData.type === 'referencePlane' || 
          obj.userData.type === 'referencePlaneIntersection'
        ) {
          toRemove.push(obj);
        }
      });
      
      toRemove.forEach(obj => {
        groupRef.current!.remove(obj);
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });
    }
    
    referenceLineRef.current = null;
    referencePlaneRef.current = null;
    referenceInfoRef.current = {};
    setShowReferencePlane(false);
  }, []);

  // 更新参考标记（用于原子拖拽时）
  const updateReferenceMarkers = useCallback((currentAtomPositions: Record<string, { x: number; y: number; z: number }>) => {
    if (!groupRef.current) return;

    // 计算分子边界盒（保留为了兼容性，虽然这里不再使用 displayCenter）
    const heavyAtoms = stateRef.current.molecule.atoms.filter(a => a.symbol !== 'H');
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    heavyAtoms.forEach(a => {
      const pos = currentAtomPositions[a.id] || a.position;
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
      minZ = Math.min(minZ, pos.z);
      maxZ = Math.max(maxZ, pos.z);
    });

    const intersectionColor = isDarkMode ? 0xffff00 : 0xff00ff;
    const atomRadius = 0.3;
    const snapThreshold = 0.1;

    // 更新直线标记
    if (referenceInfoRef.current.line) {
      const lineInfo = referenceInfoRef.current.line;
      
      // 删除现有交点标记
      const toRemoveLine: THREE.Object3D[] = [];
      groupRef.current.traverse((obj) => {
        if (obj.userData.type === 'referenceLineIntersection') {
          toRemoveLine.push(obj);
        }
      });
      toRemoveLine.forEach(obj => {
        groupRef.current!.remove(obj);
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });

      // 构建需要检查的原子集合：markedAtoms + 当前选中的原子 + 初始保存的原子
      const atomsToCheckSet = new Set<string>();
      if (referenceInfoRef.current.markedAtoms) {
        referenceInfoRef.current.markedAtoms.forEach(id => atomsToCheckSet.add(id));
      }
      stateRef.current.selectedAtoms.forEach(id => atomsToCheckSet.add(id));
      lineInfo.atomIds.forEach(id => atomsToCheckSet.add(id));
      
      const atomsToCheck = Array.from(atomsToCheckSet);
      
      atomsToCheck.forEach(atomId => {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        if (!atom) return;
        
        // 从渲染场景中直接获取原子的当前位置（吸附后位置会立即更新到这里）
        let adjustedPos: THREE.Vector3 | null = null;
        if (groupRef.current) {
          const child = groupRef.current.children.find(
            (c) => c.userData.type === 'atom' && c.userData.id === atomId
          );
          if (child) {
            adjustedPos = child.position.clone();
          }
        }
        
        // 如果场景中找不到，跳过这个原子（不显示标记）
        if (!adjustedPos) {
          return;
        }

        // 计算原子到直线的距离
        const toCenter = new THREE.Vector3().subVectors(adjustedPos, lineInfo.center);
        const distance = toCenter.cross(lineInfo.dir).length();

        // 当原子球体与直线相交或接近时显示标记
        if (distance < atomRadius + snapThreshold) {
          // 将原子添加到 markedAtoms 中（如果还没有）
          if (referenceInfoRef.current.markedAtoms) {
            referenceInfoRef.current.markedAtoms.add(atomId);
          }
          
          // 使用归一化的直线方向
          const normalizedDir = lineInfo.dir.clone().normalize();
          
          // 计算直线与原子球面的两个交点
          // 交点 = 原子中心 ± 归一化直线方向 * 原子半径
          const intersection1 = adjustedPos.clone().addScaledVector(normalizedDir, atomRadius);
          const intersection2 = adjustedPos.clone().addScaledVector(normalizedDir, -atomRadius);

          const markerRadius = 0.03;
          const markerGeometry = new THREE.SphereGeometry(markerRadius, 32, 32);
          const markerMaterial = new THREE.MeshBasicMaterial({ color: intersectionColor });

          if (groupRef.current) {
            const marker1 = new THREE.Mesh(markerGeometry, markerMaterial);
            marker1.position.copy(intersection1);
            marker1.userData = { type: 'referenceLineIntersection', atomId, pairId: 0 };
            groupRef.current.add(marker1);

            const marker2 = new THREE.Mesh(markerGeometry.clone(), markerMaterial.clone());
            marker2.position.copy(intersection2);
            marker2.userData = { type: 'referenceLineIntersection', atomId, pairId: 1 };
            groupRef.current.add(marker2);
          }
        }
      });
    }

    // 更新平面标记
    if (referenceInfoRef.current.plane) {
      const planeInfo = referenceInfoRef.current.plane;

      // 删除现有相交圆标记
      const toRemovePlane: THREE.Object3D[] = [];
      groupRef.current.traverse((obj) => {
        if (obj.userData.type === 'referencePlaneIntersection') {
          toRemovePlane.push(obj);
        }
      });
      toRemovePlane.forEach(obj => {
        groupRef.current!.remove(obj);
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach(m => m.dispose());
          else mat.dispose();
        }
      });

      // 构建需要检查的原子集合：markedAtoms + 当前选中的原子 + 初始保存的原子
      const atomsToCheckSet = new Set<string>();
      if (referenceInfoRef.current.markedAtoms) {
        referenceInfoRef.current.markedAtoms.forEach(id => atomsToCheckSet.add(id));
      }
      stateRef.current.selectedAtoms.forEach(id => atomsToCheckSet.add(id));
      planeInfo.atomIds.forEach(id => atomsToCheckSet.add(id));
      
      const atomsToCheck = Array.from(atomsToCheckSet);
      
      atomsToCheck.forEach(atomId => {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        if (!atom) return;
        
        // 从渲染场景中直接获取原子的当前位置（吸附后位置会立即更新到这里）
        let adjustedPos: THREE.Vector3 | null = null;
        if (groupRef.current) {
          const child = groupRef.current.children.find(
            (c) => c.userData.type === 'atom' && c.userData.id === atomId
          );
          if (child) {
            adjustedPos = child.position.clone();
          }
        }
        
        // 如果场景中找不到，跳过这个原子（不显示标记）
        if (!adjustedPos) {
          return;
        }

        // 计算原子到平面的距离
        const distance = Math.abs(new THREE.Vector3().subVectors(adjustedPos, planeInfo.center).dot(planeInfo.normal));

        // 如果原子球体与平面相交（distance < atomRadius + snapThreshold），显示标记
        if (distance < atomRadius + snapThreshold) {
          // 将原子添加到 markedAtoms 中（如果还没有）
          if (referenceInfoRef.current.markedAtoms) {
            referenceInfoRef.current.markedAtoms.add(atomId);
          }
          
          // 投影到平面上的位置（用于标记显示）
          const toCenter = new THREE.Vector3().subVectors(adjustedPos, planeInfo.center);
          const projectDist = toCenter.dot(planeInfo.normal);
          const projectedPos = new THREE.Vector3().subVectors(adjustedPos, planeInfo.normal.clone().multiplyScalar(projectDist));

          // 添加相交圆标记（在投影位置显示）
          const circleRadius = atomRadius;

          const circleGeometry = new THREE.TorusGeometry(circleRadius, 0.02, 16, 64);
          const circleMaterial = new THREE.MeshBasicMaterial({
            color: intersectionColor,
            side: THREE.DoubleSide
          });
          const circle = new THREE.Mesh(circleGeometry, circleMaterial);

          // 设置位置
          circle.position.copy(projectedPos);
          // 设置朝向与平面法线一致
          let tangent = new THREE.Vector3(1, 0, 0);
          let bitangent = new THREE.Vector3(0, 1, 0);
          if (Math.abs(planeInfo.normal.dot(new THREE.Vector3(1, 0, 0))) < 0.9) {
            tangent = new THREE.Vector3().crossVectors(planeInfo.normal, new THREE.Vector3(1, 0, 0)).normalize();
          } else {
            tangent = new THREE.Vector3().crossVectors(planeInfo.normal, new THREE.Vector3(0, 1, 0)).normalize();
          }
          bitangent = new THREE.Vector3().crossVectors(planeInfo.normal, tangent).normalize();
          const rotationMatrix = new THREE.Matrix4();
          rotationMatrix.makeBasis(tangent, bitangent, planeInfo.normal);
          const planeQuaternion = new THREE.Quaternion();
          planeQuaternion.setFromRotationMatrix(rotationMatrix);
          circle.quaternion.copy(planeQuaternion);

          circle.userData = { type: 'referencePlaneIntersection', atomId };
          if (groupRef.current) {
            groupRef.current.add(circle);
          }
        }
      });
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleInsertLine = () => createReferenceLine();
    const handleInsertPlane = () => createReferencePlane();
    const handleClearRefs = () => clearReferences();

    window.addEventListener('insertReferenceLine', handleInsertLine);
    window.addEventListener('insertReferencePlane', handleInsertPlane);
    window.addEventListener('clearReferences', handleClearRefs);
    window.addEventListener('clearAll', handleClearRefs);

    return () => {
      window.removeEventListener('insertReferenceLine', handleInsertLine);
      window.removeEventListener('insertReferencePlane', handleInsertPlane);
      window.removeEventListener('clearReferences', handleClearRefs);
      window.removeEventListener('clearAll', handleClearRefs);
    };
  }, [createReferenceLine, createReferencePlane, clearReferences]);

  const getRotationSpeed = useCallback((direction: RotationDirection, camera: THREE.Camera) => {
    const speed = 0.015;
    
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    
    const screenRight = new THREE.Vector3().crossVectors(cameraDir, new THREE.Vector3(0, 1, 0)).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const screenUp = new THREE.Vector3().crossVectors(screenRight, cameraDir).normalize();
    
    switch (direction) {
      case 'up':
        return { axis: screenRight.clone(), angle: speed };
      case 'down':
        return { axis: screenRight.clone().negate(), angle: speed };
      case 'left':
        return { axis: worldUp.clone().negate(), angle: speed };
      case 'right':
        return { axis: worldUp.clone(), angle: speed };
      case 'up-left':
        return { axis: screenRight.clone().normalize().add(screenUp.clone().normalize()).normalize(), angle: speed * 0.8 };
      case 'up-right':
        return { axis: screenRight.clone().normalize().add(screenUp.clone().normalize().negate()).normalize(), angle: speed * 0.8 };
      case 'down-left':
        return { axis: screenRight.clone().normalize().negate().add(screenUp.clone().normalize()).normalize(), angle: speed * 0.8 };
      case 'down-right':
        return { axis: screenRight.clone().normalize().negate().add(screenUp.clone().normalize().negate()).normalize(), angle: speed * 0.8 };
      default:
        return { axis: new THREE.Vector3(0, 1, 0), angle: 0 };
    }
  }, []);

  const createAtomGeometry = useCallback((
    atom: typeof state.molecule.atoms[0], 
    isSelected: boolean, 
    label: string | null, 
    labelColor: string | null
  ) => {
    const radius = ELEMENT_RADII[atom.symbol] || CARBON_RADIUS;
    const geometry = new THREE.SphereGeometry(radius, 64, 64);
    const color = isSelected ? 0x00ff00 : parseInt(atom.color?.replace('#', '') || '909090', 16);
    
    let material;
    if (label && labelColor) {
      // 创建带文字标签的球面纹理，正反面都显示
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // 填充整个球面背景色
      ctx.fillStyle = atom.color || '#909090';
      ctx.fillRect(0, 0, 512, 256);
      
      // 计算避开化学键的位置来放置标签
      // 在纹理的两个位置各放一个标签，确保正反都能看到
      let labelX1 = 384; // 正面标签位置
      let labelY1 = 64;
      let labelX2 = 128; // 反面标签位置（对应球面的另一侧）
      let labelY2 = 192;
      
      // 绘制文字在正反两面的合适位置
      ctx.fillStyle = labelColor;
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 在第一个位置绘制标签
      ctx.fillText(label, labelX1, labelY1);
      
      // 在第二个位置绘制标签
      ctx.save();
      ctx.fillText(label, labelX2, labelY2);
      ctx.restore();
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      
      material = new THREE.MeshPhongMaterial({
        map: texture,
        shininess: 100,
        emissive: isSelected ? 0x33ff33 : 0x000000,
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        color,
        shininess: 100,
        emissive: isSelected ? 0x33ff33 : 0x000000,
      });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(atom.position.x, atom.position.y, atom.position.z);
    mesh.userData = { type: 'atom', id: atom.id };
    return mesh;
  }, []);

  const createBondGeometry = useCallback((bond: typeof state.molecule.bonds[0], atom1: typeof state.molecule.atoms[0], atom1Id: string | null, atom2: typeof state.molecule.atoms[0], atom2Id: string | null, isSelected: boolean, radiusScale: number = 1, selectedEndpoint: 'atom1' | 'atom2' | null = null) => {
    const start = new THREE.Vector3(atom1.position.x, atom1.position.y, atom1.position.z);
    const end = new THREE.Vector3(atom2.position.x, atom2.position.y, atom2.position.z);
    const direction = end.clone().sub(start).normalize();

    // 有原子时：圆柱从原子表面开始（+radius 偏移），与端点小球之间有间隔
    // 空头时（atomId=null）：圆柱也从空头表面开始（+CARBON_RADIUS 偏移），键长相应变短
    const radius1 = atom1Id !== null ? (ELEMENT_RADII[atom1.symbol] || CARBON_RADIUS) : CARBON_RADIUS;
    const radius2 = atom2Id !== null ? (ELEMENT_RADII[atom2.symbol] || CARBON_RADIUS) : CARBON_RADIUS;

    const actualStart = start.clone().add(direction.clone().multiplyScalar(radius1));
    const actualEnd = end.clone().sub(direction.clone().multiplyScalar(radius2));

    // 计算中点
    const midpoint = actualStart.clone().add(actualEnd).multiplyScalar(0.5);
    const length = actualStart.distanceTo(actualEnd);
    const halfLength = length / 2;
    const finalRadius = BOND_RADIUS * radiusScale;

    // 键的默认颜色与键两端小球默认色一致
    const defaultColor = 0x333333;
    const parseColor = (colorStr: string | undefined): number => {
      if (!colorStr) return defaultColor;
      if (typeof colorStr === 'number') return colorStr;
      const hex = colorStr.replace('#', '');
      return parseInt(hex, 16);
    };
    const color1 = parseColor(atom1.color);
    const color2 = parseColor(atom2.color);

    const meshes: THREE.Mesh[] = [];

    // === 键体（2段圆柱体） ===
    const bodyColor = isSelected ? 0x00ff00 : null;

    const seg1Geometry = new THREE.CylinderGeometry(finalRadius, finalRadius, halfLength, 16);
    const seg1Material = new THREE.MeshPhongMaterial({
      color: bodyColor !== null ? bodyColor : color1,
      shininess: 80
    });
    const seg1 = new THREE.Mesh(seg1Geometry, seg1Material);
    const seg1Midpoint = actualStart.clone().add(midpoint).multiplyScalar(0.5);
    seg1.position.copy(seg1Midpoint);
    seg1.lookAt(midpoint);
    seg1.rotateX(Math.PI / 2);
    seg1.userData = { type: 'bondBody', id: bond.id }; // 键体
    meshes.push(seg1);

    const seg2Geometry = new THREE.CylinderGeometry(finalRadius, finalRadius, halfLength, 16);
    const seg2Material = new THREE.MeshPhongMaterial({
      color: bodyColor !== null ? bodyColor : color2,
      shininess: 80
    });
    const seg2 = new THREE.Mesh(seg2Geometry, seg2Material);
    const seg2Midpoint = midpoint.clone().add(actualEnd).multiplyScalar(0.5);
    seg2.position.copy(seg2Midpoint);
    seg2.lookAt(actualEnd);
    seg2.rotateX(Math.PI / 2);
    seg2.userData = { type: 'bondBody', id: bond.id }; // 键体
    meshes.push(seg2);

    // === 键端小球（两端各一个小球，作为独立的交互对象） ===
    // 放在原子中心/空头位置，与键体端点（原子表面）间隔 CARBON_RADIUS
    const endpointRadius = BOND_RADIUS * 1.5;

    // 原子1端的小球
    const ep1Geometry = new THREE.SphereGeometry(endpointRadius, 16, 16);
    const ep1IsSelected = selectedEndpoint === 'atom1';
    const ep1Material = new THREE.MeshPhongMaterial({
      color: ep1IsSelected ? 0x00ff00 : color1,
      shininess: 90,
    });
    const ep1 = new THREE.Mesh(ep1Geometry, ep1Material);
    ep1.position.copy(start); // 在原子中心/空头位置，与圆柱端点间隔 radius
    ep1.userData = {
      type: 'bondEndpoint',
      id: bond.id,
      end: 'atom1',
      originalX: start.x,
      originalY: start.y,
      originalZ: start.z,
    };
    meshes.push(ep1);

    // 原子2端的小球
    const ep2Geometry = new THREE.SphereGeometry(endpointRadius, 16, 16);
    const ep2IsSelected = selectedEndpoint === 'atom2';
    const ep2Material = new THREE.MeshPhongMaterial({
      color: ep2IsSelected ? 0x00ff00 : color2,
      shininess: 90,
    });
    const ep2 = new THREE.Mesh(ep2Geometry, ep2Material);
    ep2.position.copy(end); // 在原子中心/空头位置，与圆柱端点间隔 radius
    ep2.userData = {
      type: 'bondEndpoint',
      id: bond.id,
      end: 'atom2',
      originalX: end.x,
      originalY: end.y,
      originalZ: end.z,
    };
    meshes.push(ep2);

    return meshes;
  }, []);

  const updateMoleculeDisplay = useCallback(() => {
    if (!groupRef.current || !state.molecule) return;

    // 先重置group位置，避免累积偏移
    groupRef.current.position.set(0, 0, 0);

    // 使用固定的旋转中心（世界坐标原点），避免原子跳动
    const center = new THREE.Vector3(0, 0, 0);

    const childrenToRemove = groupRef.current.children.filter(
      child => child.userData.type === 'atom' ||
                child.userData.type === 'bond' ||
                child.userData.type === 'bondBody' ||
                child.userData.type === 'bondEndpoint' ||
                child.userData.type === 'tempBond'
    );
    childrenToRemove.forEach(child => {
      groupRef.current!.remove(child);
      if ((child as THREE.Mesh).geometry) {
        ((child as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
      }
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach(m => m.dispose());
        } else {
          mat.dispose();
        }
      }
      if (child instanceof THREE.Sprite && (child.material as THREE.SpriteMaterial).map) {
        ((child.material as THREE.SpriteMaterial).map as THREE.Texture).dispose();
      }
    });

    state.molecule.bonds.forEach(bond => {
      let startPos: { x: number; y: number; z: number } | null = null;
      let endPos: { x: number; y: number; z: number } | null = null;
      
      // 确定键的起点和终点
      if (bond.atom1Id !== null) {
        const atom1 = state.molecule.atoms.find(a => a.id === bond.atom1Id);
        if (atom1) startPos = atom1.position;
      } else if (bond.atom1Position) {
        startPos = bond.atom1Position;
      }

      if (bond.atom2Id !== null) {
        const atom2 = state.molecule.atoms.find(a => a.id === bond.atom2Id);
        if (atom2) endPos = atom2.position;
      } else if (bond.atom2Position) {
        endPos = bond.atom2Position;
      }

      // 如果至少有一个点，继续渲染
      if (startPos && endPos) {
        const isSelected = state.selectedBond === bond.id;

        // 将位置转换为以边界盒中心为原点的坐标
        const adjustedStart = {
          x: startPos.x - center.x,
          y: startPos.y - center.y,
          z: startPos.z - center.z
        };
        const adjustedEnd = {
          x: endPos.x - center.x,
          y: endPos.y - center.y,
          z: endPos.z - center.z
        };

        // 创建“虚拟”原子对象，用于 createBondGeometry
        const actualAtom1 = bond.atom1Id !== null ? state.molecule.atoms.find(a => a.id === bond.atom1Id) : null;
        const actualAtom2 = bond.atom2Id !== null ? state.molecule.atoms.find(a => a.id === bond.atom2Id) : null;
        
        const defaultBondColor = '#999999';
        const dummyAtom1: Atom = {
          id: bond.atom1Id || 'dummy1',
          symbol: actualAtom1?.symbol || 'C',
          position: adjustedStart,
          atomicNumber: actualAtom1?.atomicNumber || 6,
          color: actualAtom1?.color || defaultBondColor,
          radius: actualAtom1?.radius || 0.77,
        };
        const dummyAtom2: Atom = {
          id: bond.atom2Id || 'dummy2',
          symbol: actualAtom2?.symbol || 'C',
          position: adjustedEnd,
          atomicNumber: actualAtom2?.atomicNumber || 6,
          color: actualAtom2?.color || defaultBondColor,
          radius: actualAtom2?.radius || 0.77,
        };

        // === 辅助函数：只创建键体（2段圆柱），用于双键/三键的每一根偏移键 ===
        const createOffsetBondBody = (offset: number, radiusScale: number = 1): THREE.Mesh[] => {
          const start = new THREE.Vector3(adjustedStart.x, adjustedStart.y, adjustedStart.z);
          const end = new THREE.Vector3(adjustedEnd.x, adjustedEnd.y, adjustedEnd.z);

          const direction = end.clone().sub(start).normalize();
          // 使用相机视线方向计算侧向，使双键/三键始终面向相机
          let side: THREE.Vector3;
          if (cameraRef.current) {
            const viewDir = cameraRef.current.getWorldDirection(new THREE.Vector3());
            if (groupRef.current) {
              const groupInvQuat = groupRef.current.quaternion.clone().invert();
              viewDir.applyQuaternion(groupInvQuat);
            }
            side = new THREE.Vector3().crossVectors(direction, viewDir).normalize();
            if (side.length() < 0.1) {
              const up = new THREE.Vector3(0, 1, 0);
              side = new THREE.Vector3().crossVectors(direction, up).normalize();
            }
          } else {
            const up = new THREE.Vector3(0, 1, 0);
            if (Math.abs(direction.dot(up)) > 0.9) {
              up.set(1, 0, 0);
            }
            side = new THREE.Vector3().crossVectors(direction, up).normalize();
          }

          const offsetScale = 1.5;
          const off1 = {
            ...dummyAtom1,
            position: {
              x: dummyAtom1.position.x + side.x * offset * BOND_RADIUS * offsetScale,
              y: dummyAtom1.position.y + side.y * offset * BOND_RADIUS * offsetScale,
              z: dummyAtom1.position.z + side.z * offset * BOND_RADIUS * offsetScale
            }
          };
          const off2 = {
            ...dummyAtom2,
            position: {
              x: dummyAtom2.position.x + side.x * offset * BOND_RADIUS * offsetScale,
              y: dummyAtom2.position.y + side.y * offset * BOND_RADIUS * offsetScale,
              z: dummyAtom2.position.z + side.z * offset * BOND_RADIUS * offsetScale
            }
          };

          // 只返回键体部分（前2个mesh），端点小球单独创建
          const all = createBondGeometry({ ...bond, id: bond.id }, off1, bond.atom1Id, off2, bond.atom2Id, isSelected, radiusScale);
          return all.slice(0, 2); // 前2个是键体(seg1, seg2)
        };

        // === 辅助函数：只创建对应空头端的端点小球，用于双键/三键 ===
        const createEndpointMeshes = (): THREE.Mesh[] => {
          const endpointRadius = BOND_RADIUS * 1.5;
          const endpointMeshes: THREE.Mesh[] = [];
          const defaultColor = 0x333333;
          const parseColor = (colorStr: string | undefined): number => {
            if (!colorStr) return defaultColor;
            if (typeof colorStr === 'number') return colorStr;
            const hex = colorStr.replace('#', '');
            return parseInt(hex, 16);
          };
          const c1 = parseColor(dummyAtom1.color);
          const c2 = parseColor(dummyAtom2.color);

          // 只有 atom1 端为空头才创建小球，放在原子中心/空头位置
          if (bond.atom1Id === null) {
            const ep1Geom = new THREE.SphereGeometry(endpointRadius, 16, 16);
            const ep1Mat = new THREE.MeshPhongMaterial({ color: c1, shininess: 90 });
            const ep1 = new THREE.Mesh(ep1Geom, ep1Mat);
            ep1.position.set(dummyAtom1.position.x, dummyAtom1.position.y, dummyAtom1.position.z);
            ep1.userData = {
              type: 'bondEndpoint',
              id: bond.id,
              end: 'atom1',
              originalX: dummyAtom1.position.x,
              originalY: dummyAtom1.position.y,
              originalZ: dummyAtom1.position.z,
            };
            endpointMeshes.push(ep1);
          }

          // 只有 atom2 端为空头才创建小球，放在原子中心/空头位置
          if (bond.atom2Id === null) {
            const ep2Geom = new THREE.SphereGeometry(endpointRadius, 16, 16);
            const ep2Mat = new THREE.MeshPhongMaterial({ color: c2, shininess: 90 });
            const ep2 = new THREE.Mesh(ep2Geom, ep2Mat);
            ep2.position.set(dummyAtom2.position.x, dummyAtom2.position.y, dummyAtom2.position.z);
            ep2.userData = {
              type: 'bondEndpoint',
              id: bond.id,
              end: 'atom2',
              originalX: dummyAtom2.position.x,
              originalY: dummyAtom2.position.y,
              originalZ: dummyAtom2.position.z,
            };
            endpointMeshes.push(ep2);
          }

          return endpointMeshes;
        };

        if (bond.order === 1) {
          // 单键：只创建键体（2个圆柱体），端点小球仅在对应空头端添加
          const allMeshes = createBondGeometry(bond, dummyAtom1, bond.atom1Id, dummyAtom2, bond.atom2Id, isSelected);
          const bodyMeshes = allMeshes.slice(0, 2); // 前2个是键体
          bodyMeshes.forEach(mesh => groupRef.current?.add(mesh));

          // index 2: atom1端小球; index 3: atom2端小球. 只在对应端为空头时添加
          if (bond.atom1Id === null) {
            groupRef.current?.add(allMeshes[2]);
          }
          if (bond.atom2Id === null) {
            groupRef.current?.add(allMeshes[3]);
          }
        } else if (bond.order === 2) {
          // 双键：2根偏移的键体 + 1组端点小球
          const doubleBondScale = 0.75;
          const db1 = createOffsetBondBody(-0.6, doubleBondScale);
          db1.forEach(mesh => groupRef.current?.add(mesh));
          const db2 = createOffsetBondBody(0.6, doubleBondScale);
          db2.forEach(mesh => groupRef.current?.add(mesh));
          // 添加一组端点小球（在真实端点位置）
          const endpoints = createEndpointMeshes();
          endpoints.forEach(mesh => groupRef.current?.add(mesh));
        } else if (bond.order === 3) {
          // 三键：3根偏移的键体 + 1组端点小球
          const tripleBondScale = 0.75 * 0.75;
          const tb1 = createOffsetBondBody(-1.0, tripleBondScale);
          tb1.forEach(mesh => groupRef.current?.add(mesh));
          const tb2 = createOffsetBondBody(0, tripleBondScale);
          tb2.forEach(mesh => groupRef.current?.add(mesh));
          const tb3 = createOffsetBondBody(1.0, tripleBondScale);
          tb3.forEach(mesh => groupRef.current?.add(mesh));
          // 添加一组端点小球（在真实端点位置）
          const endpoints = createEndpointMeshes();
          endpoints.forEach(mesh => groupRef.current?.add(mesh));
        }
        // 注意：端点小球已在上面各 order 分支中按需创建（单键仅在有空头时添加，双/三键统一创建一组），此处不再重复创建

      } else if (startPos && bond.atom2Position) {
        // 只渲染一个端点的情况（两个都要？不，这里只有一个）
        const adjustedStart = {
          x: startPos.x - center.x,
          y: startPos.y - center.y,
          z: startPos.z - center.z
        };
        const adjustedEnd = {
          x: bond.atom2Position.x - center.x,
          y: bond.atom2Position.y - center.y,
          z: bond.atom2Position.z - center.z
        };
        const isSelected = state.selectedBond === bond.id;
        const dummyAtom1: Atom = {
          id: 'dummy1',
          symbol: 'C',
          position: adjustedStart,
          atomicNumber: 6,
          color: '#333333',
          radius: 0.77,
        };
        const dummyAtom2: Atom = {
          id: 'dummy2',
          symbol: 'C',
          position: adjustedEnd,
          atomicNumber: 6,
          color: '#333333',
          radius: 0.77,
        };
        const endBondMeshes = createBondGeometry(bond, dummyAtom1, bond.atom1Id, dummyAtom2, bond.atom2Id, isSelected);
        endBondMeshes.forEach(mesh => groupRef.current?.add(mesh));
      }
    });

    // 为每类原子编号
    const atomNumber: { [id: string]: number } = {};
    state.molecule.atoms.forEach((atom, idx) => {
      atomNumber[atom.id] = idx;
    });

    // 计算反色
    const getInverseColor = (hexColor: string): string => {
      const hex = hexColor.replace('#', '');
      const r = 255 - parseInt(hex.substr(0, 2), 16);
      const g = 255 - parseInt(hex.substr(2, 2), 16);
      const b = 255 - parseInt(hex.substr(4, 2), 16);
      return `rgb(${r}, ${g}, ${b})`;
    };

    state.molecule.atoms.forEach(atom => {
      const isSelected = state.selectedAtom === atom.id || state.selectedAtoms.includes(atom.id);
      
      let label: string | null = null;
      let labelColor: string | null = null;
      
      if (showLabels && atomNumber[atom.id] !== undefined) {
        label = `${atomNumber[atom.id]}`;
        labelColor = getInverseColor(atom.color || '#909090');
      }
      
      // 将原子位置转换为以边界盒中心为原点的坐标
      const adjustedAtom = {
        ...atom,
        position: {
          x: atom.position.x - center.x,
          y: atom.position.y - center.y,
          z: atom.position.z - center.z
        }
      };
      
      const atomMesh = createAtomGeometry(adjustedAtom, isSelected, label, labelColor);
      groupRef.current?.add(atomMesh);
    });

    if (bondStartAtomRef.current && tempBondEndRef.current) {
      const startAtom = stateRef.current.molecule.atoms.find(a => a.id === bondStartAtomRef.current);
      if (startAtom) {
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 3 });
        // 调整临时键的位置
        const adjustedStart = {
          x: startAtom.position.x - center.x,
          y: startAtom.position.y - center.y,
          z: startAtom.position.z - center.z
        };
        const adjustedEnd = {
          x: tempBondEndRef.current.x - center.x,
          y: tempBondEndRef.current.y - center.y,
          z: tempBondEndRef.current.z - center.z
        };
        const points = [
          new THREE.Vector3(adjustedStart.x, adjustedStart.y, adjustedStart.z),
          new THREE.Vector3(adjustedEnd.x, adjustedEnd.y, adjustedEnd.z)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        line.userData = { type: 'tempBond' };
        tempBondRef.current = line;
        groupRef.current?.add(line);
      }
    }
    
    // Group位置保持在 (0,0,0)，因为我们已经在原子和键的位置中减去了 center
    // 这样旋转就会绕着分子的边界盒中心进行
    groupRef.current.position.set(0, 0, 0);
  }, [state.molecule, state.selectedAtom, state.selectedBond, state.selectedAtoms, showLabels, createAtomGeometry, createBondGeometry]);

  const getMousePosition = (clientX: number, clientY: number, rect: DOMRect) => {
    return new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
  };

  const findAtomAtPosition = (mouse: THREE.Vector2): string | null => {
    if (!cameraRef.current || !groupRef.current) return null;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(groupRef.current.children, true);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (obj.userData.type === 'atom') {
        return obj.userData.id;
      }
    }
    return null;
  };

  const findBondAtPosition = (mouse: THREE.Vector2): string | null => {
    if (!cameraRef.current || !groupRef.current) return null;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(groupRef.current.children, true);

    // 遍历所有交点，找到第一个bond/bondBody类型的对象
    for (const intersect of intersects) {
      if (intersect.object.userData.type === 'bond' || intersect.object.userData.type === 'bondBody') {
        return intersect.object.userData.id;
      }
    }
    return null;
  };

  // 找到点击位置的键端小球（优先于键体）
  const findBondEndpointAtPosition = (mouse: THREE.Vector2): { bondId: string, end: 'atom1' | 'atom2' } | null => {
    if (!cameraRef.current || !groupRef.current) return null;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(groupRef.current.children, true);

    for (const intersect of intersects) {
      if (intersect.object.userData.type === 'bondEndpoint') {
        return {
          bondId: intersect.object.userData.id,
          end: intersect.object.userData.end,
        };
      }
      // 如果先碰到了atom或bondBody/bond，则说明没有点击到端点小球
      if (intersect.object.userData.type === 'atom' ||
          intersect.object.userData.type === 'bondBody' ||
          intersect.object.userData.type === 'bond') {
        return null;
      }
    }
    return null;
  };

  const findReferenceLineOrPlane = (mouse: THREE.Vector2): { type: 'line' | 'plane' | null; ref: any } => {
    if (!cameraRef.current || !groupRef.current) return { type: null, ref: null };

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    const intersects = raycaster.intersectObjects(groupRef.current.children, true);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (obj.userData.type === 'referenceLine') {
        return { type: 'line', ref: referenceLineRef.current };
      } else if (obj.userData.type === 'referencePlane') {
        return { type: 'plane', ref: referencePlaneRef.current };
      }
    }
    return { type: null, ref: null };
  };

  // 检查原子是否符合化学约束（可以被操控）
  // H原子可以旋转（绕C-H键），但碳原子不能单独移动
  // 辅助函数：判断一个原子是否参与双键
  const isPartOfDoubleBond = (atomId: string): boolean => {
    // 检查这个原子是否直接参与任何双键或三键
    return stateRef.current.molecule.bonds.some(
      b => (b.atom1Id === atomId || b.atom2Id === atomId) && b.order >= 2
    );
  };

  // 辅助函数：判断键是否可旋转
  // 可旋转条件：单键 且 不在环内
  const isBondRotatable = (bond: { atom1Id: string; atom2Id: string; order: number }): boolean => {
    // 双键、三键不可旋转
    if (bond.order > 1) return false;
    // 环内键不可旋转
    if (isBondInRing(bond)) return false;
    return true;
  };

  // 辅助函数：检查原子是否有任何可旋转键
  const hasRotatableBond = (atomId: string): boolean => {
    return stateRef.current.molecule.bonds.some(
      b => {
        if ((b.atom1Id === atomId || b.atom2Id === atomId) && b.atom1Id !== null && b.atom2Id !== null) {
          return isBondRotatable({ atom1Id: b.atom1Id, atom2Id: b.atom2Id, order: b.order });
        }
        return false;
      }
    );
  };

  // 辅助函数：检查键是否在环内
  // 如果删除该键后，两端原子仍然连通，则该键在环内
  const isBondInRing = (bond: { atom1Id: string; atom2Id: string }): boolean => {
    const atom1Id = bond.atom1Id;
    const atom2Id = bond.atom2Id;
    // BFS从atom1出发，不经过atom1-atom2这条键，看能否到达atom2
    const visited = new Set<string>();
    const queue = [atom1Id];
    visited.add(atom1Id);
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentBonds = stateRef.current.molecule.bonds.filter(
        b => b.atom1Id === currentId || b.atom2Id === currentId
      );
      for (const b of currentBonds) {
        // 跳过原始键
        if ((b.atom1Id === atom1Id && b.atom2Id === atom2Id) ||
            (b.atom1Id === atom2Id && b.atom2Id === atom1Id)) continue;
        const neighborId = b.atom1Id === currentId ? b.atom2Id : b.atom1Id;
        if (neighborId === null) continue;
        if (neighborId === atom2Id) return true; // 找到替代路径，键在环内
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
    return false;
  };
  
  // 辅助函数：查找双键相关的所有原子（包括双键碳上的H）
  const findDoubleBondGroup = (startId: string): string[] => {
    // 简化版本：直接找到双键相关的所有原子
    const group = new Set<string>();
    
    // 找到所有双键或三键
    const doubleBonds = stateRef.current.molecule.bonds.filter(b => b.order >= 2);
    
    // 找到所有双键碳原子
    const doubleBondCarbons = new Set<string>();
    doubleBonds.forEach(b => {
      if (b.atom1Id !== null) doubleBondCarbons.add(b.atom1Id);
      if (b.atom2Id !== null) doubleBondCarbons.add(b.atom2Id);
    });
    
    // 如果起始原子与双键碳相连，或者就是双键相关原子
    const startAtom = stateRef.current.molecule.atoms.find(a => a.id === startId);
    if (!startAtom) return [];
    
    let isRelated = false;
    
    // 检查起始原子是否是双键碳
    if (doubleBondCarbons.has(startId)) {
      isRelated = true;
    } 
    // 或者起始是H，连接到双键碳
    else if (startAtom.symbol === 'H') {
      const hBond = stateRef.current.molecule.bonds.find(
        b => b.atom1Id === startId || b.atom2Id === startId
      );
      if (hBond) {
        const connectedId = hBond.atom1Id === startId ? hBond.atom2Id : hBond.atom1Id;
        if (connectedId !== null && doubleBondCarbons.has(connectedId)) {
          isRelated = true;
        }
      }
    }
    
    if (!isRelated) {
      return [];
    }
    
    // 添加所有双键碳
    doubleBondCarbons.forEach(id => group.add(id));
    
    // 添加双键碳上的所有H
    doubleBondCarbons.forEach(carbonId => {
      stateRef.current.molecule.bonds.forEach(bond => {
        if (bond.atom1Id === carbonId || bond.atom2Id === carbonId) {
          const neighborId = bond.atom1Id === carbonId ? bond.atom2Id : bond.atom1Id;
          if (neighborId === null) return;
          const neighbor = stateRef.current.molecule.atoms.find(a => a.id === neighborId);
          if (neighbor && neighbor.symbol === 'H') {
            group.add(neighborId);
          }
        }
      });
    });
    
    return Array.from(group);
  };
  
  // 识别需要一起移动的约束基团
  // 同时返回旋转轴的信息（固定原子和旋转方向）
  const identifyConstrainedGroup = (startAtomId: string, selectedAtomsOverride?: string[]): { 
    atoms: string[],
    fixedAtomId: string | null,
    rotationAxis: THREE.Vector3 | null,
    rotationCenterId: string | null, // 新增：真正的旋转中心原子
    allHAtomIds?: string[], // 新增：甲烷模式用
    noRotation?: boolean // 新增：是否禁止旋转
  } => {
    const startAtom = stateRef.current.molecule.atoms.find(a => a.id === startAtomId);
    if (!startAtom) return { atoms: [startAtomId], fixedAtomId: null, rotationAxis: null, rotationCenterId: null };
    
    // 获取所有被选中的原子（优先使用传入的值）
    const selectedAtoms = selectedAtomsOverride ?? stateRef.current.selectedAtoms;
    
    // 调试：输出传入的参数
    console.log('[identifyConstrainedGroup] startAtomId:', startAtomId, 'startAtom:', startAtom.symbol, 'selectedAtoms:', selectedAtoms);
    
    // 注意：不再在此处做双键检查来阻止旋转
    // 双键原子（如苯环碳）仍然可以绕连接它的单键旋转
    // 全局最优键搜索会找到合适的单键作为旋转轴
    // 双键本身不会被选为旋转轴（因为全局搜索只考虑单键）
    
    // 如果有多个原子被选中
    if (selectedAtoms.length > 1) {
      
      // 分类选中的原子
      let nonHCount = 0;
      const selectedHAtoms: string[] = [];
      const selectedNonHAtoms: string[] = [];
      
      for (const atomId of selectedAtoms) {
        const a = stateRef.current.molecule.atoms.find(a => a.id === atomId);
        if (a) {
          if (a.symbol === 'H') {
            selectedHAtoms.push(atomId);
          } else {
            selectedNonHAtoms.push(atomId);
            nonHCount++;
          }
        }
      }
      
      // 选中2个非H原子且它们直接成键，绕该键旋转
      if (nonHCount === 2 && selectedNonHAtoms.length === 2) {
        const atom1Id = selectedNonHAtoms[0];
        const atom2Id = selectedNonHAtoms[1];
        const bond = stateRef.current.molecule.bonds.find(
          b => (b.atom1Id === atom1Id && b.atom2Id === atom2Id) ||
               (b.atom1Id === atom2Id && b.atom2Id === atom1Id)
        );
        
        // 键必须可旋转才能绕其旋转
        if (bond && bond.atom1Id !== null && bond.atom2Id !== null && isBondRotatable({ atom1Id: bond.atom1Id, atom2Id: bond.atom2Id, order: bond.order })) {
          // 两个非H原子直接成键，确定哪侧旋转
          // startAtomId（被点击/拖拽的原子）一侧旋转，另一侧固定
          const centerAtomId = startAtomId;
          const fixedAtomId = centerAtomId === atom1Id ? atom2Id : atom1Id;
          
          const centerAtom = stateRef.current.molecule.atoms.find(a => a.id === centerAtomId);
          const fixedAtom = stateRef.current.molecule.atoms.find(a => a.id === fixedAtomId);
          
          if (centerAtom && fixedAtom) {
            // 旋转轴：从固定原子指向中心原子
            const rotationAxis = new THREE.Vector3(
              centerAtom.position.x - fixedAtom.position.x,
              centerAtom.position.y - fixedAtom.position.y,
              centerAtom.position.z - fixedAtom.position.z
            ).normalize();
            
            // BFS找到从中心原子出发不经过固定原子的所有原子
            const rotateAtoms = new Set<string>();
            const visited = new Set<string>();
            const queue = [centerAtomId];
            visited.add(centerAtomId);
            visited.add(fixedAtomId);
            
            while (queue.length > 0) {
              const currentId = queue.shift()!;
              rotateAtoms.add(currentId);
              const currentBonds = stateRef.current.molecule.bonds.filter(
                b => b.atom1Id === currentId || b.atom2Id === currentId
              );
              for (const b of currentBonds) {
                const neighborId = b.atom1Id === currentId ? b.atom2Id : b.atom1Id;
                if (neighborId === null) continue;
                if (!visited.has(neighborId)) {
                  visited.add(neighborId);
                  queue.push(neighborId);
                }
              }
            }
            
            return {
              atoms: Array.from(rotateAtoms),
              fixedAtomId,
              rotationAxis,
              rotationCenterId: fixedAtomId,
              noRotation: false
            };
          }
        }
      }
      
      // ===== 全局键搜索：找到将所有选中原子分到同一侧的可旋转键 =====
      // 适用于：多选环内C原子、多选H原子、混合选择等所有情况
      {
        const allBondsList = stateRef.current.molecule.bonds;
        let bestBond: { atom1Id: string; atom2Id: string } | null = null;
        let bestRotateAtoms: Set<string> | null = null;
        let bestRotateSize = Infinity;
        let bestFixedAtomId: string | null = null;

        for (const bond of allBondsList) {
          if (bond.atom1Id === null || bond.atom2Id === null) continue;
          if (!isBondRotatable({ atom1Id: bond.atom1Id, atom2Id: bond.atom2Id, order: bond.order })) continue;

          const side1Start = bond.atom1Id;
          const side2Start = bond.atom2Id;

          // BFS从atom1出发不经过atom2
          const side1Atoms = new Set<string>();
          const visited1 = new Set<string>();
          const queue1 = [side1Start];
          visited1.add(side1Start);
          visited1.add(side2Start);
          while (queue1.length > 0) {
            const currentId = queue1.shift()!;
            side1Atoms.add(currentId);
            const currentBonds = stateRef.current.molecule.bonds.filter(
              b => b.atom1Id === currentId || b.atom2Id === currentId
            );
            for (const b of currentBonds) {
              const neighborId = b.atom1Id === currentId ? b.atom2Id : b.atom1Id;
              if (neighborId === null) continue;
              if (!visited1.has(neighborId)) {
                visited1.add(neighborId);
                queue1.push(neighborId);
              }
            }
          }

          // 检查是否所有选中原子都在side1
          const allSelectedInSide1 = selectedAtoms.every(id => side1Atoms.has(id));
          if (allSelectedInSide1 && side1Atoms.size < bestRotateSize) {
            bestBond = { atom1Id: bond.atom1Id, atom2Id: bond.atom2Id };
            bestRotateAtoms = side1Atoms;
            bestRotateSize = side1Atoms.size;
            bestFixedAtomId = side2Start;
          }

          // 检查是否所有选中原子都在side2
          const allSelectedInSide2 = selectedAtoms.every(id => !side1Atoms.has(id));
          if (allSelectedInSide2) {
            const side2Size = stateRef.current.molecule.atoms.length - side1Atoms.size;
            if (side2Size < bestRotateSize) {
              bestBond = { atom1Id: bond.atom1Id, atom2Id: bond.atom2Id };
              const side2Atoms = new Set<string>();
              const visited2 = new Set<string>();
              const queue2 = [side2Start];
              visited2.add(side2Start);
              visited2.add(side1Start);
              while (queue2.length > 0) {
                const currentId = queue2.shift()!;
                side2Atoms.add(currentId);
                const currentBonds = stateRef.current.molecule.bonds.filter(
                  b => b.atom1Id === currentId || b.atom2Id === currentId
                );
                for (const b of currentBonds) {
                  const neighborId = b.atom1Id === currentId ? b.atom2Id : b.atom1Id;
                  if (neighborId === null) continue;
                  if (!visited2.has(neighborId)) {
                    visited2.add(neighborId);
                    queue2.push(neighborId);
                  }
                }
              }
              bestRotateAtoms = side2Atoms;
              bestRotateSize = side2Size;
              bestFixedAtomId = side1Start;
            }
          }
        }

        if (bestBond && bestRotateAtoms && bestFixedAtomId) {
          const rotateAtom = stateRef.current.molecule.atoms.find(a => a.id === (bestRotateAtoms!.has(bestBond!.atom1Id) ? bestBond!.atom1Id : bestBond!.atom2Id));
          const fixedAtom = stateRef.current.molecule.atoms.find(a => a.id === bestFixedAtomId);

          if (rotateAtom && fixedAtom) {
            const rotationAxis = new THREE.Vector3(
              rotateAtom.position.x - fixedAtom.position.x,
              rotateAtom.position.y - fixedAtom.position.y,
              rotateAtom.position.z - fixedAtom.position.z
            ).normalize();

            return {
              atoms: Array.from(bestRotateAtoms),
              fixedAtomId: bestFixedAtomId,
              rotationAxis,
              rotationCenterId: bestFixedAtomId,
              noRotation: false
            };
          }
        }
      }

      // 没有找到可旋转键
      return { atoms: [...selectedAtoms], fixedAtomId: null, rotationAxis: null, rotationCenterId: null, noRotation: true };
    }
    
    // 单原子选择模式
    // 使用全局键搜索：找到将选中原子分到一侧的可旋转键
    const allBondsList = stateRef.current.molecule.bonds;
    let bestBond: { atom1Id: string; atom2Id: string } | null = null;
    let bestRotateAtoms: Set<string> | null = null;
    let bestRotateSize = Infinity;
    let bestFixedAtomId: string | null = null;

    for (const bond of allBondsList) {
      if (bond.atom1Id === null || bond.atom2Id === null) continue;
      if (!isBondRotatable({ atom1Id: bond.atom1Id, atom2Id: bond.atom2Id, order: bond.order })) continue;

      const side1Start = bond.atom1Id;
      const side2Start = bond.atom2Id;

      // BFS从atom1出发不经过atom2
      const side1Atoms = new Set<string>();
      const visited1 = new Set<string>();
      const queue1 = [side1Start];
      visited1.add(side1Start);
      visited1.add(side2Start);
      while (queue1.length > 0) {
        const currentId = queue1.shift()!;
        side1Atoms.add(currentId);
        const currentBonds = stateRef.current.molecule.bonds.filter(
          b => b.atom1Id === currentId || b.atom2Id === currentId
        );
        for (const b of currentBonds) {
          const neighborId = b.atom1Id === currentId ? b.atom2Id : b.atom1Id;
          if (neighborId === null) continue;
          if (!visited1.has(neighborId)) {
            visited1.add(neighborId);
            queue1.push(neighborId);
          }
        }
      }

      // 选中原子在side1
      if (side1Atoms.has(startAtomId) && side1Atoms.size < bestRotateSize) {
        bestBond = { atom1Id: bond.atom1Id, atom2Id: bond.atom2Id };
        bestRotateAtoms = side1Atoms;
        bestRotateSize = side1Atoms.size;
        bestFixedAtomId = side2Start;
      }

      // 选中原子在side2
      if (!side1Atoms.has(startAtomId)) {
        const side2Size = stateRef.current.molecule.atoms.length - side1Atoms.size;
        if (side2Size < bestRotateSize) {
          bestBond = { atom1Id: bond.atom1Id, atom2Id: bond.atom2Id };
          const side2Atoms = new Set<string>();
          const visited2 = new Set<string>();
          const queue2 = [side2Start];
          visited2.add(side2Start);
          visited2.add(side1Start);
          while (queue2.length > 0) {
            const currentId = queue2.shift()!;
            side2Atoms.add(currentId);
            const currentBonds = stateRef.current.molecule.bonds.filter(
              b => b.atom1Id === currentId || b.atom2Id === currentId
            );
            for (const b of currentBonds) {
              const neighborId = b.atom1Id === currentId ? b.atom2Id : b.atom1Id;
              if (neighborId === null) continue;
              if (!visited2.has(neighborId)) {
                visited2.add(neighborId);
                queue2.push(neighborId);
              }
            }
          }
          bestRotateAtoms = side2Atoms;
          bestRotateSize = side2Size;
          bestFixedAtomId = side1Start;
        }
      }
    }

    if (bestBond && bestRotateAtoms && bestFixedAtomId) {
      const rotateAtom = stateRef.current.molecule.atoms.find(a => a.id === (bestRotateAtoms!.has(bestBond!.atom1Id) ? bestBond!.atom1Id : bestBond!.atom2Id));
      const fixedAtom = stateRef.current.molecule.atoms.find(a => a.id === bestFixedAtomId);

      if (rotateAtom && fixedAtom) {
        const rotationAxis = new THREE.Vector3(
          rotateAtom.position.x - fixedAtom.position.x,
          rotateAtom.position.y - fixedAtom.position.y,
          rotateAtom.position.z - fixedAtom.position.z
        ).normalize();

        return {
          atoms: Array.from(bestRotateAtoms),
          fixedAtomId: bestFixedAtomId,
          rotationAxis,
          rotationCenterId: bestFixedAtomId,
          noRotation: false
        };
      }
    }

    // 没有找到可旋转键
    const connectedBonds = stateRef.current.molecule.bonds.filter(
      b => b.atom1Id === startAtomId || b.atom2Id === startAtomId
    );
    const atoms = [startAtomId];
    for (const bond of connectedBonds) {
      const neighborId = bond.atom1Id === startAtomId ? bond.atom2Id : bond.atom1Id;
      if (neighborId === null) continue;
      const neighbor = stateRef.current.molecule.atoms.find(a => a.id === neighborId);
      if (neighbor && neighbor.symbol === 'H') {
        atoms.push(neighborId);
      }
    }
    return { atoms, fixedAtomId: null, rotationAxis: null, rotationCenterId: null, noRotation: true };
  };

  // 移动整个约束基团（支持绕键轴旋转）
  const moveConstrainedGroup = (
    draggedAtomId: string,
    currentMouseX: number,
    currentMouseY: number
  ) => {
    const constrainedAtoms = interactionRef.current.constrainedAtoms;
    const selectedAtoms = stateRef.current.selectedAtoms;
    const rotationFixedAtomId = interactionRef.current.rotationFixedAtomId;
    const rotationAxis = interactionRef.current.rotationAxis;
    const rotationCenterId = interactionRef.current.rotationCenterId;
    const initialPositions = interactionRef.current.initialPositions;
    const noRotation = interactionRef.current.noRotation;
    
    console.log('[moveConstrainedGroup] rotationFixedAtomId:', rotationFixedAtomId, 'rotationAxis:', rotationAxis, 'rotationCenterId:', rotationCenterId, 'noRotation:', noRotation);
    console.log('[moveConstrainedGroup] constrainedAtoms:', constrainedAtoms);
    console.log('[moveConstrainedGroup] initialPositions keys:', Object.keys(initialPositions));
    console.log('[moveConstrainedGroup] draggedAtomId:', draggedAtomId);
    
    // 如果明确标记为不允许旋转，直接返回，不执行任何旋转
    if (noRotation) {
      console.log('[moveConstrainedGroup] noRotation flag set - skipping rotation');
      return;
    }
    
    // 使用缓存的分子中心，避免因旋转原子移动导致中心漂移
    const center3D = moleculeCenterRef.current.clone();
    
    // 检查是否有旋转轴（单键旋转模式）
    if (rotationFixedAtomId && rotationAxis && rotationCenterId) {
      // 绕键轴旋转模式
      const centerAtom = stateRef.current.molecule.atoms.find(a => a.id === rotationCenterId);
      const draggedInitialPos = interactionRef.current.initialPositions[draggedAtomId];
      
      if (!centerAtom || !draggedInitialPos) return;
      
      // 计算旋转角度：基于鼠标移动
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const camera = cameraRef.current;
      if (!camera) return;
      
      // 获取旋转中心的初始位置
      const centerInitialPos = interactionRef.current.initialPositions[rotationCenterId];
      if (!centerInitialPos) return;
      
      // 将旋转中心投影到屏幕坐标
      // centerInitialPos 是 group 的局部坐标，需要转换到世界坐标再投影
      const centerLocal = new THREE.Vector3(centerInitialPos.x, centerInitialPos.y, centerInitialPos.z);
      const centerWorld = centerLocal.clone();
      if (groupRef.current) {
        groupRef.current.updateMatrixWorld();
        centerWorld.applyMatrix4(groupRef.current.matrixWorld);
      }
      const centerScreen = centerWorld.clone().project(camera);
      const rect2 = containerRef.current?.getBoundingClientRect();
      if (!rect2) return;
      const centerScreenX = (centerScreen.x * 0.5 + 0.5) * rect2.width;
      const centerScreenY = (-centerScreen.y * 0.5 + 0.5) * rect2.height;
      
      // 计算当前鼠标相对于旋转中心的角度
      const mouseDx = currentMouseX - centerScreenX;
      const mouseDy = currentMouseY - centerScreenY;
      const currentAngle = Math.atan2(mouseDy, mouseDx);
      
      // 首次调用时初始化lastMouseAngle（避免第一帧产生巨大角度跳变）
      if (interactionRef.current.accumulatedAngle === 0 && interactionRef.current.lastMouseAngle === 0) {
        interactionRef.current.lastMouseAngle = currentAngle;
      }
      
      // 计算角度增量（处理 ±π 边界）
      let angleDelta = currentAngle - interactionRef.current.lastMouseAngle;
      if (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
      if (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
      
      // 根据相机视线方向与旋转轴的关系修正方向
      // 视角旋转(viewQuat)影响屏幕上旋转方向的感知
      // 实际视线方向 = viewQuat.invert() * (0,0,1)
      const cameraForward = new THREE.Vector3(0, 0, 1).applyQuaternion(viewQuaternionRef.current.clone().invert());
      const axisDot = cameraForward.dot(rotationAxis);
      if (axisDot < 0) {
        angleDelta = -angleDelta;
      }
      
      // 累积角度
      interactionRef.current.accumulatedAngle += angleDelta;
      interactionRef.current.lastMouseAngle = currentAngle;
      interactionRef.current.lastMousePosition = { x: currentMouseX, y: currentMouseY };
      
      // 应用旋转（基于初始位置重新计算，消除累积误差）
      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(rotationAxis, interactionRef.current.accumulatedAngle);
      
      // 应用旋转到所有约束原子（基于初始位置重新计算）
      constrainedAtoms.forEach(atomId => {
        const initialPos = interactionRef.current.initialPositions[atomId];
        if (!initialPos) return;
        
        // 从旋转中心指向原子的初始向量
        const vec = new THREE.Vector3(
          initialPos.x - centerInitialPos.x,
          initialPos.y - centerInitialPos.y,
          initialPos.z - centerInitialPos.z
        );
        
        // 应用旋转
        vec.applyQuaternion(quaternion);
        
        // 计算新位置（基于初始位置旋转）
        const newPos = {
          x: centerInitialPos.x + vec.x,
          y: centerInitialPos.y + vec.y,
          z: centerInitialPos.z + vec.z
        };
        
        // 更新 state
        updateAtomPositionRef.current(atomId, newPos);
        interactionRef.current.currentAtomPositions[atomId] = newPos;
        
        // 直接更新 Three.js 渲染的 Mesh 上的位置
        if (groupRef.current) {
          const adjustedNewPos = {
            x: newPos.x - center3D.x,
            y: newPos.y - center3D.y,
            z: newPos.z - center3D.z,
          };
          groupRef.current.children.forEach(child => {
            if (child.userData.type === 'atom' && child.userData.id === atomId) {
              child.position.set(adjustedNewPos.x, adjustedNewPos.y, adjustedNewPos.z);
            }
          });
        }
      });
    } else if (selectedAtoms.length > 1 && rotationAxis) {
      // 多选模式：按选中原子组的中心旋转（保持原来的功能）
      // 只有在 rotationAxis 存在时才允许旋转（即不是双键等刚性结构）
      
      // 计算选中原子的中心
      let center = { x: 0, y: 0, z: 0 };
      selectedAtoms.forEach(atomId => {
        const pos = interactionRef.current.initialPositions[atomId];
        if (pos) {
          center.x += pos.x;
          center.y += pos.y;
          center.z += pos.z;
        }
      });
      center.x /= selectedAtoms.length;
      center.y /= selectedAtoms.length;
      center.z /= selectedAtoms.length;
      
      // 用同样的平面投影方法计算旋转
      const camera = cameraRef.current;
      if (!camera) return;
      
      const worldDir = camera.getWorldDirection(new THREE.Vector3());
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const startMouse = getMousePosition(
        interactionRef.current.dragStartMousePosition.x,
        interactionRef.current.dragStartMousePosition.y,
        rect
      );
      const currentMouse = getMousePosition(currentMouseX, currentMouseY, rect);
      
      const raycaster = new THREE.Raycaster();
      const centerVec = new THREE.Vector3(center.x, center.y, center.z);
      const plane = new THREE.Plane();
      plane.setFromNormalAndCoplanarPoint(worldDir.clone().negate(), centerVec);
      
      raycaster.setFromCamera(startMouse, camera);
      const startIntersection = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, startIntersection)) return;
      
      raycaster.setFromCamera(currentMouse, camera);
      const currentIntersection = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, currentIntersection)) return;
      
      const v1 = startIntersection.clone().sub(centerVec);
      const v2 = currentIntersection.clone().sub(centerVec);
      
      if (v1.lengthSq() > 0.0001 && v2.lengthSq() > 0.0001) {
        v1.normalize();
        v2.normalize();
        
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(v1, v2);
        
        // 对所有选中的原子应用旋转
        selectedAtoms.forEach(atomId => {
          const initialPos = interactionRef.current.initialPositions[atomId];
          if (!initialPos) return;
          
          const vec = new THREE.Vector3(
            initialPos.x - center.x,
            initialPos.y - center.y,
            initialPos.z - center.z
          );
          
          vec.applyQuaternion(quaternion);
          
          let newPos = {
            x: center.x + vec.x,
            y: center.y + vec.y,
            z: center.z + vec.z
          };
          
          // 吸附检查：如果参考线存在且原子接近直线，直接吸附到直线上
          if (referenceInfoRef.current.line) {
            const lineInfo = referenceInfoRef.current.line;
            const atomPos = new THREE.Vector3(newPos.x - center3D.x, newPos.y - center3D.y, newPos.z - center3D.z);
            const toCenter = new THREE.Vector3().subVectors(atomPos, lineInfo.center);
            const distance = toCenter.cross(lineInfo.dir).length();
            const atomRadius = 0.3;
            const snapThreshold = 0.1;
            
            console.log('吸附检查 - 原子:', atomId, '距离:', distance, '阈值:', atomRadius + snapThreshold);
            
            if (distance < atomRadius + snapThreshold) {
              // 计算原子在直线上的投影点（虽然这里不直接使用，但保留计算逻辑为了注释）
              // const projectLength = toCenter.dot(lineInfo.dir);
              // const projectedPos = new THREE.Vector3().copy(lineInfo.center).addScaledVector(lineInfo.dir, projectLength);
              
              // 保持键长不变：将投影点归一化到正确的距离
              const rotCenter = new THREE.Vector3(center.x - center3D.x, center.y - center3D.y, center.z - center3D.z);
              const bondLength = atomPos.distanceTo(rotCenter);
              
              // 确保直线方向归一化
              const normalizedDir = lineInfo.dir.clone().normalize();
              
              // 计算原子中心应该在的位置（在直线上，且与旋转中心保持键长）
              // 直线参数方程: lineCenter + t * normalizedDir
              // 我们需要找到 t 使得距离 rotCenter 的距离为 bondLength
              const rotToLineCenter = new THREE.Vector3().subVectors(lineInfo.center, rotCenter);
              const a = normalizedDir.dot(normalizedDir);
              const b = 2 * rotToLineCenter.dot(normalizedDir);
              const c = rotToLineCenter.dot(rotToLineCenter) - bondLength * bondLength;
              const discriminant = b * b - 4 * a * c;
              
              if (discriminant >= 0) {
                // 两个解，选择距离当前原子更近的那个
                const sqrtD = Math.sqrt(discriminant);
                const t1 = (-b + sqrtD) / (2 * a);
                const t2 = (-b - sqrtD) / (2 * a);
                
                const pos1 = new THREE.Vector3().copy(lineInfo.center).addScaledVector(normalizedDir, t1);
                const pos2 = new THREE.Vector3().copy(lineInfo.center).addScaledVector(normalizedDir, t2);
                
                const dist1 = atomPos.distanceTo(pos1);
                const dist2 = atomPos.distanceTo(pos2);
                
                const targetPos = dist1 < dist2 ? pos1 : pos2;
                
                // 平滑吸附到目标位置
                const currentDist = atomPos.distanceTo(targetPos);
                if (currentDist > 0.001) {
                  const moveDir = new THREE.Vector3().subVectors(targetPos, atomPos);
                  moveDir.normalize().multiplyScalar(Math.min(currentDist, 0.2));
                  atomPos.add(moveDir);
                  
                  newPos = {
                    x: atomPos.x + center3D.x,
                    y: atomPos.y + center3D.y,
                    z: atomPos.z + center3D.z
                  };
                }
              }
            }
          }
          
          // 更新 state
          updateAtomPositionRef.current(atomId, newPos);
          interactionRef.current.currentAtomPositions[atomId] = newPos;
          
          // 直接更新 Three.js 渲染的 Mesh 上的位置（要减去 center3D）
          if (groupRef.current) {
            const adjustedNewPos = {
              x: newPos.x - center3D.x,
              y: newPos.y - center3D.y,
              z: newPos.z - center3D.z,
            };
            groupRef.current.children.forEach(child => {
              if (child.userData.type === 'atom' && child.userData.id === atomId) {
                child.position.set(adjustedNewPos.x, adjustedNewPos.y, adjustedNewPos.z);
              }
            });
          }
        });
      }
    }
    
    // 更新参考标记
    updateReferenceMarkers(interactionRef.current.currentAtomPositions);
  };

  const moveAtomWithConstraints = (atomId: string, targetPos: { x: number; y: number; z: number }) => {
    const neighbors = stateRef.current.molecule.bonds
      .filter(b => b.atom1Id === atomId || b.atom2Id === atomId)
      .map(b => {
        const neighborId = b.atom1Id === atomId ? b.atom2Id : b.atom1Id;
        const neighbor = stateRef.current.molecule.atoms.find(a => a.id === neighborId);
        return neighbor ? { atom: neighbor, targetLength: BOND_LENGTH } : null;
      })
      .filter(n => n !== null) as { atom: Atom; targetLength: number }[];

    let finalTargetPos = targetPos;
    
    let newPos = { ...finalTargetPos };

    if (neighbors.length === 1) {
      const neighbor = neighbors[0].atom;
      const dx = newPos.x - neighbor.position.x;
      const dy = newPos.y - neighbor.position.y;
      const dz = newPos.z - neighbor.position.z;
      const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (currentDist > 0.001) {
        const scale = neighbors[0].targetLength / currentDist;
        newPos = {
          x: neighbor.position.x + dx * scale,
          y: neighbor.position.y + dy * scale,
          z: neighbor.position.z + dz * scale,
        };
      }
    } else if (neighbors.length >= 2) {
      const learningRate = 0.1;
      const maxIterations = 100;
      const tolerance = 0.001;

      for (let iter = 0; iter < maxIterations; iter++) {
        let totalError = 0;
        let gradient = { x: 0, y: 0, z: 0 };

        for (const { atom: neighbor, targetLength } of neighbors) {
          const dx = newPos.x - neighbor.position.x;
          const dy = newPos.y - neighbor.position.y;
          const dz = newPos.z - neighbor.position.z;
          const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (currentDist > 0.001) {
            const error = currentDist - targetLength;
            totalError += Math.abs(error);

            gradient.x += (dx / currentDist) * error;
            gradient.y += (dy / currentDist) * error;
            gradient.z += (dz / currentDist) * error;
          }
        }

        if (totalError < tolerance) {
          break;
        }

        newPos.x -= learningRate * gradient.x;
        newPos.y -= learningRate * gradient.y;
        newPos.z -= learningRate * gradient.z;
      }
    }

    const allAtoms = stateRef.current.molecule.atoms;
    const draggedAtom = allAtoms.find(a => a.id === atomId);
    if (draggedAtom) {
      const draggedRadius = ELEMENT_RADII[draggedAtom.symbol] || CARBON_RADIUS;
      
      // 收集不应被排斥的原子ID：
      // 1. 正在吸附的键的空头所连接的原子
      // 2. 有空头键的原子（拖拽原子可能要连接到其空头）
      const noRepelAtomIds = new Set<string>();
      if (interactionRef.current.snapTargetBondId && interactionRef.current.snapTargetEndpoint) {
        const snapBond = stateRef.current.molecule.bonds.find(b => b.id === interactionRef.current.snapTargetBondId);
        if (snapBond) {
          const connectedId = interactionRef.current.snapTargetEndpoint === 'atom1' ? snapBond.atom2Id : snapBond.atom1Id;
          if (connectedId) noRepelAtomIds.add(connectedId);
        }
      }
      // 检查每个其他原子是否有空头键，如果有则不排斥（允许拖拽原子靠近以吸附）
      for (const bond of stateRef.current.molecule.bonds) {
        if (bond.atom1Id === null || bond.atom2Id === null) {
          // 这个键有空头，其连接的原子不应被排斥
          const connectedId = bond.atom1Id !== null ? bond.atom1Id : bond.atom2Id;
          if (connectedId && connectedId !== atomId) {
            noRepelAtomIds.add(connectedId);
          }
        }
      }
      
      for (const otherAtom of allAtoms) {
        if (otherAtom.id === atomId) continue;
        // 如果正在吸附到键的空头，或有空头键可吸附，不排斥该原子
        if (noRepelAtomIds.has(otherAtom.id)) continue;
        
        const otherRadius = ELEMENT_RADII[otherAtom.symbol] || CARBON_RADIUS;
        const minDist = draggedRadius + otherRadius;
        
        const dx = newPos.x - otherAtom.position.x;
        const dy = newPos.y - otherAtom.position.y;
        const dz = newPos.z - otherAtom.position.z;
        const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (currentDist < minDist && currentDist > 0.001) {
          const pushDir = {
            x: dx / currentDist,
            y: dy / currentDist,
            z: dz / currentDist
          };
          
          newPos = {
            x: otherAtom.position.x + pushDir.x * minDist,
            y: otherAtom.position.y + pushDir.y * minDist,
            z: otherAtom.position.z + pushDir.z * minDist
          };
        }
      }
    }

    if (showReferencePlane && referencePlaneRef.current && groupRef.current) {
      const planeWorldPos = new THREE.Vector3();
      referencePlaneRef.current.getWorldPosition(planeWorldPos);
      
      const planeNormal = new THREE.Vector3(0, 0, 1);
      planeNormal.applyQuaternion(referencePlaneRef.current.getWorldQuaternion(new THREE.Quaternion()));
      
      const worldPos = new THREE.Vector3(newPos.x, newPos.y, newPos.z);
      worldPos.applyMatrix4(groupRef.current.matrixWorld);
      
      const distance = Math.abs(worldPos.distanceTo(planeWorldPos));
      
      if (distance < 0.5) {
        const projectedPoint = worldPos.clone().sub(planeNormal.clone().multiplyScalar(planeNormal.dot(worldPos.clone().sub(planeWorldPos))));
        const localProjected = groupRef.current.worldToLocal(projectedPoint);
        
        newPos = {
          x: localProjected.x,
          y: localProjected.y,
          z: localProjected.z
        };
      }
    }

    updateAtomPositionRef.current(atomId, newPos);
    return newPos;
  };

  const moveBondEndpointOnSphere = (
    bondId: string,
    endpoint: 'atom1' | 'atom2',
    targetPos: { x: number; y: number; z: number }
  ) => {
    const bond = stateRef.current.molecule.bonds.find(b => b.id === bondId);
    if (!bond) return;

    const movingAtomId = endpoint === 'atom1' ? bond.atom1Id : bond.atom2Id;
    const fixedAtomId = endpoint === 'atom1' ? bond.atom2Id : bond.atom1Id;
    
    if (movingAtomId === null || fixedAtomId === null) return;

    const fixedAtom = stateRef.current.molecule.atoms.find(a => a.id === fixedAtomId);
    if (!fixedAtom) return;

    const bondLength = BOND_LENGTH;

    // 检查是否有靠近的、有空余化合价的原子可以吸附
    const nearbyAtomResult = findNearbyAtomWithFreeValence(
      targetPos, 
      stateRef.current.molecule, 
      [movingAtomId, fixedAtomId] // 排除当前键的两个原子
    );
    
    let finalTargetPos = targetPos;
    
    if (nearbyAtomResult.canSnap && nearbyAtomResult.targetAtomId) {
      // 如果可以吸附，获取吸附后的位置
      const movingAtom = stateRef.current.molecule.atoms.find(a => a.id === movingAtomId);
      if (movingAtom) {
        const snappedResult = getSnappedPosition(movingAtom.position, nearbyAtomResult.targetAtomId, stateRef.current.molecule);
        if (snappedResult.canSnap) {
          finalTargetPos = snappedResult.position;
        }
      }
    }

    const newPos = moveAtomWithConstraints(movingAtomId!, finalTargetPos);

    const neighbors = stateRef.current.molecule.bonds
      .filter(b => b.atom1Id === movingAtomId || b.atom2Id === movingAtomId)
      .filter(b => b.id !== bondId)
      .map(b => {
        const neighborId = b.atom1Id === movingAtomId ? b.atom2Id : b.atom1Id;
        const neighbor = stateRef.current.molecule.atoms.find(a => a.id === neighborId);
        return neighbor ? { atom: neighbor, targetLength: BOND_LENGTH } : null;
      })
      .filter(n => n !== null) as { atom: Atom; targetLength: number }[];

    if (neighbors.length > 0) {
      const learningRate = 0.1;
      const maxIterations = 50;

      for (let iter = 0; iter < maxIterations; iter++) {
        let totalError = 0;
        let gradient = { x: 0, y: 0, z: 0 };

        for (const { atom: neighbor, targetLength } of neighbors) {
          const dx = newPos.x - neighbor.position.x;
          const dy = newPos.y - neighbor.position.y;
          const dz = newPos.z - neighbor.position.z;
          const currentDist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (currentDist > 0.001) {
            const error = currentDist - targetLength;
            totalError += Math.abs(error);

            gradient.x += (dx / currentDist) * error;
            gradient.y += (dy / currentDist) * error;
            gradient.z += (dz / currentDist) * error;
          }
        }

        if (totalError < 0.001) {
          break;
        }

        newPos.x -= learningRate * gradient.x;
        newPos.y -= learningRate * gradient.y;
        newPos.z -= learningRate * gradient.z;

        const fdX = newPos.x - fixedAtom.position.x;
        const fdY = newPos.y - fixedAtom.position.y;
        const fdZ = newPos.z - fixedAtom.position.z;
        const fd = Math.sqrt(fdX * fdX + fdY * fdY + fdZ * fdZ);

        if (fd > 0.001) {
          const scale = bondLength / fd;
          newPos.x = fixedAtom.position.x + fdX * scale;
          newPos.y = fixedAtom.position.y + fdY * scale;
          newPos.z = fixedAtom.position.z + fdZ * scale;
        }
      }

      updateAtomPositionRef.current(movingAtomId!, newPos);
    }
  };

  // 分离的useEffect 1: 初始化Three.js场景（只执行一次）
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = isDarkMode ? new THREE.Color(0x0a0a0a) : new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    const aspect = width / height;
    const baseFrustumSize = 8;
    const frustumSize = baseFrustumSize * (100 / zoomLevel);
    const camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    camera.position.set(0, 0, -20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;
    // 初始化group四元数为默认视角（看向南方+Z）
    group.quaternion.copy(viewQuaternionRef.current);

    updateMoleculeDisplay();

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      if (activeDirectionRef.current && groupRef.current && cameraRef.current) {
        const rotation = getRotationSpeed(activeDirectionRef.current, cameraRef.current);
        if (rotation && rotation.axis) {
          const quaternion = new THREE.Quaternion().setFromAxisAngle(rotation.axis, rotation.angle);
          // 在世界空间中旋转group
          groupRef.current.quaternion.premultiply(quaternion);
          // 从group.quaternion中提取新的moleculeRotation
          moleculeRotationRef.current.copy(viewQuaternionRef.current.clone().invert().multiply(groupRef.current.quaternion));
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    const onMouseDown = (e: MouseEvent) => {
      if (activeDirectionRef.current) return;
      
      const rect = container.getBoundingClientRect();
      const mouse = getMousePosition(e.clientX, e.clientY, rect);

      // === 优先检测键端小球（最优先） ===
      const clickedEndpoint = findBondEndpointAtPosition(mouse);
      if (clickedEndpoint) {
        interactionRef.current.selectedBondEndpoint = clickedEndpoint;
        interactionRef.current.previousPosition = { x: e.clientX, y: e.clientY };
        interactionRef.current.isDragging = true;
        interactionRef.current.dragMode = 'moveBondEndpoint';
        interactionRef.current.bondEndpointIsDragging = true;

        if (groupRef.current) {
          groupRef.current.updateMatrixWorld();
          for (const child of groupRef.current.children) {
            if (child.userData.type === 'bondEndpoint' &&
                child.userData.id === clickedEndpoint.bondId &&
                child.userData.end === clickedEndpoint.end) {
              const origPos = {
                x: child.position.x,
                y: child.position.y,
                z: child.position.z,
              };
              interactionRef.current.bondEndpointOriginalPosition = origPos;

              const worldPos = new THREE.Vector3(origPos.x, origPos.y, origPos.z);
              groupRef.current.localToWorld(worldPos);
              interactionRef.current.dragPlaneCenter.copy(worldPos);

              const mat = (child as THREE.Mesh).material as THREE.MeshPhongMaterial;
              if (mat) {
                interactionRef.current.bondEndpointOriginalColor = mat.color.getHex();
                mat.color.set(0x00ff00);
              }
              break;
            }
          }
        }
        return;
      }

      const clickedBondId = findBondAtPosition(mouse);
      const clickedAtomId = findAtomAtPosition(mouse);
      const clickedRefObj = findReferenceLineOrPlane(mouse);

      interactionRef.current.previousPosition = { x: e.clientX, y: e.clientY };

      // 检查是否点击了参考线或平面
      if (clickedRefObj.type === 'line' || clickedRefObj.type === 'plane') {
        interactionRef.current.draggedRefType = clickedRefObj.type;
        interactionRef.current.draggedRef = clickedRefObj.ref;
        
        // 保存参考线/面的初始位置
        if (clickedRefObj.ref) {
          interactionRef.current.initialRefPosition = {
            x: clickedRefObj.ref.position.x,
            y: clickedRefObj.ref.position.y,
            z: clickedRefObj.ref.position.z
          };
          
          // 保存法向量（直线的方向，平面的法向量）
          if (clickedRefObj.type === 'line') {
            const positions = clickedRefObj.ref.geometry.attributes.position;
            const p1 = new THREE.Vector3().fromBufferAttribute(positions, 0);
            const p2 = new THREE.Vector3().fromBufferAttribute(positions, 1);
            interactionRef.current.refNormal = p2.clone().sub(p1).normalize();
          } else if (clickedRefObj.type === 'plane') {
            interactionRef.current.refNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(clickedRefObj.ref.quaternion);
          }
        }
        
        interactionRef.current.isDragging = true;
        interactionRef.current.dragMode = 'moveRef';
        return;
      }

      if (draggedBondOrderRef.current && clickedAtomId) {
        setBondStartAtomRef.current(clickedAtomId);
        interactionRef.current.isDragging = true;
        interactionRef.current.dragMode = 'moveBond';
        return;
      }

      // 检查是否在插入原子模式
      if (stateRef.current.insertAtomSymbol && !clickedAtomId && !clickedBondId) {
        groupRef.current!.updateMatrixWorld();
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current!);

        const plane = new THREE.Plane();
        plane.setFromNormalAndCoplanarPoint(
          cameraRef.current!.getWorldDirection(new THREE.Vector3()).negate(),
          new THREE.Vector3(0, 0, 0)
        );

        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (intersection) {
          // 将世界坐标转换为 group 的局部坐标
          const groupInvMatrix = new THREE.Matrix4().copy(groupRef.current!.matrixWorld).invert();
          const localIntersection = intersection.clone().applyMatrix4(groupInvMatrix);
          
          interactionRef.current.insertAtomPending = true;
          interactionRef.current.insertAtomPosition = { x: localIntersection.x, y: localIntersection.y, z: localIntersection.z };
        }
        interactionRef.current.isDragging = true;
        interactionRef.current.dragMode = 'rotateView';
        return;
      }

      // 检查是否在插入官能团模式
      if (stateRef.current.insertFunctionalGroupId && !clickedAtomId && !clickedBondId) {
        groupRef.current!.updateMatrixWorld();
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current!);

        const plane = new THREE.Plane();
        plane.setFromNormalAndCoplanarPoint(
          cameraRef.current!.getWorldDirection(new THREE.Vector3()).negate(),
          new THREE.Vector3(0, 0, 0)
        );

        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (intersection) {
          const groupInvMatrix = new THREE.Matrix4().copy(groupRef.current!.matrixWorld).invert();
          const localIntersection = intersection.clone().applyMatrix4(groupInvMatrix);
          
          interactionRef.current.insertFunctionalGroupPending = true;
          interactionRef.current.insertFunctionalGroupPosition = { x: localIntersection.x, y: localIntersection.y, z: localIntersection.z };
        }
        interactionRef.current.isDragging = true;
        interactionRef.current.dragMode = 'rotateView';
        return;
      }

      // 检查是否在插入键模式
      if (stateRef.current.insertBondOrder && !clickedAtomId && !clickedBondId) {
        groupRef.current!.updateMatrixWorld();
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current!);

        const plane = new THREE.Plane();
        plane.setFromNormalAndCoplanarPoint(
          cameraRef.current!.getWorldDirection(new THREE.Vector3()).negate(),
          new THREE.Vector3(0, 0, 0)
        );

        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (intersection) {
          // 将世界坐标转换为 group 的局部坐标
          const groupInvMatrix = new THREE.Matrix4().copy(groupRef.current!.matrixWorld).invert();
          const localIntersection = intersection.clone().applyMatrix4(groupInvMatrix);
          
          interactionRef.current.insertBondPending = true;
          interactionRef.current.insertBondPosition = { x: localIntersection.x, y: localIntersection.y, z: localIntersection.z };
        }
        interactionRef.current.isDragging = true;
        interactionRef.current.dragMode = 'rotateView';
        return;
      }

      const currentTool = stateRef.current.tool;

      if (currentTool === 'analyze') {
        // 分析模式：点击单个原子，自动选中刚性约束组并可整体移动或旋转
        if (clickedAtomId) {
          const currentSelected = stateRef.current.selectedAtoms;
          
          // 检查：如果点击的是已选中原子，保持当前选中状态，否则重新选择
          let rigidGroup: string[];
          if (currentSelected.includes(clickedAtomId)) {
            // 保持已选中的原子
            rigidGroup = currentSelected;
          } else {
            // 找到刚性约束组
            rigidGroup = findRigidGroup(stateRef.current.molecule, clickedAtomId);
            selectAtomRef.current(clickedAtomId);
            setGyroSelectedAtomId(clickedAtomId);
            updateSelectedAtomsRef.current(rigidGroup);
            selectBondRef.current(null);
          }
          
          interactionRef.current.draggedAtomId = clickedAtomId;
          
          // 识别约束基团和旋转轴（与手指模式一致）
          let centerAtomIdForRotation = clickedAtomId;
          
          // 检查选中的原子中是否有非H原子
          const hasNonH = rigidGroup.some(id => {
            const a = stateRef.current.molecule.atoms.find(atom => atom.id === id);
            return a && a.symbol !== 'H';
          });
          
          if (hasNonH) {
            // 有非H原子，用那个
            const nonHAtom = rigidGroup.find(id => {
              const a = stateRef.current.molecule.atoms.find(atom => atom.id === id);
              return a && a.symbol !== 'H';
            });
            if (nonHAtom) {
              centerAtomIdForRotation = nonHAtom;
            }
          } else {
            // 都是H，找共同邻居
            const neighborMap = new Map<string, number>();
            rigidGroup.forEach(atomId => {
              const bonds = stateRef.current.molecule.bonds.filter(
                b => b.atom1Id === atomId || b.atom2Id === atomId
              );
              bonds.forEach(bond => {
                const neighborId = bond.atom1Id === atomId ? bond.atom2Id : bond.atom1Id;
                if (neighborId === null) return;
                const neighbor = stateRef.current.molecule.atoms.find(a => a.id === neighborId);
                if (neighbor && neighbor.symbol !== 'H') {
                  neighborMap.set(neighborId, (neighborMap.get(neighborId) || 0) + 1);
                }
              });
            });
            
            // 找所有H的共同邻居
            for (const [neighborId, count] of neighborMap) {
              if (count === rigidGroup.length) {
                centerAtomIdForRotation = neighborId;
                break;
              }
            }
          }
          
          // 识别约束基团（与手指模式一致）
          const groupInfo = identifyConstrainedGroup(centerAtomIdForRotation, rigidGroup);
          interactionRef.current.constrainedAtoms = groupInfo.atoms;
          interactionRef.current.rotationFixedAtomId = groupInfo.fixedAtomId;
          interactionRef.current.rotationAxis = groupInfo.rotationAxis;
          interactionRef.current.rotationCenterId = groupInfo.rotationCenterId;
          interactionRef.current.noRotation = groupInfo.noRotation || false;
          
          // 保存初始位置
          const initialPositions: Record<string, { x: number; y: number; z: number }> = {};
          for (const atomId of groupInfo.atoms) {
            const a = stateRef.current.molecule.atoms.find(a => a.id === atomId);
            if (a) {
              initialPositions[atomId] = { ...a.position };
            }
          }
          // 同时保存旋转中心的初始位置（如果存在且不在约束基团中）
          if (groupInfo.rotationCenterId && !initialPositions[groupInfo.rotationCenterId]) {
            const centerAtom = stateRef.current.molecule.atoms.find(a => a.id === groupInfo.rotationCenterId);
            if (centerAtom) {
              initialPositions[groupInfo.rotationCenterId] = { ...centerAtom.position };
            }
          }
          interactionRef.current.initialPositions = initialPositions;
          interactionRef.current.currentAtomPositions = { ...initialPositions };
          
          const clickedAtom = stateRef.current.molecule.atoms.find(a => a.id === clickedAtomId);
          if (clickedAtom) {
            // 确保 matrixWorld 是最新的
            groupRef.current!.updateMatrixWorld();
            // 使用 localToWorld 获取正确的世界坐标
            const worldPos = new THREE.Vector3(
              clickedAtom.position.x,
              clickedAtom.position.y,
              clickedAtom.position.z
            );
            groupRef.current!.localToWorld(worldPos);
            
            interactionRef.current.dragPlaneCenter.set(
              worldPos.x,
              worldPos.y,
              worldPos.z
            );
          }
          
          // 保存鼠标开始位置（用于旋转计算）
          interactionRef.current.dragStartMousePosition = { x: e.clientX, y: e.clientY };
          interactionRef.current.lastMousePosition = { x: e.clientX, y: e.clientY };
          interactionRef.current.accumulatedAngle = 0;
          interactionRef.current.lastMouseAngle = 0;
          
          interactionRef.current.isDragging = true;
          interactionRef.current.dragMode = 'moveAtom';
          return;
        }
        
        // 分析模式：点击键，选中并允许拖拽整个原子+键单元
        if (clickedBondId) {
          selectBondRef.current(clickedBondId);
          selectAtomRef.current(null);
          updateSelectedAtomsRef.current([]);

          const bond = stateRef.current.molecule.bonds.find(b => b.id === clickedBondId);
          if (bond) {
            // 收集键两端有原子的ID
            const bondAtomIds: string[] = [];
            if (bond.atom1Id !== null) bondAtomIds.push(bond.atom1Id);
            if (bond.atom2Id !== null) bondAtomIds.push(bond.atom2Id);

            if (bondAtomIds.length > 0) {
              updateSelectedAtomsRef.current(bondAtomIds);
              selectAtomRef.current(bondAtomIds[0]);
              setGyroSelectedAtomId(bondAtomIds[0]);

              interactionRef.current.draggedAtomId = bondAtomIds[0];

              // 计算键中心作为拖拽平面中心
              const atom1 = bond.atom1Id !== null ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom1Id) : null;
              const atom2 = bond.atom2Id !== null ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom2Id) : null;
              
              let centerPos: { x: number; y: number; z: number } | null = null;
              if (atom1 && atom2) {
                centerPos = {
                  x: (atom1.position.x + atom2.position.x) / 2,
                  y: (atom1.position.y + atom2.position.y) / 2,
                  z: (atom1.position.z + atom2.position.z) / 2,
                };
              } else if (atom1) {
                centerPos = { ...atom1.position };
              } else if (atom2) {
                centerPos = { ...atom2.position };
              }

              if (centerPos && groupRef.current) {
                groupRef.current.updateMatrixWorld();
                const worldPos = new THREE.Vector3(centerPos.x, centerPos.y, centerPos.z);
                groupRef.current.localToWorld(worldPos);
                interactionRef.current.dragPlaneCenter.set(worldPos.x, worldPos.y, worldPos.z);
              }

              // 识别约束基团
              const groupInfo = identifyConstrainedGroup(bondAtomIds[0], bondAtomIds);
              interactionRef.current.constrainedAtoms = groupInfo.atoms;
              interactionRef.current.rotationFixedAtomId = groupInfo.fixedAtomId;
              interactionRef.current.rotationAxis = groupInfo.rotationAxis;
              interactionRef.current.rotationCenterId = groupInfo.rotationCenterId;
              interactionRef.current.noRotation = groupInfo.noRotation || false;

              // 保存初始位置
              const initialPositions: Record<string, { x: number; y: number; z: number }> = {};
              for (const atomId of groupInfo.atoms) {
                const a = stateRef.current.molecule.atoms.find(a => a.id === atomId);
                if (a) {
                  initialPositions[atomId] = { ...a.position };
                }
              }
              if (groupInfo.rotationCenterId && !initialPositions[groupInfo.rotationCenterId]) {
                const centerAtom = stateRef.current.molecule.atoms.find(a => a.id === groupInfo.rotationCenterId);
                if (centerAtom) {
                  initialPositions[groupInfo.rotationCenterId] = { ...centerAtom.position };
                }
              }
              interactionRef.current.initialPositions = initialPositions;
              interactionRef.current.currentAtomPositions = { ...initialPositions };

              interactionRef.current.dragStartMousePosition = { x: e.clientX, y: e.clientY };
              interactionRef.current.lastMousePosition = { x: e.clientX, y: e.clientY };
              interactionRef.current.accumulatedAngle = 0;
              interactionRef.current.lastMouseAngle = 0;

              interactionRef.current.isDragging = true;
              interactionRef.current.dragMode = 'moveAtom';
            }
          }
          return;
        }
        
        // 默认：点击空白，取消选中并旋转视图
        selectAtomRef.current(null);
        setGyroSelectedAtomId(null);
        updateSelectedAtomsRef.current([]);
        selectBondRef.current(null);
        interactionRef.current.dragMode = 'rotateView';
        interactionRef.current.startSpherical = {
          theta: cameraSpherical.theta,
          phi: cameraSpherical.phi,
        };
        interactionRef.current.isDragging = true;
      } else {
        // 手指模式：可以多选，在约束下拖拽
        if (clickedBondId) {
          // 编辑模式下点击键：选中键，准备拖拽（延迟启动，防止点击时跳动）
          selectBondRef.current(clickedBondId);
          // 注意：不再调用 selectAtomRef.current(null)，因为 SELECT_BOND 会清除 selectedAtom
          // 而 SELECT_ATOM 会清除 selectedBond，导致键选中状态被覆盖
          updateSelectedAtomsRef.current([]);

          const bond = stateRef.current.molecule.bonds.find(b => b.id === clickedBondId);
          if (bond) {
            // 计算键中心位置（局部坐标）
            const pos1 = bond.atom1Id ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom1Id)?.position : bond.atom1Position;
            const pos2 = bond.atom2Id ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom2Id)?.position : bond.atom2Position;
            let bondCenterLocal = new THREE.Vector3(0, 0, 0);
            if (pos1 && pos2) {
              bondCenterLocal.set((pos1.x + pos2.x) / 2, (pos1.y + pos2.y) / 2, (pos1.z + pos2.z) / 2);
            } else if (pos1) {
              bondCenterLocal.set(pos1.x, pos1.y, pos1.z);
            } else if (pos2) {
              bondCenterLocal.set(pos2.x, pos2.y, pos2.z);
            }

            // 将键中心转为世界坐标
            groupRef.current!.updateMatrixWorld();
            const bondCenterWorld = bondCenterLocal.clone();
            groupRef.current!.localToWorld(bondCenterWorld);

            // 用鼠标射线与过键中心的视图平面求交，作为拖拽起点
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current!);
            const plane = new THREE.Plane();
            plane.setFromNormalAndCoplanarPoint(
              cameraRef.current!.getWorldDirection(new THREE.Vector3()).negate(),
              bondCenterWorld
            );
            const planeIntersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, planeIntersection);
            if (planeIntersection) {
              interactionRef.current.dragPlaneCenter.set(planeIntersection.x, planeIntersection.y, planeIntersection.z);
            }

            interactionRef.current.isSingleBondDrag = true;
            interactionRef.current.draggedBondId = clickedBondId;
            interactionRef.current.bondOriginalAtom1Position = pos1 || { x: 0, y: 0, z: 0 };
            interactionRef.current.bondOriginalAtom2Position = pos2 || { x: 0, y: 0, z: 0 };
            interactionRef.current.snapTarget1 = null;
            interactionRef.current.snapTarget2 = null;

            // 收集刚性基团原子并存储原始位置
            const clickedBond = stateRef.current.molecule.bonds.find(b => b.id === clickedBondId);
            if (clickedBond) {
              const rigidAtomIds = new Set<string>();
              // 从 atom1 出发，不经过当前键，收集所有连接的原子
              if (clickedBond.atom1Id !== null) {
                rigidAtomIds.add(clickedBond.atom1Id);
                const bfsVisited = new Set<string>([clickedBond.atom2Id!].filter(Boolean));
                bfsVisited.add(clickedBond.atom1Id);
                const bfsQueue = [clickedBond.atom1Id];
                while (bfsQueue.length > 0) {
                  const curId = bfsQueue.shift()!;
                  const curBonds = stateRef.current.molecule.bonds.filter(
                    b => b.atom1Id === curId || b.atom2Id === curId
                  );
                  for (const b of curBonds) {
                    const nId = b.atom1Id === curId ? b.atom2Id : b.atom1Id;
                    if (nId && !bfsVisited.has(nId)) {
                      bfsVisited.add(nId);
                      rigidAtomIds.add(nId);
                      bfsQueue.push(nId);
                    }
                  }
                }
              }
              // 从 atom2 出发，不经过当前键，收集所有连接的原子
              if (clickedBond.atom2Id !== null) {
                rigidAtomIds.add(clickedBond.atom2Id);
                const bfsVisited = new Set<string>([clickedBond.atom1Id!].filter(Boolean));
                bfsVisited.add(clickedBond.atom2Id);
                const bfsQueue = [clickedBond.atom2Id];
                while (bfsQueue.length > 0) {
                  const curId = bfsQueue.shift()!;
                  const curBonds = stateRef.current.molecule.bonds.filter(
                    b => b.atom1Id === curId || b.atom2Id === curId
                  );
                  for (const b of curBonds) {
                    const nId = b.atom1Id === curId ? b.atom2Id : b.atom1Id;
                    if (nId && !bfsVisited.has(nId)) {
                      bfsVisited.add(nId);
                      rigidAtomIds.add(nId);
                      bfsQueue.push(nId);
                    }
                  }
                }
              }
              // 存储所有刚性基团原子的原始位置
              const origPositions: Record<string, { x: number; y: number; z: number }> = {};
              for (const atomId of rigidAtomIds) {
                const atom = stateRef.current.molecule.atoms.find(a => a.id === atomId);
                if (atom) {
                  origPositions[atomId] = { ...atom.position };
                }
              }
              interactionRef.current.rigidGroupOriginalPositions = origPositions;

              // 收集刚性基团中其他键的空头位置（需要一起移动）
              const emptyBondPositions: Record<string, { bondId: string, endpoint: 'atom1' | 'atom2', originalPosition: { x: number; y: number; z: number } }> = {};
              for (const otherBond of stateRef.current.molecule.bonds) {
                if (otherBond.id === clickedBondId) continue; // 跳过当前拖拽的键
                // 检查键是否与刚性基团中的原子相连
                const isConnected = (otherBond.atom1Id !== null && rigidAtomIds.has(otherBond.atom1Id)) ||
                                    (otherBond.atom2Id !== null && rigidAtomIds.has(otherBond.atom2Id));
                if (!isConnected) continue;
                // 收集空头位置
                if (otherBond.atom1Id === null && otherBond.atom1Position) {
                  emptyBondPositions[otherBond.id + '_atom1'] = {
                    bondId: otherBond.id,
                    endpoint: 'atom1',
                    originalPosition: { ...otherBond.atom1Position }
                  };
                }
                if (otherBond.atom2Id === null && otherBond.atom2Position) {
                  emptyBondPositions[otherBond.id + '_atom2'] = {
                    bondId: otherBond.id,
                    endpoint: 'atom2',
                    originalPosition: { ...otherBond.atom2Position }
                  };
                }
              }
              interactionRef.current.rigidGroupEmptyBondPositions = emptyBondPositions;
            }

            // 存储拖拽起始中心点（用于计算总位移）
            interactionRef.current.bondDragStartCenter.copy(interactionRef.current.dragPlaneCenter);
          }

          interactionRef.current.dragStartMousePosition = { x: e.clientX, y: e.clientY };
          interactionRef.current.lastMousePosition = { x: e.clientX, y: e.clientY };
          // 不立即启动拖拽，等鼠标移动超过阈值后再启动，防止点击时跳动
          interactionRef.current.pendingBondDrag = true;
          interactionRef.current.dragMode = 'moveBond';
        } else if (clickedAtomId) {
          // 获取当前选中状态（在更新之前）
          const currentSelected = stateRef.current.selectedAtoms;
          let newSelectedAtoms: string[];
          
          // 检测Shift键进行多选
          if (e.shiftKey) {
            // Shift+点击：添加到已选中的原子列表
            if (currentSelected.includes(clickedAtomId)) {
              // 如果已选中，则取消选中，不进入拖拽模式
              newSelectedAtoms = currentSelected.filter(id => id !== clickedAtomId);
              updateSelectedAtomsRef.current(newSelectedAtoms);
              if (newSelectedAtoms.length > 0) {
                selectAtomRef.current(newSelectedAtoms[0]);
                setGyroSelectedAtomId(newSelectedAtoms[0]);
              } else {
                selectAtomRef.current(null);
                setGyroSelectedAtomId(null);
              }
              return; // 取消选中后直接返回，不设置拖拽
            } else {
              // 如果未选中，则添加
              newSelectedAtoms = [...currentSelected, clickedAtomId];
            }
            updateSelectedAtomsRef.current(newSelectedAtoms);
            selectAtomRef.current(clickedAtomId);
            setGyroSelectedAtomId(clickedAtomId);
          } else {
            // 普通点击：单选原子
            if (currentSelected.includes(clickedAtomId)) {
              // 如果点击的是已选中的原子，保持所有选中状态不变
              newSelectedAtoms = currentSelected;
              // 但是我们必须调用 updateSelectedAtomsRef 来确保状态是最新的（保持选中状态）
              updateSelectedAtomsRef.current(newSelectedAtoms);
            } else {
              // 如果点击的是未选中的原子，重置为单选
              newSelectedAtoms = [clickedAtomId];
              selectAtomRef.current(clickedAtomId);
              setGyroSelectedAtomId(clickedAtomId);
              updateSelectedAtomsRef.current(newSelectedAtoms);
              selectBondRef.current(null);
            }
          }

          interactionRef.current.draggedAtomId = clickedAtomId;

          const atom = stateRef.current.molecule.atoms.find(a => a.id === clickedAtomId);
          if (atom) {
            // 确保 matrixWorld 是最新的
            groupRef.current!.updateMatrixWorld();
            // 使用 localToWorld 获取正确的世界坐标
            const worldPos = new THREE.Vector3(
              atom.position.x,
              atom.position.y,
              atom.position.z
            );
            groupRef.current!.localToWorld(worldPos);
            
            interactionRef.current.dragPlaneCenter.set(
              worldPos.x,
              worldPos.y,
              worldPos.z
            );
          }
          
          // 检查是否是单个原子拖拽（没有键，或者该原子没有连接其他原子）
          const atomBonds = stateRef.current.molecule.bonds.filter(
            b => b.atom1Id === clickedAtomId || b.atom2Id === clickedAtomId
          );
          // 如果这个原子是独立的（没有键）或者只有这个原子和一个H，我们认为是单个原子拖拽
          if (atomBonds.length === 0) {
            interactionRef.current.isSingleAtomDrag = true;
            interactionRef.current.singleAtomOriginalPosition = { ...atom!.position };
          } else {
            interactionRef.current.isSingleAtomDrag = false;
          }

          // 识别约束基团时，需要找到正确的 centerAtomId
          // 如果选中的有非H原子，用那个；否则找H的共同邻居C
          let centerAtomIdForRotation = clickedAtomId;
          
          // 检查选中的原子中是否有非H原子
          const hasNonH = newSelectedAtoms.some(id => {
            const a = stateRef.current.molecule.atoms.find(atom => atom.id === id);
            return a && a.symbol !== 'H';
          });
          
          if (hasNonH) {
            // 有非H原子，用那个
            const nonHAtom = newSelectedAtoms.find(id => {
              const a = stateRef.current.molecule.atoms.find(atom => atom.id === id);
              return a && a.symbol !== 'H';
            });
            if (nonHAtom) {
              centerAtomIdForRotation = nonHAtom;
            }
          } else {
            // 都是H，找共同邻居或连接路径
            const neighborMap = new Map<string, number>();
            const hCenters: string[] = []; // 每个H连接的非H邻居
            newSelectedAtoms.forEach(atomId => {
              const bonds = stateRef.current.molecule.bonds.filter(
                b => b.atom1Id === atomId || b.atom2Id === atomId
              );
              bonds.forEach(bond => {
                const neighborId = bond.atom1Id === atomId ? bond.atom2Id : bond.atom1Id;
                if (neighborId === null) return;
                const neighbor = stateRef.current.molecule.atoms.find(a => a.id === neighborId);
                if (neighbor && neighbor.symbol !== 'H') {
                  neighborMap.set(neighborId, (neighborMap.get(neighborId) || 0) + 1);
                  hCenters.push(neighborId);
                }
              });
            });
            
            // 优先找所有H的共同邻居
            for (const [neighborId, count] of neighborMap) {
              if (count === newSelectedAtoms.length) {
                centerAtomIdForRotation = neighborId;
                break;
              }
            }
            
            // 如果没有共同邻居，找H所在中心之间的连接键
            // 用被点击的H的中心作为旋转侧，另一个中心作为固定端
            if (centerAtomIdForRotation === clickedAtomId) {
              const clickedHBond = stateRef.current.molecule.bonds.find(
                b => b.atom1Id === clickedAtomId || b.atom2Id === clickedAtomId
              );
              if (clickedHBond) {
                const clickedCenter = clickedHBond.atom1Id === clickedAtomId ? clickedHBond.atom2Id : clickedHBond.atom1Id;
                if (clickedCenter !== null) {
                  const clickedCenterAtom = stateRef.current.molecule.atoms.find(a => a.id === clickedCenter);
                  if (clickedCenterAtom && clickedCenterAtom.symbol !== 'H') {
                    centerAtomIdForRotation = clickedCenter;
                  }
                }
              }
            }
          }

          console.log('[onMouseDown] centerAtomIdForRotation:', centerAtomIdForRotation);

          // 识别约束基团
          const groupInfo = identifyConstrainedGroup(centerAtomIdForRotation, newSelectedAtoms);
          console.log('[onMouseDown] groupInfo:', groupInfo);
          interactionRef.current.constrainedAtoms = groupInfo.atoms;
          interactionRef.current.rotationFixedAtomId = groupInfo.fixedAtomId;
          interactionRef.current.rotationAxis = groupInfo.rotationAxis;
          interactionRef.current.rotationCenterId = groupInfo.rotationCenterId;
          interactionRef.current.noRotation = groupInfo.noRotation || false;
          
          // 保存初始位置
          const initialPositions: Record<string, { x: number; y: number; z: number }> = {};
          for (const atomId of groupInfo.atoms) {
            const a = stateRef.current.molecule.atoms.find(a => a.id === atomId);
            if (a) {
              initialPositions[atomId] = { ...a.position };
            }
          }
          // 同时保存旋转中心的初始位置（如果存在且不在约束基团中）
          if (groupInfo.rotationCenterId && !initialPositions[groupInfo.rotationCenterId]) {
            const centerAtom = stateRef.current.molecule.atoms.find(a => a.id === groupInfo.rotationCenterId);
            if (centerAtom) {
              initialPositions[groupInfo.rotationCenterId] = { ...centerAtom.position };
            }
          }
          interactionRef.current.initialPositions = initialPositions;
          interactionRef.current.currentAtomPositions = { ...initialPositions };
          
          // 保存鼠标开始位置
          interactionRef.current.dragStartMousePosition = { x: e.clientX, y: e.clientY };
          interactionRef.current.lastMousePosition = { x: e.clientX, y: e.clientY };
          interactionRef.current.accumulatedAngle = 0;
          interactionRef.current.lastMouseAngle = 0;
          
          interactionRef.current.isDragging = true;
          interactionRef.current.dragMode = 'moveAtom';
        } else {
          selectAtomRef.current(null);
          setGyroSelectedAtomId(null);
          selectBondRef.current(null);
          updateSelectedAtomsRef.current([]);

          interactionRef.current.dragMode = 'rotateView';
          interactionRef.current.startSpherical = {
            theta: cameraSpherical.theta,
            phi: cameraSpherical.phi,
          };
          interactionRef.current.isDragging = true;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!cameraRef.current || activeDirectionRef.current) return;

      // 处理延迟启动的键拖拽
      if (interactionRef.current.pendingBondDrag) {
        const dx = e.clientX - interactionRef.current.dragStartMousePosition.x;
        const dy = e.clientY - interactionRef.current.dragStartMousePosition.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) {
          // 鼠标移动超过3像素，正式启动拖拽
          interactionRef.current.pendingBondDrag = false;
          interactionRef.current.isDragging = true;
          // 重新计算dragPlaneCenter，用当前鼠标位置
          const rect = container.getBoundingClientRect();
          const mouse = getMousePosition(e.clientX, e.clientY, rect);
          const bond = stateRef.current.molecule.bonds.find(b => b.id === interactionRef.current.draggedBondId);
          if (bond) {
            const pos1 = bond.atom1Id ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom1Id)?.position : bond.atom1Position;
            const pos2 = bond.atom2Id ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom2Id)?.position : bond.atom2Position;
            let bondCenterLocal = new THREE.Vector3(0, 0, 0);
            if (pos1 && pos2) {
              bondCenterLocal.set((pos1.x + pos2.x) / 2, (pos1.y + pos2.y) / 2, (pos1.z + pos2.z) / 2);
            } else if (pos1) {
              bondCenterLocal.set(pos1.x, pos1.y, pos1.z);
            } else if (pos2) {
              bondCenterLocal.set(pos2.x, pos2.y, pos2.z);
            }
            groupRef.current!.updateMatrixWorld();
            const bondCenterWorld = bondCenterLocal.clone();
            groupRef.current!.localToWorld(bondCenterWorld);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current!);
            const plane = new THREE.Plane();
            plane.setFromNormalAndCoplanarPoint(
              cameraRef.current!.getWorldDirection(new THREE.Vector3()).negate(),
              bondCenterWorld
            );
            const planeIntersection = new THREE.Vector3();
            raycaster.ray.intersectPlane(plane, planeIntersection);
            if (planeIntersection) {
              interactionRef.current.dragPlaneCenter.set(planeIntersection.x, planeIntersection.y, planeIntersection.z);
            }
          }
        } else {
          // 移动距离不够，继续等待
          return;
        }
      }

      // 非拖拽状态：检测悬停对象
      if (!interactionRef.current.isDragging) {
        const rect = container.getBoundingClientRect();
        const mouse = getMousePosition(e.clientX, e.clientY, rect);
        const atomId = findAtomAtPosition(mouse);
        const bondId = atomId ? null : findBondAtPosition(mouse);
        if (atomId) {
          setHoveredObject({ type: 'atom', id: atomId });
        } else if (bondId) {
          setHoveredObject({ type: 'bond', id: bondId });
        } else {
          setHoveredObject(null);
        }
        return;
      }

      const deltaX = e.clientX - interactionRef.current.previousPosition.x;
      const deltaY = e.clientY - interactionRef.current.previousPosition.y;

      if (interactionRef.current.dragMode === 'rotateView') {
        if (cameraRef.current && groupRef.current) {
          const sensitivity = 0.008;
          
          // 以当前屏幕方向为旋转轴（相机固定，屏幕右=+X，屏幕上=+Y）
          const quatY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * sensitivity);
          const quatX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -deltaY * sensitivity);
          
          // 在世界空间（屏幕空间）中旋转group
          groupRef.current.quaternion.premultiply(quatY);
          groupRef.current.quaternion.premultiply(quatX);
          
          // 从group.quaternion中提取新的moleculeRotation
          // group.quaternion = viewQuat * moleculeRotation
          // moleculeRotation = viewQuat.inverse() * group.quaternion
          moleculeRotationRef.current.copy(viewQuaternionRef.current.clone().invert().multiply(groupRef.current.quaternion));
        }
      } else if (interactionRef.current.dragMode === 'moveAtom' && interactionRef.current.draggedAtomId) {
        // 确保 matrixWorld 是最新的
        groupRef.current!.updateMatrixWorld();
        // 检查是单个原子拖拽还是基团拖拽/旋转
        if (interactionRef.current.isSingleAtomDrag) {
          // 单个原子拖拽：直接移动
          const rect = container.getBoundingClientRect();
          const mouse = getMousePosition(e.clientX, e.clientY, rect);

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);

          const plane = new THREE.Plane();
          plane.setFromNormalAndCoplanarPoint(
            cameraRef.current.getWorldDirection(new THREE.Vector3()).negate(),
            interactionRef.current.dragPlaneCenter
          );

          const intersection = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, intersection);

          if (intersection) {
            // 确保 matrixWorld 是最新的
            groupRef.current!.updateMatrixWorld();
            // 关键修复：将 raycaster 得到的世界坐标转换为 group 的局部坐标！
            const groupInvMatrix = new THREE.Matrix4().copy(groupRef.current!.matrixWorld).invert();
            const localIntersection = intersection.clone().applyMatrix4(groupInvMatrix);
            
            // 单原子拖拽：直接移动，检测附近有空余化合价的原子或键的空头
            const draggedAtom = stateRef.current.molecule.atoms.find(a => a.id === interactionRef.current.draggedAtomId);
            // 将射线与平面的交点作为目标位置（平面垂直于相机方向，过原子原始位置）
            // 这样无论什么视角，拖拽都在视图平面内进行
            let targetPos = { x: localIntersection.x, y: localIntersection.y, z: localIntersection.z };
            
            // 只检测键的空头吸附（不检测原子吸附——原子吸附需要用户手动用键工具创建）
            const nearbyBondResult = findNearbyBondEndpoint(
              targetPos,
              stateRef.current.molecule,
              [interactionRef.current.draggedAtomId] // 排除自己
            );
            
            if (nearbyBondResult.canSnap && nearbyBondResult.position) {
              // 吸附到键的空头位置
              targetPos = { ...nearbyBondResult.position };
              interactionRef.current.snapTargetAtomId = null;
              interactionRef.current.snapTargetBondId = nearbyBondResult.bondId;
              interactionRef.current.snapTargetEndpoint = nearbyBondResult.endpoint;
            } else {
              // 清除吸附目标
              interactionRef.current.snapTargetAtomId = null;
              interactionRef.current.snapTargetBondId = null;
              interactionRef.current.snapTargetEndpoint = null;
            }
            
            // 直接移动原子
            moveAtomWithConstraints(interactionRef.current.draggedAtomId, targetPos);
          }
        } else {
          // 基团拖拽/旋转
          moveConstrainedGroup(interactionRef.current.draggedAtomId, e.clientX, e.clientY);
        }
      } else if (interactionRef.current.dragMode === 'moveBond' && interactionRef.current.draggedBondId) {
        // 检查是单个键拖拽（有空头）还是端点拖拽
        if (interactionRef.current.isSingleBondDrag) {
          // 单个键拖拽：使用总位移+原始位置，避免stale state问题
          const rect = container.getBoundingClientRect();
          const mouse = getMousePosition(e.clientX, e.clientY, rect);

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);

          const plane = new THREE.Plane();
          plane.setFromNormalAndCoplanarPoint(
            cameraRef.current.getWorldDirection(new THREE.Vector3()).negate(),
            interactionRef.current.bondDragStartCenter  // 使用起始中心点计算总位移
          );

          const intersection = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, intersection);

          if (intersection) {
            // 确保 matrixWorld 是最新的
            groupRef.current!.updateMatrixWorld();
            // 将 raycaster 得到的世界坐标转换为 group 的局部坐标
            const groupInvMatrix = new THREE.Matrix4().copy(groupRef.current!.matrixWorld).invert();
            const localIntersection = intersection.clone().applyMatrix4(groupInvMatrix);
            const localDragStart = interactionRef.current.bondDragStartCenter.clone().applyMatrix4(groupInvMatrix);
            
            // 计算从拖拽开始的总位移（而非增量位移）
            let totalDelta = {
              x: localIntersection.x - localDragStart.x,
              y: localIntersection.y - localDragStart.y,
              z: localIntersection.z - localDragStart.z
            };
            
            const bond = stateRef.current.molecule.bonds.find(b => b.id === interactionRef.current.draggedBondId);
            if (bond) {
              // 使用原始位置+总位移计算投影位置
              const origPos1 = interactionRef.current.bondOriginalAtom1Position;
              const origPos2 = interactionRef.current.bondOriginalAtom2Position;
              
              const testPos1 = {
                x: origPos1.x + totalDelta.x,
                y: origPos1.y + totalDelta.y,
                z: origPos1.z + totalDelta.z
              };
              const testPos2 = {
                x: origPos2.x + totalDelta.x,
                y: origPos2.y + totalDelta.y,
                z: origPos2.z + totalDelta.z
              };
              
              // 检测吸附目标（用于 mouseup 时处理）
              interactionRef.current.snapTarget1 = null;
              interactionRef.current.snapTarget2 = null;
              
              // 检查端点1是否进入原子球内
              const excludeIds1 = [bond.atom2Id].filter(Boolean) as string[];
              const nearbyAtom1 = findNearbyAtomWithFreeValence(testPos1, stateRef.current.molecule, excludeIds1);
              if (nearbyAtom1.canSnap && nearbyAtom1.targetAtomId && nearbyAtom1.targetAtomId !== bond.atom1Id) {
                interactionRef.current.snapTarget1 = {
                  atomId: nearbyAtom1.targetAtomId,
                  position: testPos1
                };
              }
              
              // 检查端点2是否进入原子球内
              const excludeIds2 = [bond.atom1Id].filter(Boolean) as string[];
              const nearbyAtom2 = findNearbyAtomWithFreeValence(testPos2, stateRef.current.molecule, excludeIds2);
              if (nearbyAtom2.canSnap && nearbyAtom2.targetAtomId && nearbyAtom2.targetAtomId !== bond.atom2Id) {
                interactionRef.current.snapTarget2 = {
                  atomId: nearbyAtom2.targetAtomId,
                  position: testPos2
                };
              }
              
              // 使用原始位置+总位移移动所有刚性基团原子（避免stale state问题）
              const origPositions = interactionRef.current.rigidGroupOriginalPositions;
              for (const [atomId, origPos] of Object.entries(origPositions)) {
                updateAtomPositionRef.current(atomId, {
                  x: origPos.x + totalDelta.x,
                  y: origPos.y + totalDelta.y,
                  z: origPos.z + totalDelta.z
                });
              }
              
              // 移动空头位置（当前键的空头）
              if (bond.atom1Id === null) {
                updateBondPositionRef.current!(bond.id, {
                  atom1Position: {
                    x: origPos1.x + totalDelta.x,
                    y: origPos1.y + totalDelta.y,
                    z: origPos1.z + totalDelta.z
                  }
                });
              }
              if (bond.atom2Id === null) {
                updateBondPositionRef.current!(bond.id, {
                  atom2Position: {
                    x: origPos2.x + totalDelta.x,
                    y: origPos2.y + totalDelta.y,
                    z: origPos2.z + totalDelta.z
                  }
                });
              }
              
              // 移动刚性基团中其他键的空头位置
              const emptyBondPositions = interactionRef.current.rigidGroupEmptyBondPositions;
              for (const entry of Object.values(emptyBondPositions)) {
                const newPos = {
                  x: entry.originalPosition.x + totalDelta.x,
                  y: entry.originalPosition.y + totalDelta.y,
                  z: entry.originalPosition.z + totalDelta.z
                };
                if (entry.endpoint === 'atom1') {
                  updateBondPositionRef.current!(entry.bondId, { atom1Position: newPos });
                } else {
                  updateBondPositionRef.current!(entry.bondId, { atom2Position: newPos });
                }
              }
              
              // 不更新 dragPlaneCenter，保持使用起始中心点计算总位移
            }
          }
        } else {
          // 端点拖拽
          const rect = container.getBoundingClientRect();
          const mouse = getMousePosition(e.clientX, e.clientY, rect);

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, cameraRef.current);

          const plane = new THREE.Plane();
          plane.setFromNormalAndCoplanarPoint(
            cameraRef.current.getWorldDirection(new THREE.Vector3()).negate(),
            interactionRef.current.dragPlaneCenter
          );

          const intersection = new THREE.Vector3();
          raycaster.ray.intersectPlane(plane, intersection);

          if (intersection) {
            // 确保 matrixWorld 是最新的
            groupRef.current!.updateMatrixWorld();
            // 关键修复：将 raycaster 得到的世界坐标转换为 group 的局部坐标！
            const groupInvMatrix = new THREE.Matrix4().copy(groupRef.current!.matrixWorld).invert();
            const localIntersection = intersection.clone().applyMatrix4(groupInvMatrix);
            
            moveBondEndpointOnSphere(
              interactionRef.current.draggedBondId,
              interactionRef.current.draggedBondEndpoint!,
              { x: localIntersection.x, y: localIntersection.y, z: localIntersection.z }
            );
          }
        }
      } else if (interactionRef.current.dragMode === 'moveBondEndpoint' && interactionRef.current.selectedBondEndpoint) {
        // 键端小球自由拖拽
        const rect2 = container.getBoundingClientRect();
        const mouse2 = getMousePosition(e.clientX, e.clientY, rect2);

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse2, cameraRef.current);

        const plane = new THREE.Plane();
        plane.setFromNormalAndCoplanarPoint(
          cameraRef.current.getWorldDirection(new THREE.Vector3()).negate(),
          interactionRef.current.dragPlaneCenter
        );

        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (intersection && groupRef.current) {
          groupRef.current.updateMatrixWorld();
          const groupInvMatrix = new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert();
          const localIntersection = intersection.clone().applyMatrix4(groupInvMatrix);

          // 直接更新场景中该键端小球 mesh 的位置（视觉自由移动）
          const bondId = interactionRef.current.selectedBondEndpoint.bondId;
          const endKey = interactionRef.current.selectedBondEndpoint.end;
          for (const child of groupRef.current.children) {
            if (child.userData.type === 'bondEndpoint' &&
                child.userData.id === bondId &&
                child.userData.end === endKey) {
              child.position.set(localIntersection.x, localIntersection.y, localIntersection.z);
              break;
            }
          }
        }
      } else if (interactionRef.current.dragMode === 'moveRef' && interactionRef.current.draggedRef) {
        // 移动参考线或平面，沿着法线方向
        const dx = e.clientX - interactionRef.current.previousPosition.x;
        const dy = e.clientY - interactionRef.current.previousPosition.y;
        
        // 计算3D位移
        const worldDir = cameraRef.current.getWorldDirection(new THREE.Vector3());
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), worldDir).normalize();
        if (right.length() < 0.1) {
          right.crossVectors(new THREE.Vector3(1, 0, 0), worldDir).normalize();
        }
        const up = new THREE.Vector3().crossVectors(worldDir, right).normalize();

        const moveScale = 0.05; // 稍微大一点的缩放系数
        const moveDelta = {
          x: (-dx * right.x + dy * up.x) * moveScale,
          y: (-dx * right.y + dy * up.y) * moveScale,
          z: (-dx * right.z + dy * up.z) * moveScale,
        };

        // 计算移动向量在法线方向的投影
        const normal = interactionRef.current.refNormal;
        const dot = moveDelta.x * normal.x + moveDelta.y * normal.y + moveDelta.z * normal.z;
        
        // 沿着法线方向移动
        if (interactionRef.current.draggedRef) {
          const ref = interactionRef.current.draggedRef;
          const initialPos = interactionRef.current.initialRefPosition;
          
          // 新的位置 = 初始位置 + 法线方向的距离
          const moveDistance = dot;
          ref.position.x = initialPos.x + normal.x * moveDistance;
          ref.position.y = initialPos.y + normal.y * moveDistance;
          ref.position.z = initialPos.z + normal.z * moveDistance;
        }
      }

      interactionRef.current.previousPosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = (e: MouseEvent) => {
      if (activeDirectionRef.current) return;

      // 键端小球释放：恢复原始位置和颜色
      if (interactionRef.current.bondEndpointIsDragging &&
          interactionRef.current.selectedBondEndpoint &&
          groupRef.current) {
        const bondId = interactionRef.current.selectedBondEndpoint.bondId;
        const endKey = interactionRef.current.selectedBondEndpoint.end;
        const origPos = interactionRef.current.bondEndpointOriginalPosition;
        const origColor = interactionRef.current.bondEndpointOriginalColor;
        for (const child of groupRef.current.children) {
          if (child.userData.type === 'bondEndpoint' &&
              child.userData.id === bondId &&
              child.userData.end === endKey) {
            child.position.set(origPos.x, origPos.y, origPos.z);
            const mat = (child as THREE.Mesh).material as THREE.MeshPhongMaterial;
            if (mat) {
              mat.color.setHex(origColor);
            }
            break;
          }
        }
      }

      const rect = container.getBoundingClientRect();
      const mouse = getMousePosition(e.clientX, e.clientY, rect);

      if (draggedAtomRef.current && cameraRef.current && groupRef.current) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        const plane = new THREE.Plane();
        plane.setFromNormalAndCoplanarPoint(
          cameraRef.current.getWorldDirection(new THREE.Vector3()).negate(),
          new THREE.Vector3(0, 0, 0)
        );

        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersection);

        if (intersection) {
          const targetPos = { x: intersection.x, y: intersection.y, z: intersection.z };
          const safePos = calculateSafeAtomPosition(draggedAtomRef.current, targetPos);
          addAtomRef.current(draggedAtomRef.current, safePos);
        }
        clearDragRef.current();
      } else if (draggedBondOrderRef.current && bondStartAtomRef.current) {
        const clickedAtomId = findAtomAtPosition(mouse);
        if (clickedAtomId && clickedAtomId !== bondStartAtomRef.current) {
          addBondRef.current(bondStartAtomRef.current, clickedAtomId, draggedBondOrderRef.current);
        }
        clearDragRef.current();
      }

      // 处理插入原子模式
      if (interactionRef.current.insertAtomPending && interactionRef.current.insertAtomPosition) {
        const insertSymbol = stateRef.current.insertAtomSymbol;
        if (insertSymbol) {
          const safePos = calculateSafeAtomPosition(insertSymbol, interactionRef.current.insertAtomPosition);
          addAtomRef.current(insertSymbol, safePos);
          setInsertAtomRef.current(null);
        }
        interactionRef.current.insertAtomPending = false;
        interactionRef.current.insertAtomPosition = null;
      }

      // 处理插入官能团模式
      if (interactionRef.current.insertFunctionalGroupPending && interactionRef.current.insertFunctionalGroupPosition) {
        const groupId = stateRef.current.insertFunctionalGroupId;
        if (groupId) {
          insertFunctionalGroupRef.current(groupId, interactionRef.current.insertFunctionalGroupPosition);
          setInsertFunctionalGroupRef.current(null);
        }
        interactionRef.current.insertFunctionalGroupPending = false;
        interactionRef.current.insertFunctionalGroupPosition = null;
      }

      // 处理插入键模式
      if (interactionRef.current.insertBondPending && interactionRef.current.insertBondPosition) {
        const insertOrder = stateRef.current.insertBondOrder;
        if (insertOrder) {
          insertSingleBond(insertOrder, interactionRef.current.insertBondPosition);
          setInsertBondRef.current(null);
        }
        interactionRef.current.insertBondPending = false;
        interactionRef.current.insertBondPosition = null;
      }

      // 处理键端点吸附到原子并添加键
      if (!interactionRef.current.isSingleBondDrag && interactionRef.current.draggedBondId && interactionRef.current.draggedBondEndpoint) {
        const bond = stateRef.current.molecule.bonds.find(b => b.id === interactionRef.current.draggedBondId);
        if (bond) {
          const movingAtomId = interactionRef.current.draggedBondEndpoint === 'atom1' ? bond.atom1Id : bond.atom2Id;
          if (movingAtomId === null) return;
          const movingAtom = stateRef.current.molecule.atoms.find(a => a.id === movingAtomId);
          if (movingAtom) {
            const excludeIds = [];
            if (bond.atom1Id !== null) excludeIds.push(bond.atom1Id);
            if (bond.atom2Id !== null) excludeIds.push(bond.atom2Id);
            const nearbyResult = findNearbyAtomWithFreeValence(
              movingAtom.position, 
              stateRef.current.molecule,
              excludeIds
            );
            
            if (nearbyResult.canSnap && nearbyResult.targetAtomId) {
              // 检查这两个原子是否已经有键
              const existingBond = stateRef.current.molecule.bonds.find(
                b => (b.atom1Id === movingAtomId && b.atom2Id === nearbyResult.targetAtomId) ||
                     (b.atom1Id === nearbyResult.targetAtomId && b.atom2Id === movingAtomId)
              );
              
              if (!existingBond) {
                // 没有键的话，添加新键
                addBondRef.current(movingAtomId, nearbyResult.targetAtomId, bond.order);
              }
            }
          }
        }
      }
      
      // 处理单个原子拖拽回退和键吸附
      if (interactionRef.current.isSingleAtomDrag && interactionRef.current.draggedAtomId) {
        const atom = stateRef.current.molecule.atoms.find(a => a.id === interactionRef.current.draggedAtomId);
        if (atom) {
          // 先检查是否有冲突
          const hasCollision = checkSingleAtomCollision(interactionRef.current.draggedAtomId, atom.position);
          
          if (hasCollision) {
            // 有冲突，回退到原始位置
            updateAtomPositionRef.current(
              interactionRef.current.draggedAtomId, 
              interactionRef.current.singleAtomOriginalPosition
            );
          } else {
            // 没有冲突，检查是否有吸附的目标
            
            // 优先检查是否吸附到键的空头
            if (interactionRef.current.snapTargetBondId && interactionRef.current.snapTargetEndpoint) {
              // 吸附到键的空头：将原子绑定到键的空头位置
              const bond = stateRef.current.molecule.bonds.find(b => b.id === interactionRef.current.snapTargetBondId);
              if (bond) {
                // 调整原子位置，使其与键的另一端保持正确的键长
                let bondLength = BOND_LENGTH;
                const otherAtomId = interactionRef.current.snapTargetEndpoint === 'atom1' ? bond.atom2Id : bond.atom1Id;
                const otherAtom = otherAtomId !== null ? stateRef.current.molecule.atoms.find(a => a.id === otherAtomId) : null;
                
                if (otherAtom) {
                  // 计算到另一端原子的距离
                  const dx = atom.position.x - otherAtom.position.x;
                  const dy = atom.position.y - otherAtom.position.y;
                  const dz = atom.position.z - otherAtom.position.z;
                  const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
                  
                  if (currentLength > 0.01) {
                    // 如果距离不是默认键长，则调整位置
                    const scale = bondLength / currentLength;
                    const newPos = {
                      x: otherAtom.position.x + dx * scale,
                      y: otherAtom.position.y + dy * scale,
                      z: otherAtom.position.z + dz * scale
                    };
                    updateAtomPositionRef.current(atom.id, newPos);
                  }
                }
                
                // 根据吸附端点更新键：将 atomId 设置为被吸附的原子，清除空头位置
                bindAtomToBondEndpointRef.current(
                  bond.id,
                  atom.id,
                  interactionRef.current.snapTargetEndpoint
                );
                
                // 拼接方案：公团（A=被拖拽原子）刚体平移到标准键长，母团（B=键另一端）只重排H和空头键
                // A = 被拖拽原子（官能团侧），B = 键另一端原子（目标侧）
                const draggedAtomId = atom.id;
                setTimeout(() => {
                  if (otherAtomId) {
                    // 1. 公团A刚体平移：沿B→A方向移动A到标准键长，A的子树同步平移，检测冲突并旋转规避
                    adjustAtomPreserveSubtree(
                      stateRef.current.molecule,
                      draggedAtomId,
                      otherAtomId,
                      updateAtomPositionRef.current,
                      updateBondPositionRef.current
                    );
                    // 2. 母团B：只重排H和空头键，重原子不动
                    optimizeGeometryAroundAtom(
                      stateRef.current.molecule,
                      otherAtomId,
                      updateAtomPositionRef.current,
                      updateBondPositionRef.current,
                      new Set([draggedAtomId]) // 排除A，A不动
                    );
                  } else {
                    optimizeGeometryAroundAtom(
                      stateRef.current.molecule,
                      draggedAtomId,
                      updateAtomPositionRef.current,
                      updateBondPositionRef.current
                    );
                  }
                  // 拼接后刚性约束检查日志
                  const result = validateMolecule(stateRef.current.molecule);
                  console.log('=== 拼接后刚性约束检查（原子拖拽）===');
                  console.log(`  原子数: ${stateRef.current.molecule.atoms.length}, 键数: ${stateRef.current.molecule.bonds.length}`);
                  console.log(`  检查结果: ${result.isValid ? '✅ 通过' : '❌ 有问题'}`);
                  if (result.issues.length > 0) {
                    result.issues.forEach((issue, i) => {
                      console.log(`  [${i + 1}] ${issue.type}: ${issue.message}`);
                    });
                  }
                }, 50);
              }
            } else if (interactionRef.current.snapTargetAtomId) {
              // 原子靠近有空余化合价的原子：只吸附位置，不自动成键
              // 用户需要手动使用键工具来创建化学键
            }
          }
        }
      }
      
      // 处理单个键拖拽回退和吸附
      if (interactionRef.current.isSingleBondDrag && interactionRef.current.draggedBondId) {
        const bond = stateRef.current.molecule.bonds.find(b => b.id === interactionRef.current.draggedBondId);
        if (bond) {
          // 检查是否有吸附目标
          let hasAdsorbed = false;
          
          // 处理端点1吸附
          if (interactionRef.current.snapTarget1) {
            if (bond.atom1Id === null) {
              // 空头：绑定原子到键端点
              bindAtomToBondEndpointRef.current(
                bond.id,
                interactionRef.current.snapTarget1.atomId,
                'atom1'
              );
              hasAdsorbed = true;
            } else if (bond.atom1Id !== interactionRef.current.snapTarget1.atomId) {
              // 有原子的端点：在两个原子之间添加化学键
              const existingBond = stateRef.current.molecule.bonds.find(
                b => (b.atom1Id === bond.atom1Id && b.atom2Id === interactionRef.current.snapTarget1!.atomId) ||
                     (b.atom1Id === interactionRef.current.snapTarget1!.atomId && b.atom2Id === bond.atom1Id)
              );
              if (!existingBond) {
                addBondRef.current(bond.atom1Id, interactionRef.current.snapTarget1.atomId, bond.order);
              }
              hasAdsorbed = true;
            }
          }
          
          // 处理端点2吸附
          if (interactionRef.current.snapTarget2) {
            if (bond.atom2Id === null) {
              // 空头：绑定原子到键端点
              bindAtomToBondEndpointRef.current(
                bond.id,
                interactionRef.current.snapTarget2.atomId,
                'atom2'
              );
              hasAdsorbed = true;
            } else if (bond.atom2Id !== interactionRef.current.snapTarget2.atomId) {
              // 有原子的端点：在两个原子之间添加化学键
              const existingBond = stateRef.current.molecule.bonds.find(
                b => (b.atom1Id === bond.atom2Id && b.atom2Id === interactionRef.current.snapTarget2!.atomId) ||
                     (b.atom1Id === interactionRef.current.snapTarget2!.atomId && b.atom2Id === bond.atom2Id)
              );
              if (!existingBond) {
                addBondRef.current(bond.atom2Id, interactionRef.current.snapTarget2.atomId, bond.order);
              }
              hasAdsorbed = true;
            }
          }
          
          // 如果吸附成功，优化目标原子周围的几何结构
          if (hasAdsorbed) {
            // 拼接方案：公团（A=键另一端已连接原子）刚体平移，母团（B=吸附目标原子）只重排H和空头键
            const targetAtoms = new Set<string>(); // B（母团）
            if (interactionRef.current.snapTarget1) {
              targetAtoms.add(interactionRef.current.snapTarget1.atomId);
            }
            if (interactionRef.current.snapTarget2) {
              targetAtoms.add(interactionRef.current.snapTarget2.atomId);
            }
            const otherAtoms = new Set<string>(); // A（公团）
            if (bond.atom1Id) otherAtoms.add(bond.atom1Id);
            if (bond.atom2Id) otherAtoms.add(bond.atom2Id);
            setTimeout(() => {
              // 1. 公团A刚体平移：沿B→A方向移动A到标准键长，检测冲突并旋转规避
              for (const atomId of otherAtoms) {
                if (!targetAtoms.has(atomId)) {
                  let anchorId: string | null = null;
                  if (interactionRef.current.snapTarget1 && bond.atom1Id === atomId) {
                    anchorId = interactionRef.current.snapTarget1.atomId;
                  } else if (interactionRef.current.snapTarget2 && bond.atom2Id === atomId) {
                    anchorId = interactionRef.current.snapTarget2.atomId;
                  } else {
                    anchorId = targetAtoms.values().next().value || null;
                  }
                  if (anchorId) {
                    adjustAtomPreserveSubtree(
                      stateRef.current.molecule,
                      atomId,
                      anchorId,
                      updateAtomPositionRef.current,
                      updateBondPositionRef.current
                    );
                  }
                }
              }
              // 2. 母团B：只重排H和空头键，重原子不动
              for (const atomId of targetAtoms) {
                optimizeGeometryAroundAtom(
                  stateRef.current.molecule,
                  atomId,
                  updateAtomPositionRef.current,
                  updateBondPositionRef.current,
                  otherAtoms // 排除A，A不动
                );
              }
              // 拼接后刚性约束检查日志
              const result = validateMolecule(stateRef.current.molecule);
              console.log('=== 拼接后刚性约束检查（键拖拽）===');
              console.log(`  原子数: ${stateRef.current.molecule.atoms.length}, 键数: ${stateRef.current.molecule.bonds.length}`);
              console.log(`  检查结果: ${result.isValid ? '✅ 通过' : '❌ 有问题'}`);
              if (result.issues.length > 0) {
                result.issues.forEach((issue, i) => {
                  console.log(`  [${i + 1}] ${issue.type}: ${issue.message}`);
                });
              }
            }, 50);
          }
          
          // 如果没有吸附，检查是否有冲突并回退
          if (!hasAdsorbed) {
            const atom1 = bond.atom1Id !== null ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom1Id) : null;
            const atom2 = bond.atom2Id !== null ? stateRef.current.molecule.atoms.find(a => a.id === bond.atom2Id) : null;
            
            // 检查冲突，只有两个都是真实原子时才检查
            if (atom1 && atom2) {
              const hasCollision = checkSingleBondCollision(
                interactionRef.current.draggedBondId,
                atom1.position,
                atom2.position
              );
              
              if (hasCollision) {
                // 有冲突，回退到原始位置
                if (bond.atom1Id !== null) {
                  updateAtomPositionRef.current(bond.atom1Id, interactionRef.current.bondOriginalAtom1Position);
                } else if (bond.atom1Position) {
                  updateBondPositionRef.current!(bond.id, { atom1Position: interactionRef.current.bondOriginalAtom1Position });
                }
                
                if (bond.atom2Id !== null) {
                  updateAtomPositionRef.current(bond.atom2Id, interactionRef.current.bondOriginalAtom2Position);
                } else if (bond.atom2Position) {
                  updateBondPositionRef.current!(bond.id, { atom2Position: interactionRef.current.bondOriginalAtom2Position });
                }
              }
            }
          }
        }
      }

      interactionRef.current.isDragging = false;
      interactionRef.current.pendingBondDrag = false;
      interactionRef.current.draggedAtomId = null;
      interactionRef.current.draggedBondId = null;
      interactionRef.current.draggedBondEndpoint = null;
      interactionRef.current.draggedRefType = null;
      interactionRef.current.draggedRef = null;
      // 清理单个原子/键拖拽状态
      interactionRef.current.isSingleAtomDrag = false;
      interactionRef.current.isSingleBondDrag = false;
      interactionRef.current.snapTargetAtomId = null;
      interactionRef.current.snapTargetBondId = null;
      interactionRef.current.snapTargetEndpoint = null;
      interactionRef.current.snapTarget1 = null;
      interactionRef.current.snapTarget2 = null;
      // 清理旋转相关状态
      interactionRef.current.rotationFixedAtomId = null;
      interactionRef.current.rotationAxis = null;
      // 只清理拖拽状态，保留键端小球的选中态（变绿后持续保持）
      interactionRef.current.bondEndpointIsDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        onMouseDown({
          clientX: touch.clientX,
          clientY: touch.clientY
        } as MouseEvent);
      }
      // 双指触摸不做特殊处理，完全由 wheel 事件处理
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        onMouseMove({
          clientX: touch.clientX,
          clientY: touch.clientY
        } as MouseEvent);
      }
      // 双指触摸移动完全由 wheel 事件处理，避免冲突
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 0) {
        const lastTouch = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;
        onMouseUp({
          clientX: lastTouch?.clientX || 0,
          clientY: lastTouch?.clientY || 0
        } as MouseEvent);
      }
    };

    // 添加 wheel 事件支持 - 用于笔记本电脑触摸板双指滑动
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      if (e.ctrlKey || interactionRef.current.isDragging) return;
      
      if (cameraRef.current && groupRef.current) {
        // 限制 delta 值，防止跳变
        const clampedDeltaX = Math.max(-50, Math.min(50, e.deltaX));
        const clampedDeltaY = Math.max(-50, Math.min(50, e.deltaY));
        
        const sensitivity = 0.003;
        
        // 双指滑动调整视角方向
        // 原则3：右滑→南→东，下滑→南→上
        // 用世界空间的固定轴旋转：rotY(0,1,0) 绕世界Y轴，rotX(1,0,0) 绕世界X轴
        const quatY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -clampedDeltaX * sensitivity);
        const quatX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -clampedDeltaY * sensitivity);
        
        // 保存旧的viewQuat用于补偿计算
        const viewOld = viewQuaternionRef.current.clone();
        
        // 应用旋转到viewQuaternion
        viewQuaternionRef.current.premultiply(quatY);
        viewQuaternionRef.current.premultiply(quatX);
        
        // 原则7：分子旋转方向与双指滑动方向相反
        // 视觉旋转 = group.new / group.old = quatX * quatY
        // 期望视觉旋转 = quatX * quatY.invert()（水平反向，垂直不变）
        // 推导：moleculeRotation.new = viewOld.invert() * quatYInv² * viewOld * moleculeRotation.old
        // 共轭变换确保补偿在分子本地空间正确，不受当前视角影响
        const quatYInv = quatY.clone().invert();
        const quatYInv2 = quatYInv.clone().multiply(quatYInv);
        const compensation = viewOld.clone().invert().multiply(quatYInv2).multiply(viewOld);
        moleculeRotationRef.current.copy(compensation.multiply(moleculeRotationRef.current.clone()));
        
        // 同步到cameraSpherical供万向仪显示
        syncViewToSpherical();
        
        updateGroupQuaternion();
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd, { passive: false });
    
    // 添加 wheel 事件监听器 - 用于笔记本电脑触摸板双指滑动
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      const newAspect = newWidth / newHeight;
      
      if (cameraRef.current instanceof THREE.OrthographicCamera) {
        const baseFrustumSize = 8;
        const frustumSize = baseFrustumSize * (100 / zoomLevelRef.current);
        cameraRef.current.left = -frustumSize * newAspect / 2;
        cameraRef.current.right = frustumSize * newAspect / 2;
        cameraRef.current.top = frustumSize / 2;
        cameraRef.current.bottom = -frustumSize / 2;
        cameraRef.current.updateProjectionMatrix();
      }
      
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (stateRef.current.selectedBond) {
          removeBondRef.current(stateRef.current.selectedBond);
          selectBondRef.current(null);
        } else if (stateRef.current.selectedAtom) {
          removeAtomRef.current(stateRef.current.selectedAtom);
          selectAtomRef.current(null);
        }
      } else if (event.key === 'Escape') {
        selectAtomRef.current(null);
        setGyroSelectedAtomId(null);
        selectBondRef.current(null);
        updateSelectedAtomsRef.current([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);

      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      
      // 移除 wheel 事件监听器
      renderer.domElement.removeEventListener('wheel', onWheel);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [isDarkMode]);

  // 分离的useEffect 2: 更新分子显示（状态变化时调用，不重新创建场景）
  useEffect(() => {
    if (!groupRef.current) return;
    updateMoleculeDisplay();
  }, [state.molecule, state.selectedAtom, state.selectedBond, state.selectedAtoms, showLabels, updateMoleculeDisplay]);

  useEffect(() => {
    setShowGyroscopeRotation(false);
  }, [state.molecule]);

  // 监听 cameraSpherical 变化并更新相机位置
  useEffect(() => {
    cameraSphericalRef.current = cameraSpherical;
    updateCameraFromSpherical();
  }, [cameraSpherical, updateCameraFromSpherical]);

  // 监听 zoomLevel 变化并更新相机 frustumSize
  useEffect(() => {
    if (!cameraRef.current || !(cameraRef.current instanceof THREE.OrthographicCamera)) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const aspect = container.clientWidth / container.clientHeight;
    const baseFrustumSize = 8;
    const frustumSize = baseFrustumSize * (100 / zoomLevel);
    
    cameraRef.current.left = -frustumSize * aspect / 2;
    cameraRef.current.right = frustumSize * aspect / 2;
    cameraRef.current.top = frustumSize / 2;
    cameraRef.current.bottom = -frustumSize / 2;
    cameraRef.current.updateProjectionMatrix();
    cameraRef.current.updateMatrixWorld(); // 关键：确保 matrixWorldInverse 是最新的
  }, [zoomLevel]);

  const resetView = () => {
    // 重置视角四元数到默认（identity，看向南方+Z）
    viewQuaternionRef.current.identity();
    // 同步到cameraSpherical
    syncViewToSpherical();
    // 重置分子旋转
    moleculeRotationRef.current.identity();
    if (groupRef.current) {
      updateGroupQuaternion();
    }
    updateCameraFromSpherical();
    stopRotationAnimation();
    setShowGyroscopeRotation(false);
    setGyroscopeResetKey(k => k + 1);
  };

  // 切换视角到指定方向
  const handleViewDirection = (direction: 'east' | 'west' | 'up' | 'down' | 'south' | 'north') => {
    // 方向定义（原则1）：+Z=南(屏幕内侧)，-Z=北(屏幕外侧)，-X=东，+X=西，+Y=上，-Y=下
    // 目标viewQuat使视野方向(viewQuat.invert()*(0,0,1))指向目标方向
    let targetViewQuat: THREE.Quaternion;
    switch (direction) {
      case 'south': // 视野指向-Z(南)，不需要旋转
        targetViewQuat = new THREE.Quaternion();
        break;
      case 'north': // 视野指向+Z(北)，绕Y旋转π
        targetViewQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        break;
      case 'east': // 视野指向-X(东)，绕Y旋转π/2
        targetViewQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        break;
      case 'west': // 视野指向+X(西)，绕Y旋转-π/2
        targetViewQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        break;
      case 'up': // 视野指向+Y(上)，绕X旋转π/2
        targetViewQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        break;
      case 'down': // 视野指向-Y(下)，绕X旋转-π/2
        targetViewQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        break;
      default:
        return;
    }
    
    const currentViewQuat = viewQuaternionRef.current.clone();
    
    // 检测是否为180°逆转
    const currentDir = getViewDirectionFromQuat(currentViewQuat);
    const opposites: Record<string, string> = { 'east': 'west', 'west': 'east', 'up': 'down', 'down': 'up', 'south': 'north', 'north': 'south' };
    const isOpposite = currentDir === opposites[direction];
    
    if (isOpposite) {
      // 180°逆转：沿当前屏幕水平轴（右轴）往前翻滚
      // 屏幕右轴 = viewQuat.invert() * (1,0,0)（观察者右方在世界空间中的方向）
      // 右乘 Q(screenRight, -π) 让 viewDir 绕屏幕右轴旋转π
      const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentViewQuat.clone().invert());
      const flipQuat = new THREE.Quaternion().setFromAxisAngle(screenRight, -Math.PI);
      viewQuaternionRef.current.copy(currentViewQuat.clone().multiply(flipQuat));
    } else {
      // 非180°：直接设置目标视角四元数
      viewQuaternionRef.current.copy(targetViewQuat);
    }
    
    // 同步到cameraSpherical
    syncViewToSpherical();
    updateGroupQuaternion();
    updateCameraFromSpherical();
    stopRotationAnimation();
    setShowGyroscopeRotation(false);
  };

  const resetGroupRotation = () => {
    if (!groupRef.current || !state.molecule.atoms.length) return;
    moleculeRotationRef.current.identity();
    updateGroupQuaternion();
  };

  const getCursor = () => {
    if (interactionRef.current.isDragging) {
      if (interactionRef.current.dragMode === 'rotateView') return 'grabbing';
      if (interactionRef.current.dragMode === 'moveAtom' || interactionRef.current.dragMode === 'moveBond') return 'move';
    }
    if (hoveredObject) return 'pointer';
    return 'default';
  };

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ cursor: getCursor() }}
      />

      {/* 消息提示 */}
      {message && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm z-10">
          {message}
        </div>
      )}

      {/* 控制按钮 - 左侧 */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <button
          onClick={resetView}
          className="px-3 py-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          重置视角
        </button>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-3 py-2 text-white rounded-lg text-sm transition-colors ${
            showLabels ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-800/80 hover:bg-gray-700'
          }`}
        >
          {showLabels ? '隐藏标签' : '显示标签'}
        </button>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={`px-3 py-2 text-white rounded-lg text-sm transition-colors ${
            isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-800/80 hover:bg-gray-700'
          }`}
        >
          {isDarkMode ? '浅色模式' : '深色模式'}
        </button>
      </div>

      {/* 万向仪 - 左下角 */}
      <div style={{ position: 'absolute', left: '10px', bottom: '10px' }}>
        <Gyroscope 
          sphericalRef={cameraSphericalRef}
          viewQuaternionRef={viewQuaternionRef}
          isDarkMode={isDarkMode} 
          showRotation={showGyroscopeRotation}
          resetKey={gyroscopeResetKey}
          onViewDirection={handleViewDirection}
          selectedAtomId={gyroSelectedAtomId}
          moleculeAtoms={state.molecule.atoms}
          moleculeRotationRef={moleculeRotationRef}
          moleculeGroupRef={groupRef as React.MutableRefObject<THREE.Group | null>}
        />
      </div>





    </div>
  );
}

