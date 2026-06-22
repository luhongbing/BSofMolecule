import { useState, useRef, useEffect } from 'react';
import { useMolecule } from '../context/MoleculeContext';
import { useDrag } from '../context/DragContext';
import { PRESET_MOLECULES } from '../utils/presets';
import { MOLECULE_CREATORS } from '../utils/molecules';
import { parseSmilesToMolecule } from '../utils/smilesParser';
import type { ToolType } from '../types';

const TOOLS: { type: ToolType; label: string; icon: JSX.Element }[] = [
  { type: 'edit', label: '编辑', icon: <span style={{ fontSize: '13px', lineHeight: '1' }}>○-○</span> },
  { type: 'analyze', label: '分析', icon: <span style={{ fontSize: '14px', lineHeight: '1' }}>-○-</span> },
];

import { DEFAULT_TOOLBAR_ELEMENTS, getElementColor, getElement, ELEMENTS } from '../utils/elements';
import { FUNCTIONAL_GROUPS, FUNCTIONAL_GROUP_CATEGORIES } from '../utils/functionalGroups';

const ATOMS = DEFAULT_TOOLBAR_ELEMENTS.slice(0, 7).map(symbol => {
  const elem = getElement(symbol)!;
  return { symbol, label: elem.name, color: getElementColor(symbol) };
});

const ALL_ATOMS = ELEMENTS.map(elem => ({
  symbol: elem.symbol,
  name: elem.name,
  color: getElementColor(elem.symbol),
}));

const BONDS = [
  { order: 1, label: '单键', symbol: '—' },
  { order: 2, label: '双键', symbol: '=' },
  { order: 3, label: '三键', symbol: '≡' },
];

interface ToolbarProps {
  onOpenSmilesSearch: () => void;
  onOpenAtomSelect: () => void;
}

export function Toolbar({ onOpenSmilesSearch, onOpenAtomSelect }: ToolbarProps) {
  const { state, setTool, setInsertAtom, setInsertBond, clearMolecule, setMolecule, removeAtom, removeBond, selectAtom, selectBond, setInsertFunctionalGroup } = useMolecule();
  const { startDragAtom, startDragBond } = useDrag();
  const [showPresets, setShowPresets] = useState(false);
  const [searchSmiles, setSearchSmiles] = useState('');
  const [showAllAtoms, setShowAllAtoms] = useState(false);
  const [atomSearch, setAtomSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const atomDropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPresets(false);
      }
      if (atomDropdownRef.current && !atomDropdownRef.current.contains(e.target as Node)) {
        setShowAllAtoms(false);
        setAtomSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 根据输入筛选预设分子
  const filteredPresets = searchSmiles.trim()
    ? PRESET_MOLECULES.filter(p =>
        p.name.toLowerCase().includes(searchSmiles.toLowerCase()) ||
        p.smiles.toLowerCase().includes(searchSmiles.toLowerCase()) ||
        p.description.toLowerCase().includes(searchSmiles.toLowerCase())
      )
    : PRESET_MOLECULES;

  // 筛选全部原子
  const filteredAllAtoms = atomSearch.trim()
    ? ALL_ATOMS.filter(a =>
        a.symbol.toLowerCase().includes(atomSearch.toLowerCase()) ||
        a.name.includes(atomSearch) ||
        a.name.toLowerCase().includes(atomSearch.toLowerCase())
      )
    : ALL_ATOMS;

  // 筛选官能团
  const filteredFunctionalGroups = atomSearch.trim()
    ? FUNCTIONAL_GROUPS.filter(g =>
        g.name.toLowerCase().includes(atomSearch.toLowerCase()) ||
        g.formula.toLowerCase().includes(atomSearch.toLowerCase()) ||
        g.category.includes(atomSearch)
      )
    : FUNCTIONAL_GROUPS;

  const handlePresetSelect = (nameOrSmiles: string) => {
    // 首先查找是否有预定义的分子创建函数（通过名称）
    if (MOLECULE_CREATORS[nameOrSmiles]) {
      const molecule = MOLECULE_CREATORS[nameOrSmiles]();
      setMolecule({
        ...molecule,
        name: nameOrSmiles,
        smiles: nameOrSmiles
      });
      // 同时更新输入框显示
      const preset = PRESET_MOLECULES.find(p => p.name === nameOrSmiles);
      setSearchSmiles(preset ? preset.smiles : nameOrSmiles);
      setShowPresets(false);
      return;
    }
    
    // 特殊处理四乙烯基甲烷
    if (nameOrSmiles === 'C(C=C)(C=C)(C=C)C=C' || nameOrSmiles === 'C(=C)(=C)(=C)=C') {
      // 创建完美的四乙烯基甲烷
      const atoms: { id: string; symbol: string; position: { x: number; y: number; z: number }; atomicNumber: number; color: string }[] = [];
      const bonds: { id: string; atom1Id: string; atom2Id: string; order: number }[] = [];
      let atomId = 0;
      let bondId = 0;
      
      const ccBondLength = 1.54;
      const chBondLength = 1.09;
      const cdBondLength = 1.34;
      
      // 工具函数
      const normalize = (v: { x: number; y: number; z: number }) => {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 1, y: 0, z: 0 };
      };
      
      // 中心碳
      atoms.push({
        id: `atom-${atomId++}`,
        symbol: 'C',
        position: { x: 0, y: 0, z: 0 },
        atomicNumber: 6,
        color: '#909090'
      });
      const centerId = atoms[0].id;
      
      // 计算四面体方向（109.5°键角）
      const phi = Math.acos(-1 / 3); // 约109.47°
      
      // 4个乙烯基方向（四面体顶点，正确的sp3键角）和双键方向
      const vinylConfigs = [
        // 乙烯基1：沿+z方向，双键在+x方向
        { c1Dir: { x: 0, y: 0, z: 1 }, doubleDir: { x: 1, y: 0, z: 0 } },
        // 乙烯基2：在下方，旋转120°，双键在垂直方向
        { c1Dir: { x: Math.sin(phi), y: 0, z: Math.cos(phi) }, doubleDir: { x: 0, y: 1, z: 0 } },
        // 乙烯基3：在下方，旋转240°，双键在另一垂直方向
        { c1Dir: { x: Math.sin(phi) * Math.cos(2 * Math.PI / 3), y: Math.sin(phi) * Math.sin(2 * Math.PI / 3), z: Math.cos(phi) }, doubleDir: { x: Math.cos(2 * Math.PI / 3), y: Math.sin(2 * Math.PI / 3), z: 0 } },
        // 乙烯基4：在下方，旋转360°，双键在第三垂直方向
        { c1Dir: { x: Math.sin(phi) * Math.cos(4 * Math.PI / 3), y: Math.sin(phi) * Math.sin(4 * Math.PI / 3), z: Math.cos(phi) }, doubleDir: { x: Math.cos(4 * Math.PI / 3), y: Math.sin(4 * Math.PI / 3), z: 0 } },
      ];
      
      // 为每个乙烯基创建结构
      for (let v = 0; v < 4; v++) {
        const config = vinylConfigs[v];
        const c1Dir = normalize(config.c1Dir);
        let doubleDir = normalize(config.doubleDir);
        
        // 确保双键方向与连接方向垂直
        // 将doubleDir投影到垂直于c1Dir的平面上
        const dot = c1Dir.x * doubleDir.x + c1Dir.y * doubleDir.y + c1Dir.z * doubleDir.z;
        let projectedDoubleDir = {
          x: doubleDir.x - dot * c1Dir.x,
          y: doubleDir.y - dot * c1Dir.y,
          z: doubleDir.z - dot * c1Dir.z
        };
        let normalizedDoubleDir = normalize(projectedDoubleDir);
        
        // 第一个碳（连接中心碳）- sp2杂化
        const c1Pos = {
          x: c1Dir.x * ccBondLength,
          y: c1Dir.y * ccBondLength,
          z: c1Dir.z * ccBondLength
        };
        atoms.push({
          id: `atom-${atomId++}`,
          symbol: 'C',
          position: c1Pos,
          atomicNumber: 6,
          color: '#909090'
        });
        const c1Id = atoms[atoms.length - 1].id;
        
        // 添加C-C单键
        bonds.push({
          id: `bond-${bondId++}`,
          atom1Id: centerId,
          atom2Id: c1Id,
          order: 1
        });
        
        // 第二个碳（双键）- sp2杂化
        const c2Pos = {
          x: c1Pos.x + normalizedDoubleDir.x * cdBondLength,
          y: c1Pos.y + normalizedDoubleDir.y * cdBondLength,
          z: c1Pos.z + normalizedDoubleDir.z * cdBondLength
        };
        atoms.push({
          id: `atom-${atomId++}`,
          symbol: 'C',
          position: c2Pos,
          atomicNumber: 6,
          color: '#909090'
        });
        const c2Id = atoms[atoms.length - 1].id;
        
        // 添加C=C双键
        bonds.push({
          id: `bond-${bondId++}`,
          atom1Id: c1Id,
          atom2Id: c2Id,
          order: 2
        });
        
        // ==== 乙烯基结构生成（最可靠方法） ====
        // 计算双键平面的坐标系
        const planeNormal = normalize({
          x: c1Dir.y * normalizedDoubleDir.z - c1Dir.z * normalizedDoubleDir.y,
          y: c1Dir.z * normalizedDoubleDir.x - c1Dir.x * normalizedDoubleDir.z,
          z: c1Dir.x * normalizedDoubleDir.y - c1Dir.y * normalizedDoubleDir.x
        });
        
        const perpendicular = normalize({
          x: planeNormal.y * normalizedDoubleDir.z - planeNormal.z * normalizedDoubleDir.y,
          y: planeNormal.z * normalizedDoubleDir.x - planeNormal.x * normalizedDoubleDir.z,
          z: planeNormal.x * normalizedDoubleDir.y - planeNormal.y * normalizedDoubleDir.x
        });
        
        // C1上的H原子：三个键向量和为零 (-c1Dir + normalizedDoubleDir + c1hDir = 0)
        const c1hDir = normalize({
          x: c1Dir.x - normalizedDoubleDir.x,
          y: c1Dir.y - normalizedDoubleDir.y,
          z: c1Dir.z - normalizedDoubleDir.z
        });
        
        const c1hPos = {
          x: c1Pos.x + c1hDir.x * chBondLength,
          y: c1Pos.y + c1hDir.y * chBondLength,
          z: c1Pos.z + c1hDir.z * chBondLength
        };
        atoms.push({
          id: `atom-${atomId++}`,
          symbol: 'H',
          position: c1hPos,
          atomicNumber: 1,
          color: '#FFFFFF'
        });
        bonds.push({
          id: `bond-${bondId++}`,
          atom1Id: c1Id,
          atom2Id: atoms[atoms.length - 1].id,
          order: 1
        });
        
        // C2上的两个H原子：在双键平面内，与双键方向呈120度
        const c2ToC1Dir = { x: -normalizedDoubleDir.x, y: -normalizedDoubleDir.y, z: -normalizedDoubleDir.z };
        const cos120 = Math.cos(2 * Math.PI / 3);
        const sin120 = Math.sin(2 * Math.PI / 3);
        
        const c2h1Dir = normalize({
          x: c2ToC1Dir.x * cos120 + perpendicular.x * sin120,
          y: c2ToC1Dir.y * cos120 + perpendicular.y * sin120,
          z: c2ToC1Dir.z * cos120 + perpendicular.z * sin120
        });
        
        const c2h1Pos = {
          x: c2Pos.x + c2h1Dir.x * chBondLength,
          y: c2Pos.y + c2h1Dir.y * chBondLength,
          z: c2Pos.z + c2h1Dir.z * chBondLength
        };
        atoms.push({
          id: `atom-${atomId++}`,
          symbol: 'H',
          position: c2h1Pos,
          atomicNumber: 1,
          color: '#FFFFFF'
        });
        bonds.push({
          id: `bond-${bondId++}`,
          atom1Id: c2Id,
          atom2Id: atoms[atoms.length - 1].id,
          order: 1
        });
        
        const c2h2Dir = normalize({
          x: c2ToC1Dir.x * cos120 - perpendicular.x * sin120,
          y: c2ToC1Dir.y * cos120 - perpendicular.y * sin120,
          z: c2ToC1Dir.z * cos120 - perpendicular.z * sin120
        });
        
        const c2h2Pos = {
          x: c2Pos.x + c2h2Dir.x * chBondLength,
          y: c2Pos.y + c2h2Dir.y * chBondLength,
          z: c2Pos.z + c2h2Dir.z * chBondLength
        };
        atoms.push({
          id: `atom-${atomId++}`,
          symbol: 'H',
          position: c2h2Pos,
          atomicNumber: 1,
          color: '#FFFFFF'
        });
        bonds.push({
          id: `bond-${bondId++}`,
          atom1Id: c2Id,
          atom2Id: atoms[atoms.length - 1].id,
          order: 1
        });
      }
      
      // 刚性约束验证 - 完整版本
      const validateConstraints = (): boolean => {
        let valid = true;
        const issues: string[] = [];
        
        // 辅助函数：计算三个点的平面法向量
        const calculatePlaneNormal = (p1: {x:number,y:number,z:number}, p2: {x:number,y:number,z:number}, p3: {x:number,y:number,z:number}) => {
          const v1 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
          const v2 = { x: p3.x - p1.x, y: p3.y - p1.y, z: p3.z - p1.z };
          return normalize({
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
          });
        };
        
        // 辅助函数：检查两个向量是否平行（法向量检查）
        const areVectorsParallel = (v1: {x:number,y:number,z:number}, v2: {x:number,y:number,z:number}, tolerance = 0.05) => {
          const dot = Math.abs(v1.x * v2.x + v1.y * v2.y + v1.z * v2.z);
          return dot > 1 - tolerance;
        };
        
        // 辅助函数：计算四点是否共面
        const areCoplanar = (p1: {x:number,y:number,z:number}, p2: {x:number,y:number,z:number}, p3: {x:number,y:number,z:number}, p4: {x:number,y:number,z:number}, tolerance = 0.1) => {
          const normal1 = calculatePlaneNormal(p1, p2, p3);
          const normal2 = calculatePlaneNormal(p1, p2, p4);
          return areVectorsParallel(normal1, normal2, tolerance) || areVectorsParallel(normal1, {x:-normal2.x,y:-normal2.y,z:-normal2.z}, tolerance);
        };
        
        // 1. 检查中心碳的sp³键角（应该约109.5°）
        const centerAtom = atoms[0];
        const connectedCarbons = atoms.filter((a, i) => i > 0 && a.symbol === 'C' && 
          bonds.some(b => (b.atom1Id === centerAtom.id && b.atom2Id === a.id) || 
                         (b.atom2Id === centerAtom.id && b.atom1Id === a.id)));
        
        for (let i = 0; i < connectedCarbons.length; i++) {
          for (let j = i + 1; j < connectedCarbons.length; j++) {
            const v1 = {
              x: connectedCarbons[i].position.x - centerAtom.position.x,
              y: connectedCarbons[i].position.y - centerAtom.position.y,
              z: connectedCarbons[i].position.z - centerAtom.position.z
            };
            const v2 = {
              x: connectedCarbons[j].position.x - centerAtom.position.x,
              y: connectedCarbons[j].position.y - centerAtom.position.y,
              z: connectedCarbons[j].position.z - centerAtom.position.z
            };
            const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
            const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
            const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
            
            if (Math.abs(angle - 109.5) > 3) {
              issues.push(`中心碳键角异常: ${angle.toFixed(1)}° (预期: 109.5°)`);
              valid = false;
            }
          }
        }
        
        // 2. 检查乙烯基的sp²键角（应该约120°）
        // 乙烯基结构: C(center)-C1=C2
        for (let v = 0; v < 4; v++) {
          const c1Idx = v * 5 + 1; // 每个乙烯基5个原子（C1, C2, H1, H2, H3）
          const c2Idx = v * 5 + 2;
          const c1hIdx = v * 5 + 3;
          const c2h1Idx = v * 5 + 4;
          const c2h2Idx = v * 5 + 5;
          
          if (c1Idx < atoms.length && c2Idx < atoms.length && c1hIdx < atoms.length) {
            const c1 = atoms[c1Idx];
            const c2 = atoms[c2Idx];
            const c1h = atoms[c1hIdx];
            
            // 检查乙烯基平面性：中心、C1、C2、C1H应该共面
            if (!areCoplanar(centerAtom.position, c1.position, c2.position, c1h.position)) {
              issues.push(`乙烯基${v+1}的C1侧不共面`);
              valid = false;
            }
            
            // 检查C1的三个键角：
            // a) 中心-C1-C2 (应该约120°)
            const vCenter = {
              x: centerAtom.position.x - c1.position.x,
              y: centerAtom.position.y - c1.position.y,
              z: centerAtom.position.z - c1.position.z
            };
            const vC2 = {
              x: c2.position.x - c1.position.x,
              y: c2.position.y - c1.position.y,
              z: c2.position.z - c1.position.z
            };
            let dot = vCenter.x * vC2.x + vCenter.y * vC2.y + vCenter.z * vC2.z;
            let len1 = Math.sqrt(vCenter.x * vCenter.x + vCenter.y * vCenter.y + vCenter.z * vCenter.z);
            let len2 = Math.sqrt(vC2.x * vC2.x + vC2.y * vC2.y + vC2.z * vC2.z);
            let angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
            
            if (Math.abs(angle - 120) > 5) {
              issues.push(`乙烯基${v+1}的C1键角(中心-C1-C2)异常: ${angle.toFixed(1)}° (预期: 120°)`);
              valid = false;
            }
            
            // b) 中心-C1-H (应该约120°)
            const vC1H = {
              x: c1h.position.x - c1.position.x,
              y: c1h.position.y - c1.position.y,
              z: c1h.position.z - c1.position.z
            };
            dot = vCenter.x * vC1H.x + vCenter.y * vC1H.y + vCenter.z * vC1H.z;
            len1 = Math.sqrt(vCenter.x * vCenter.x + vCenter.y * vCenter.y + vCenter.z * vCenter.z);
            len2 = Math.sqrt(vC1H.x * vC1H.x + vC1H.y * vC1H.y + vC1H.z * vC1H.z);
            angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
            
            if (Math.abs(angle - 120) > 5) {
              issues.push(`乙烯基${v+1}的C1键角(中心-C1-H)异常: ${angle.toFixed(1)}° (预期: 120°)`);
              valid = false;
            }
            
            // c) C2-C1-H (应该约120°)
            dot = vC2.x * vC1H.x + vC2.y * vC1H.y + vC2.z * vC1H.z;
            len1 = Math.sqrt(vC2.x * vC2.x + vC2.y * vC2.y + vC2.z * vC2.z);
            len2 = Math.sqrt(vC1H.x * vC1H.x + vC1H.y * vC1H.y + vC1H.z * vC1H.z);
            angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
            
            if (Math.abs(angle - 120) > 5) {
              issues.push(`乙烯基${v+1}的C1键角(C2-C1-H)异常: ${angle.toFixed(1)}° (预期: 120°)`);
              valid = false;
            }
          }
          
          if (c1Idx < atoms.length && c2Idx < atoms.length && c2h1Idx < atoms.length && c2h2Idx < atoms.length) {
            const c1 = atoms[c1Idx];
            const c2 = atoms[c2Idx];
            const c2h1 = atoms[c2h1Idx];
            const c2h2 = atoms[c2h2Idx];
            
            // 检查乙烯基C2侧平面性：C1、C2、C2H1、C2H2应该共面
            if (!areCoplanar(c1.position, c2.position, c2h1.position, c2h2.position)) {
              issues.push(`乙烯基${v+1}的C2侧不共面`);
              valid = false;
            }
            
            // 检查乙烯基整体平面性：整个乙烯基应该在同一平面
            if (!areCoplanar(centerAtom.position, c1.position, c2.position, c2h1.position)) {
              issues.push(`乙烯基${v+1}整体不共面`);
              valid = false;
            }
            
            // 检查C2的键角: C1-C2-H1 (应该约120°)
            const v1a = {
              x: c1.position.x - c2.position.x,
              y: c1.position.y - c2.position.y,
              z: c1.position.z - c2.position.z
            };
            const v2a = {
              x: c2h1.position.x - c2.position.x,
              y: c2h1.position.y - c2.position.y,
              z: c2h1.position.z - c2.position.z
            };
            let dot = v1a.x * v2a.x + v1a.y * v2a.y + v1a.z * v2a.z;
            let len1 = Math.sqrt(v1a.x * v1a.x + v1a.y * v1a.y + v1a.z * v1a.z);
            let len2 = Math.sqrt(v2a.x * v2a.x + v2a.y * v2a.y + v2a.z * v2a.z);
            let angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
            
            if (Math.abs(angle - 120) > 5) {
              issues.push(`乙烯基${v+1}的C2键角(C1-C2-H1)异常: ${angle.toFixed(1)}° (预期: 120°)`);
              valid = false;
            }
            
            // 检查C2的键角: C1-C2-H2 (应该约120°)
            const v2b = {
              x: c2h2.position.x - c2.position.x,
              y: c2h2.position.y - c2.position.y,
              z: c2h2.position.z - c2.position.z
            };
            dot = v1a.x * v2b.x + v1a.y * v2b.y + v1a.z * v2b.z;
            len2 = Math.sqrt(v2b.x * v2b.x + v2b.y * v2b.y + v2b.z * v2b.z);
            angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
            
            if (Math.abs(angle - 120) > 5) {
              issues.push(`乙烯基${v+1}的C2键角(C1-C2-H2)异常: ${angle.toFixed(1)}° (预期: 120°)`);
              valid = false;
            }
            
            // 检查C2的键角: H1-C2-H2 (应该约120°)
            dot = v2a.x * v2b.x + v2a.y * v2b.y + v2a.z * v2b.z;
            len1 = Math.sqrt(v2a.x * v2a.x + v2a.y * v2a.y + v2a.z * v2a.z);
            len2 = Math.sqrt(v2b.x * v2b.x + v2b.y * v2b.y + v2b.z * v2b.z);
            angle = Math.acos(Math.max(-1, Math.min(1, dot / (len1 * len2)))) * 180 / Math.PI;
            
            if (Math.abs(angle - 120) > 5) {
              issues.push(`乙烯基${v+1}的C2键角(H1-C2-H2)异常: ${angle.toFixed(1)}° (预期: 120°)`);
              valid = false;
            }
          }
        }
        
        // 3. 检查键长
        const expectedBondLengths: Record<string, { length: number; tolerance: number }> = {
          'C-C': { length: 1.54, tolerance: 0.1 },
          'C=C': { length: 1.34, tolerance: 0.1 },
          'C-H': { length: 1.09, tolerance: 0.1 }
        };
        
        for (const bond of bonds) {
          const atom1 = atoms.find(a => a.id === bond.atom1Id);
          const atom2 = atoms.find(a => a.id === bond.atom2Id);
          
          if (atom1 && atom2) {
            const dx = atom1.position.x - atom2.position.x;
            const dy = atom1.position.y - atom2.position.y;
            const dz = atom1.position.z - atom2.position.z;
            const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            const key = bond.order === 2 
              ? `${atom1.symbol}=${atom2.symbol}`
              : `${atom1.symbol}-${atom2.symbol}`;
            const expected = expectedBondLengths[key];
            
            if (expected && Math.abs(length - expected.length) > expected.tolerance) {
              issues.push(`${key}键长异常: ${length.toFixed(2)}Å (预期: ${expected.length}Å)`);
              valid = false;
            }
          }
        }
        
        // 4. 检查原子重叠（距离小于0.8Å视为重叠）
        for (let i = 0; i < atoms.length; i++) {
          for (let j = i + 1; j < atoms.length; j++) {
            const dx = atoms[i].position.x - atoms[j].position.x;
            const dy = atoms[i].position.y - atoms[j].position.y;
            const dz = atoms[i].position.z - atoms[j].position.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            if (distance < 0.8) {
              issues.push(`原子重叠: ${atoms[i].symbol}(${i+1}) 与 ${atoms[j].symbol}(${j+1}) 距离 ${distance.toFixed(2)}Å`);
              valid = false;
            }
          }
        }
        
        // 输出验证结果
        if (issues.length === 0) {
          console.log('✅ 四乙烯基甲烷结构验证通过');
          console.log(`  - 原子数: ${atoms.length}`);
          console.log(`  - 化学键数: ${bonds.length}`);
        } else {
          console.warn('❌ 四乙烯基甲烷结构验证失败');
          issues.forEach((issue, idx) => {
            console.warn(`  ${idx + 1}. ${issue}`);
          });
        }
        
        return valid;
      };
      
      validateConstraints();
      
      setMolecule({
        atoms,
        bonds,
        name: '四乙烯基甲烷',
        smiles: 'C(C=C)(C=C)(C=C)C=C'
      });
      // 同时更新输入框显示
      setSearchSmiles('C(C=C)(C=C)(C=C)C=C');
      setShowPresets(false);
      return;
    }
    
    // 如果没有找到，检查是否有通过SMILES匹配的预设分子
    const presetBySmiles = PRESET_MOLECULES.find(p => p.smiles === nameOrSmiles);
    if (presetBySmiles && MOLECULE_CREATORS[presetBySmiles.name]) {
      const molecule = MOLECULE_CREATORS[presetBySmiles.name]();
      setMolecule({
        ...molecule,
        name: presetBySmiles.name,
        smiles: presetBySmiles.smiles
      });
      // 同时更新输入框显示
      setSearchSmiles(presetBySmiles.smiles);
      setShowPresets(false);
      return;
    }
    
    // 对于甲烷的特殊处理
    if (nameOrSmiles.toUpperCase() === 'C' || nameOrSmiles.toUpperCase() === 'CH4') {
      const molecule = MOLECULE_CREATORS['甲烷']();
      setMolecule({
        ...molecule,
        name: '甲烷',
        smiles: 'C'
      });
      // 同时更新输入框显示
      setSearchSmiles('C');
      setShowPresets(false);
      return;
    }
    
    // 如果不是预设分子也不是四乙烯基甲烷，暂时不处理其他SMILES
    setShowPresets(false);
  };

  const handleSearch = () => {
    const input = searchSmiles.trim();
    if (!input) return;

    // 先尝试匹配预设分子名称
    if (MOLECULE_CREATORS[input]) {
      handlePresetSelect(input);
      return;
    }

    // 再尝试匹配预设分子的SMILES
    const presetBySmiles = PRESET_MOLECULES.find(p => p.smiles === input);
    if (presetBySmiles && MOLECULE_CREATORS[presetBySmiles.name]) {
      handlePresetSelect(presetBySmiles.name);
      return;
    }

    // 特殊处理甲烷
    if (input.toUpperCase() === 'C' || input.toUpperCase() === 'CH4') {
      handlePresetSelect('甲烷');
      return;
    }

    // 使用SMILES解析器解析任意SMILES
    const molecule = parseSmilesToMolecule(input);
    if (molecule) {
      setMolecule(molecule);
    } else {
      alert('无法解析该SMILES表达式，请检查输入是否正确');
    }
  };

  const isEditMode = state.tool === 'edit';

  return (
    <div className="bg-gray-800/80 text-white pl-2 pr-3 py-0.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 flex-wrap" style={{ rowGap: '2px' }}>
        {/* 模式切换按钮 */}
        <button
          onClick={() => setTool(isEditMode ? 'analyze' : 'edit')}
          className="flex items-center justify-center rounded-lg font-bold text-sm h-7 bg-blue-600/80 hover:bg-blue-700/80 text-white transition-colors"
          title={isEditMode ? '切换到分析模式' : '切换到编辑模式'}
          style={{ width: '36px' }}
        >
          <span style={{ fontSize: '13px' }}>
            {isEditMode ? '○-○' : '-○-'}
          </span>
        </button>

        {/* 分析模式 */}
        {!isEditMode && (
          <>
            {/* SMILES输入框 */}
            <button
              onClick={onOpenSmilesSearch}
              className="px-3 py-0.5 bg-gray-700/80 rounded-lg text-sm w-44 text-gray-300 hover:bg-gray-600/80 transition-colors flex items-center justify-between"
            >
              <span className="truncate">{state.molecule.smiles || state.molecule.name || 'SMILES / 分子名'}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                <circle cx="7" cy="7" r="4"/>
                <line x1="11" y1="11" x2="14" y2="14"/>
              </svg>
            </button>

            {/* 参考线/平面 */}
            <div className="flex items-center gap-1">
              <button
                id="referenceLineBtn"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors bg-gray-600/80 hover:bg-gray-500/80 text-gray-300"
                title="插入参考线"
                onClick={() => {
                  const event = new CustomEvent('insertReferenceLine');
                  window.dispatchEvent(event);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="2" y1="14" x2="14" y2="2" />
                </svg>
              </button>
              <button
                id="referencePlaneBtn"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors bg-gray-600/80 hover:bg-gray-500/80 text-gray-300"
                title="插入参考平面"
                onClick={() => {
                  const event = new CustomEvent('insertReferencePlane');
                  window.dispatchEvent(event);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="rgba(100,180,255,0.3)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M2 14 L2 4 L14 14 Z" />
                </svg>
              </button>
            </div>
            
            {/* 分析面板按钮 - 靠屏幕右侧 */}
            <div className="ml-auto flex items-center">
              <button
                onClick={() => {
                  const event = new CustomEvent('toggleAnalysisPanel');
                  window.dispatchEvent(event);
                }}
                className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white transition-colors bg-gray-600/80 hover:bg-gray-500/80 rounded-lg"
                style={{ fontSize: '22px' }}
                title="分子分析"
              >
                ≡
              </button>
            </div>
          </>
        )}

        {/* 编辑模式 */}
        {isEditMode && (
          <>
            {/* 第一行：SMILES + 删除/清理 */}
            <button
              onClick={onOpenSmilesSearch}
              className="px-3 py-0.5 bg-gray-700/80 rounded-lg text-sm w-44 text-gray-300 hover:bg-gray-600/80 transition-colors flex items-center justify-between"
            >
              <span className="truncate">{state.molecule.smiles || state.molecule.name || 'SMILES / 分子名'}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                <circle cx="7" cy="7" r="4"/>
                <line x1="11" y1="11" x2="14" y2="14"/>
              </svg>
            </button>
            {/* 删除和清理按钮 - 靠右 */}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => {
                  if (state.selectedAtom) {
                    removeAtom(state.selectedAtom);
                    selectAtom(null);
                  } else if (state.selectedBond) {
                    removeBond(state.selectedBond);
                    selectBond(null);
                  } else if (state.selectedAtoms.length > 0) {
                    state.selectedAtoms.forEach(id => removeAtom(id));
                    selectAtom(null);
                  }
                }}
                className={`w-7 h-7 rounded flex items-center justify-center text-sm font-bold transition-all hover:ring-2 hover:ring-blue-400 ${
                    (state.selectedAtom || state.selectedBond || state.selectedAtoms.length > 0)
                      ? 'bg-yellow-600/80 hover:bg-yellow-500/80 text-white hover:scale-110'
                      : 'bg-gray-600/80 hover:bg-gray-500/80 text-gray-300 hover:scale-110'
                  }`}
                title="删除选中元素"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
              </button>
              <button
                onClick={() => {
                  clearMolecule();
                  const event = new CustomEvent('clearAll');
                  window.dispatchEvent(event);
                }}
                className={`w-7 h-7 rounded flex items-center justify-center text-sm font-bold transition-all hover:ring-2 hover:ring-blue-400 ${
                    (state.selectedAtom || state.selectedBond || state.selectedAtoms.length > 0)
                      ? 'bg-red-700/80 hover:bg-red-600/80 text-white'
                      : 'bg-gray-600/80 hover:bg-gray-500/80 text-gray-300'
                  }`}
                title="清空全部"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4"/>
                </svg>
              </button>
            </div>

            {/* 换行 */}
            <div className="w-full"></div>

            {/* 第二行：原子 + 化学键 */}
            <div className="flex items-center gap-1">
              {ATOMS.map((atom) => (
                <button
                  key={atom.symbol}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('atom', atom.symbol);
                    startDragAtom(atom.symbol);
                  }}
                  onClick={() => {
                    setInsertAtom(atom.symbol);
                  }}
                  className={`group relative w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all hover:scale-110 hover:ring-2 hover:ring-blue-400 ${
                    state.insertAtomSymbol === atom.symbol ? 'ring-2 ring-blue-400' : ''
                  }`}
                  style={{ backgroundColor: atom.color, color: atom.color === '#FFFFFF' || atom.color === '#FFFF30' ? '#000' : '#FFF', opacity: 0.8 }}
                  title={`${atom.label} (${atom.symbol})`}
                >
                  {atom.symbol}
                </button>
              ))}
              <button
                onClick={onOpenAtomSelect}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-600/80 hover:bg-gray-500/80 text-gray-300 transition-all hover:ring-2 hover:ring-blue-400"
                title="更多元素/官能团"
              >
                ⋯
              </button>
            </div>

            <div className="w-px h-5 bg-gray-600 mx-1"></div>

            {/* 化学键 */}
            <div className="flex items-center gap-1">
              {BONDS.map((bond) => (
                <button
                  key={bond.order}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('bond', bond.order.toString());
                    startDragBond(bond.order);
                  }}
                  onClick={() => {
                    setInsertBond(state.insertBondOrder === bond.order ? null : bond.order);
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all hover:scale-110 hover:ring-2 hover:ring-blue-400 ${
                    state.insertBondOrder === bond.order
                      ? 'bg-blue-600/80 text-white ring-2 ring-blue-400'
                      : 'bg-gray-600/80 hover:bg-gray-500/80 text-gray-300'
                  }`}
                  title={bond.label}
                >
                  {bond.symbol}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
