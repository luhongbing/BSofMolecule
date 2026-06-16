import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { Molecule, ToolType, RenderMode, Atom, Bond, AnalysisResult } from '../types';
export type { Atom } from '../types';
import { generateUUID, calculateMolecularWeight, calculateFormula, calculateUnsaturation, analyzeHybridization, findAllCollinearGroups, findAllCoplanarGroups, getElementColor, validateMolecule, printValidationResult, hasFreeValence, getAvailableValence } from '../utils/chemistry';
import { createMethaneMolecule } from '../utils/molecules';
import { getFunctionalGroupById } from '../utils/functionalGroups';

const INITIAL_MOLECULE: Molecule = {
 atoms: [],
 bonds: [],
};

type MoleculeAction = {
 type: 'ADD_ATOM';
 payload: {
 symbol: string;
 position: Atom['position'];
 };
} | {
 type: 'REMOVE_ATOM';
 payload: {
 id: string;
 };
} | {
 type: 'ADD_BOND';
 payload: {
 atom1Id: string | null;
 atom2Id: string | null;
 order: number;
 atom1Position?: Atom['position'];
 atom2Position?: Atom['position'];
 };
} | {
 type: 'REMOVE_BOND';
 payload: {
 id: string;
 };
} | {
 type: 'UPDATE_ATOM_POSITION';
 payload: {
 id: string;
 position: Atom['position'];
 };
} | {
 type: 'UPDATE_BOND_POSITION';
 payload: {
 id: string;
 atom1Position?: Atom['position'];
 atom2Position?: Atom['position'];
 };
} | {
 type: 'SET_TOOL';
 payload: ToolType;
} | {
 type: 'SET_RENDER_MODE';
 payload: RenderMode;
} | {
 type: 'SET_MOLECULE';
 payload: Molecule;
} | {
 type: 'CLEAR_MOLECULE';
} | {
 type: 'SELECT_ATOM';
 payload: string | null;
} | {
 type: 'SELECT_BOND';
 payload: string | null;
} | {
 type: 'UPDATE_SELECTED_ATOMS';
 payload: string[];
} | {
 type: 'SET_INSERT_ATOM';
 payload: string | null;
} | {
 type: 'SET_INSERT_BOND';
 payload: number | null;
} | {
 type: 'ADD_ATOMS_WITH_BOND';
 payload: {
 symbol1: string;
 position1: Atom['position'];
 symbol2: string;
 position2: Atom['position'];
 order: number;
 };
} | {
 type: 'BIND_ATOM_TO_BOND_ENDPOINT';
 payload: {
 bondId: string;
 atomId: string;
 endpoint: 'atom1' | 'atom2';
 };
} | {
 type: 'SET_CAMERA_SPHERICAL';
 payload: { theta: number; phi: number; radius: number };
} | {
 type: 'SET_ZOOM_LEVEL';
 payload: number;
} | {
  type: 'SET_INSERT_FUNCTIONAL_GROUP';
  payload: string | null;
} | {
  type: 'INSERT_FUNCTIONAL_GROUP';
  payload: {
    groupId: string;
    position: Atom['position'];
  };
} | {
  type: 'RESET_ZOOM';
};
interface MoleculeState {
 molecule: Molecule;
 tool: ToolType;
 renderMode: RenderMode;
 selectedAtom: string | null;
 selectedBond: string | null;
 selectedAtoms: string[];
 insertAtomSymbol: string | null;
  insertBondOrder: number | null;
  insertFunctionalGroupId: string | null;
 analysisResult: AnalysisResult;
 validationResult: { isValid: boolean; issues: { type: 'error' | 'warning'; message: string; atomIds?: string[]; bondIds?: string[] }[] };
 cameraSpherical: { theta: number; phi: number; radius: number };
 zoomLevel: number;
}
const initialState: MoleculeState = {
 molecule: INITIAL_MOLECULE,
 tool: 'analyze',
 renderMode: 'ball-stick',
 selectedAtom: null,
 selectedBond: null,
 selectedAtoms: [],
 insertAtomSymbol: null,
  insertBondOrder: null,
  insertFunctionalGroupId: null,
 analysisResult: { collinearGroups: [], coplanarGroups: [], hybridization: { sp: [], sp2: [], sp3: [] } },
 validationResult: { isValid: true, issues: [] },
 cameraSpherical: { theta: 0, phi: Math.PI / 2, radius: 20 },
 zoomLevel: 100,
};
function moleculeReducer(state: MoleculeState, action: MoleculeAction): MoleculeState {
 switch (action.type) {
 case 'ADD_ATOM': {
 const newAtom: Atom = {
 id: generateUUID(),
 symbol: action.payload.symbol,
 position: action.payload.position,
 atomicNumber: getAtomicNumber(action.payload.symbol),
 color: getElementColor(action.payload.symbol),
 radius: getCovalentRadius(action.payload.symbol),
 };
 const newAtoms = [...state.molecule.atoms, newAtom];
 const newMolecule = updateMoleculeProperties({ ...state.molecule, atoms: newAtoms });
 return {
 ...state,
 molecule: newMolecule,
 analysisResult: analyzeMolecule(newMolecule),
 };
 }
 case 'ADD_ATOMS_WITH_BOND': {
 const newAtom1: Atom = {
 id: generateUUID(),
 symbol: action.payload.symbol1,
 position: action.payload.position1,
 atomicNumber: getAtomicNumber(action.payload.symbol1),
 color: getElementColor(action.payload.symbol1),
 radius: getCovalentRadius(action.payload.symbol1),
 };
 const newAtom2: Atom = {
 id: generateUUID(),
 symbol: action.payload.symbol2,
 position: action.payload.position2,
 atomicNumber: getAtomicNumber(action.payload.symbol2),
 color: getElementColor(action.payload.symbol2),
 radius: getCovalentRadius(action.payload.symbol2),
 };
 const newBond: Bond = {
 id: generateUUID(),
 atom1Id: newAtom1.id,
 atom2Id: newAtom2.id,
 order: action.payload.order,
 };
 const newAtoms = [...state.molecule.atoms, newAtom1, newAtom2];
 const newBonds = [...state.molecule.bonds, newBond];
 const newMolecule = updateMoleculeProperties({ ...state.molecule, atoms: newAtoms, bonds: newBonds });
 return {
 ...state,
 molecule: newMolecule,
 analysisResult: analyzeMolecule(newMolecule),
 };
 }
 case 'REMOVE_ATOM': {
 const newAtoms = state.molecule.atoms.filter(a => a.id !== action.payload.id);
 const removedAtom = state.molecule.atoms.find(a => a.id === action.payload.id);
 const newBonds = state.molecule.bonds.map(bond => {
 if (bond.atom1Id === action.payload.id) {
 return {
 ...bond,
 atom1Id: null,
 atom1Position: removedAtom?.position
 };
 }
 if (bond.atom2Id === action.payload.id) {
 return {
 ...bond,
 atom2Id: null,
 atom2Position: removedAtom?.position
 };
 }
 return bond;
 });
 // 保留所有键，即使两端都为空头（表示未完成的键）
 const newMolecule = updateMoleculeProperties({ ...state.molecule, atoms: newAtoms, bonds: newBonds });
 return {
 ...state,
 molecule: newMolecule,
 selectedAtom: state.selectedAtom === action.payload.id ? null : state.selectedAtom,
 selectedAtoms: state.selectedAtoms.filter(id => id !== action.payload.id),
 analysisResult: analyzeMolecule(newMolecule),
 };
 }
 case 'ADD_BOND': {
 // 只有当两端都有真实原子ID时才检查重复键和键位容量（空头键允许共存）
 const hasAtom1 = action.payload.atom1Id !== null;
 const hasAtom2 = action.payload.atom2Id !== null;

 // 前置校验：每一端原子必须存在且有足够剩余键位（如果有原子时）
 if (hasAtom1 && !hasFreeValence(state.molecule, action.payload.atom1Id!)) {
   return state;
 }
 if (hasAtom2 && !hasFreeValence(state.molecule, action.payload.atom2Id!)) {
   return state;
 }
 const atom1Available = hasAtom1 ? getAvailableValence(state.molecule, action.payload.atom1Id!) : Infinity;
 const atom2Available = hasAtom2 ? getAvailableValence(state.molecule, action.payload.atom2Id!) : Infinity;
 if (atom1Available < action.payload.order || atom2Available < action.payload.order) {
   return state;
 }

 const existingBond = (hasAtom1 && hasAtom2)
   ? state.molecule.bonds.find(b => (b.atom1Id === action.payload.atom1Id && b.atom2Id === action.payload.atom2Id) ||
     (b.atom1Id === action.payload.atom2Id && b.atom2Id === action.payload.atom1Id))
   : null;
 if (existingBond) {
 const newBonds = state.molecule.bonds.map(b => b.id === existingBond.id ? { ...b, order: action.payload.order } : b);
 const newMolecule = updateMoleculeProperties({ ...state.molecule, bonds: newBonds });
 return {
 ...state,
 molecule: newMolecule,
 analysisResult: analyzeMolecule(newMolecule),
 };
 }
 const newBond: Bond = {
 id: generateUUID(),
 atom1Id: action.payload.atom1Id,
 atom2Id: action.payload.atom2Id,
 order: action.payload.order,
 atom1Position: action.payload.atom1Position,
 atom2Position: action.payload.atom2Position,
 };
 const newBonds = [...state.molecule.bonds, newBond];
 const newMolecule = updateMoleculeProperties({ ...state.molecule, bonds: newBonds });
 return {
 ...state,
 molecule: newMolecule,
 analysisResult: analyzeMolecule(newMolecule),
 };
 }
 case 'UPDATE_BOND_POSITION': {
 const newBonds = state.molecule.bonds.map(b => {
 if (b.id === action.payload.id) {
 return {
 ...b,
 atom1Position: action.payload.atom1Position !== undefined ? action.payload.atom1Position : b.atom1Position,
 atom2Position: action.payload.atom2Position !== undefined ? action.payload.atom2Position : b.atom2Position,
 };
 }
 return b;
 });
 const newMolecule = { ...state.molecule, bonds: newBonds };
 return {
 ...state,
 molecule: newMolecule,
 };
 }
 case 'BIND_ATOM_TO_BOND_ENDPOINT': {
 // 前置校验 1：原子必须存在且有剩余成键容量
 const targetAtom = state.molecule.atoms.find(a => a.id === action.payload.atomId);
 if (!targetAtom || !hasFreeValence(state.molecule, action.payload.atomId)) {
   return state;
 }
 // 前置校验 2：指定的键端点必须为空头位置
 const targetBond = state.molecule.bonds.find(b => b.id === action.payload.bondId);
 if (!targetBond) return state;
 const endpointIsEmpty = action.payload.endpoint === 'atom1'
   ? targetBond.atom1Id === null
   : targetBond.atom2Id === null;
 if (!endpointIsEmpty) return state;
 // 前置校验 3：目标原子的成键容量足以接收该键（考虑键的 order）
 const available = getAvailableValence(state.molecule, action.payload.atomId);
 if (available < targetBond.order) return state;

 const newBonds = state.molecule.bonds.map(b => {
 if (b.id === action.payload.bondId) {
 const updatedBond: Bond = {
 ...b,
 };
 // 根据 endpoint 更新 atomId，清除对应的 Position
 if (action.payload.endpoint === 'atom1') {
 updatedBond.atom1Id = action.payload.atomId;
 updatedBond.atom1Position = undefined;
 } else {
 updatedBond.atom2Id = action.payload.atomId;
 updatedBond.atom2Position = undefined;
 }
 return updatedBond;
 }
 return b;
 });
 const newMolecule = updateMoleculeProperties({ ...state.molecule, bonds: newBonds });
 return {
 ...state,
 molecule: newMolecule,
 analysisResult: analyzeMolecule(newMolecule),
 };
 }
 case 'REMOVE_BOND': {
 const newBonds = state.molecule.bonds.filter(b => b.id !== action.payload.id);
 const newMolecule = updateMoleculeProperties({ ...state.molecule, bonds: newBonds });
 return {
 ...state,
 molecule: newMolecule,
 selectedBond: state.selectedBond === action.payload.id ? null : state.selectedBond,
 analysisResult: analyzeMolecule(newMolecule),
 };
 }
 case 'UPDATE_ATOM_POSITION': {
 const newAtoms = state.molecule.atoms.map(a => a.id === action.payload.id ? { ...a, position: action.payload.position } : a);
 return {
 ...state,
 molecule: { ...state.molecule, atoms: newAtoms },
 };
 }
 case 'SET_TOOL':
 return { ...state, tool: action.payload };
 case 'SET_RENDER_MODE':
 return { ...state, renderMode: action.payload };
 case 'SET_MOLECULE': {
 const molecule = updateMoleculeProperties(action.payload);
 const validationResult = validateMolecule(molecule);
 if (validationResult.issues.length > 0) {
 console.log('=== 分子结构验证结果 ===');
 printValidationResult(validationResult);
 }
 return {
 ...state,
 molecule,
 analysisResult: analyzeMolecule(molecule),
 validationResult,
 selectedAtom: null,
 selectedBond: null,
 selectedAtoms: [],
 };
 }
 case 'CLEAR_MOLECULE':
 return {
 ...state,
 molecule: INITIAL_MOLECULE,
 analysisResult: { collinearGroups: [], coplanarGroups: [], hybridization: { sp: [], sp2: [], sp3: [] } },
 validationResult: { isValid: true, issues: [] },
 selectedAtom: null,
 selectedBond: null,
 selectedAtoms: [],
 insertAtomSymbol: null,
 };
 case 'SELECT_ATOM':
    return { ...state, selectedAtom: action.payload, selectedBond: null };
 case 'SELECT_BOND':
 return { ...state, selectedBond: action.payload, selectedAtom: null };
 case 'UPDATE_SELECTED_ATOMS':
 return { ...state, selectedAtoms: action.payload };
 case 'SET_INSERT_ATOM':
 return { ...state, insertAtomSymbol: action.payload, insertBondOrder: null, insertFunctionalGroupId: null };
 case 'SET_INSERT_BOND':
 return { ...state, insertBondOrder: action.payload, insertAtomSymbol: null, insertFunctionalGroupId: null };
 case 'SET_INSERT_FUNCTIONAL_GROUP':
 return { ...state, insertFunctionalGroupId: action.payload, insertAtomSymbol: null, insertBondOrder: null };
 case 'INSERT_FUNCTIONAL_GROUP': {
 const group = getFunctionalGroupById(action.payload.groupId);
 if (!group) return state;
 const basePos = action.payload.position;
 // 创建所有原子，以点击位置为连接点偏移
 const newAtoms: Atom[] = group.atoms.map(ga => ({
   id: generateUUID(),
   symbol: ga.symbol,
   position: {
     x: basePos.x + ga.x,
     y: basePos.y + ga.y,
     z: basePos.z + ga.z,
   },
   atomicNumber: getAtomicNumber(ga.symbol),
   color: getElementColor(ga.symbol),
   radius: getCovalentRadius(ga.symbol),
 }));
 // 创建化学键，将原子索引映射为新的原子ID
 const idxToId = new Map<number, string>();
 group.atoms.forEach((ga, i) => {
   idxToId.set(ga.idx, newAtoms[i].id);
 });
 const newBonds: Bond[] = group.bonds.map(gb => ({
   id: generateUUID(),
   atom1Id: idxToId.get(gb.atom1Idx) || null,
   atom2Id: idxToId.get(gb.atom2Idx) || null,
   order: gb.order,
 }));
 // 创建空头键（官能团中未连接的可用键位）
 if (group.emptyBonds && group.emptyBonds.length > 0) {
   group.emptyBonds.forEach(eb => {
     const attachedAtomId = idxToId.get(eb.atomIdx);
     if (attachedAtomId) {
       newBonds.push({
         id: generateUUID(),
         atom1Id: attachedAtomId,
         atom2Id: null,
         order: eb.order,
         atom2Position: {
           x: basePos.x + eb.position.x,
           y: basePos.y + eb.position.y,
           z: basePos.z + eb.position.z,
         },
       });
     }
   });
 }
 const allAtoms = [...state.molecule.atoms, ...newAtoms];
 const allBonds = [...state.molecule.bonds, ...newBonds];
 const newMolecule = updateMoleculeProperties({ ...state.molecule, atoms: allAtoms, bonds: allBonds });
 return {
   ...state,
   molecule: newMolecule,
   analysisResult: analyzeMolecule(newMolecule),
   insertFunctionalGroupId: null,
 };
 }
 case 'SET_CAMERA_SPHERICAL':
 return { ...state, cameraSpherical: action.payload };
 case 'SET_ZOOM_LEVEL':
 return { ...state, zoomLevel: action.payload };
 case 'RESET_ZOOM':
 return { 
   ...state, 
   cameraSpherical: { theta: 0, phi: Math.PI / 2, radius: 20 },
   zoomLevel: 100
 };
 default:
 return state;
 }
}
function getAtomicNumber(symbol: string): number {
 const numbers: Record<string, number> = {
 H: 1, C: 6, N: 7, O: 8, F: 9, Cl: 17, Br: 35, I: 53, S: 16, P: 15
 };
 return numbers[symbol] || 6;
}
function getCovalentRadius(symbol: string): number {
 const radii: Record<string, number> = {
 H: 0.37, C: 0.77, N: 0.75, O: 0.73,
 F: 0.71, Cl: 0.99, Br: 1.14, I: 1.33,
 S: 1.02, P: 1.10,
 };
 return radii[symbol] || 0.70;
}
function updateMoleculeProperties(molecule: Molecule): Molecule {
 const formula = calculateFormula(molecule.atoms);
 return {
 ...molecule,
 formula,
 molecularWeight: calculateMolecularWeight(molecule.atoms),
 unsaturation: calculateUnsaturation(formula),
 };
}
function analyzeMolecule(molecule: Molecule): AnalysisResult {
 return {
 collinearGroups: findAllCollinearGroups(molecule),
 coplanarGroups: findAllCoplanarGroups(molecule),
 hybridization: analyzeHybridization(molecule),
 };
}
interface MoleculeContextType {
 state: MoleculeState;
 addAtom: (symbol: string, position: Atom['position']) => void;
 removeAtom: (id: string) => void;
 addBond: (
 atom1Id: string | null,
 atom2Id: string | null,
 order: number,
 atom1Position?: Atom['position'],
 atom2Position?: Atom['position'],
 ) => void;
 removeBond: (id: string) => void;
 updateAtomPosition: (id: string, position: Atom['position']) => void;
 updateBondPosition: (
 id: string,
 params: { atom1Position?: Atom['position']; atom2Position?: Atom['position'] }
 ) => void;
 bindAtomToBondEndpoint: (
 bondId: string,
 atomId: string,
 endpoint: 'atom1' | 'atom2'
 ) => void;
 addAtomsWithBond: (symbol1: string, pos1: Atom['position'], symbol2: string, pos2: Atom['position'], order: number) => void;
 setTool: (tool: ToolType) => void;
 setInsertAtom: (symbol: string | null) => void;
  setInsertBond: (order: number | null) => void;
  setInsertFunctionalGroup: (groupId: string | null) => void;
  insertFunctionalGroup: (groupId: string, position: Atom['position']) => void;
 setRenderMode: (mode: RenderMode) => void;
 setMolecule: (molecule: Molecule) => void;
 clearMolecule: () => void;
 selectAtom: (id: string | null) => void;
 selectBond: (id: string | null) => void;
 updateSelectedAtoms: (ids: string[]) => void;
 setCameraSpherical: (spherical: { theta: number; phi: number; radius: number }) => void;
 setZoomLevel: (level: number) => void;
 resetZoom: () => void;
}
const MoleculeContext = createContext<MoleculeContextType | null>(null);
export function MoleculeProvider({ children }: {
 children: React.ReactNode;
}) {
 const [state, dispatch] = useReducer(moleculeReducer, initialState);
 const addAtom = useCallback((symbol: string, position: Atom['position']) => {
 dispatch({ type: 'ADD_ATOM', payload: { symbol, position } });
 }, []);
 const removeAtom = useCallback((id: string) => {
 dispatch({ type: 'REMOVE_ATOM', payload: { id } });
 }, []);
 const addBond = useCallback((
 atom1Id: string | null,
 atom2Id: string | null,
 order: number,
 atom1Position?: Atom['position'],
 atom2Position?: Atom['position'],
 ) => {
 dispatch({ type: 'ADD_BOND', payload: { atom1Id, atom2Id, order, atom1Position, atom2Position } });
 }, []);
 const removeBond = useCallback((id: string) => {
 dispatch({ type: 'REMOVE_BOND', payload: { id } });
 }, []);
 const updateAtomPosition = useCallback((id: string, position: Atom['position']) => {
 dispatch({ type: 'UPDATE_ATOM_POSITION', payload: { id, position } });
 }, []);
 const updateBondPosition = useCallback((
 id: string,
 params: { atom1Position?: Atom['position']; atom2Position?: Atom['position'] }
 ) => {
 dispatch({ type: 'UPDATE_BOND_POSITION', payload: { id, ...params } });
 }, []);
 const bindAtomToBondEndpoint = useCallback((
 bondId: string,
 atomId: string,
 endpoint: 'atom1' | 'atom2'
 ) => {
 dispatch({ type: 'BIND_ATOM_TO_BOND_ENDPOINT', payload: { bondId, atomId, endpoint } });
 }, []);
 const addAtomsWithBond = useCallback((symbol1: string, pos1: Atom['position'], symbol2: string, pos2: Atom['position'], order: number) => {
 dispatch({ type: 'ADD_ATOMS_WITH_BOND', payload: { symbol1, position1: pos1, symbol2, position2: pos2, order } });
 }, []);
 const setTool = useCallback((tool: ToolType) => {
 dispatch({ type: 'SET_TOOL', payload: tool });
 }, []);
 const setRenderMode = useCallback((mode: RenderMode) => {
 dispatch({ type: 'SET_RENDER_MODE', payload: mode });
 }, []);
 const setMolecule = useCallback((molecule: Molecule) => {
 dispatch({ type: 'SET_MOLECULE', payload: molecule });
 }, []);
 const clearMolecule = useCallback(() => {
 dispatch({ type: 'CLEAR_MOLECULE' });
 }, []);
 const selectAtom = useCallback((id: string | null) => {
 dispatch({ type: 'SELECT_ATOM', payload: id });
 }, []);
 const selectBond = useCallback((id: string | null) => {
 dispatch({ type: 'SELECT_BOND', payload: id });
 }, []);
 const updateSelectedAtoms = useCallback((ids: string[]) => {
 dispatch({ type: 'UPDATE_SELECTED_ATOMS', payload: ids });
 }, []);
 const setInsertAtom = useCallback((symbol: string | null) => {
 dispatch({ type: 'SET_INSERT_ATOM', payload: symbol });
 }, []);
 const setInsertBond = useCallback((order: number | null) => {
    dispatch({ type: 'SET_INSERT_BOND', payload: order });
  }, []);
  const setInsertFunctionalGroup = useCallback((groupId: string | null) => {
    dispatch({ type: 'SET_INSERT_FUNCTIONAL_GROUP', payload: groupId });
  }, []);
  const insertFunctionalGroup = useCallback((groupId: string, position: Atom['position']) => {
    dispatch({ type: 'INSERT_FUNCTIONAL_GROUP', payload: { groupId, position } });
  }, []);
 const setCameraSpherical = useCallback((spherical: { theta: number; phi: number; radius: number }) => {
 dispatch({ type: 'SET_CAMERA_SPHERICAL', payload: spherical });
 }, []);
 const setZoomLevel = useCallback((level: number) => {
 dispatch({ type: 'SET_ZOOM_LEVEL', payload: level });
 }, []);
 const resetZoom = useCallback(() => {
 dispatch({ type: 'RESET_ZOOM' });
 }, []);
 useEffect(() => {
    const defaultMolecule = createMethaneMolecule();
    if (defaultMolecule) {
      setMolecule({ ...defaultMolecule, name: '甲烷' });
    }
  }, []);
 return (<MoleculeContext.Provider value={{
 state,
 addAtom,
 removeAtom,
 addBond,
 removeBond,
 updateAtomPosition,
 updateBondPosition,
 bindAtomToBondEndpoint,
 addAtomsWithBond,
 setTool,
 setInsertAtom,
 setInsertBond,
 setInsertFunctionalGroup,
 insertFunctionalGroup,
 setRenderMode,
 setMolecule,
 clearMolecule,
 selectAtom,
 selectBond,
 updateSelectedAtoms,
 setCameraSpherical,
 setZoomLevel,
 resetZoom,
 }}>
 {children}
 </MoleculeContext.Provider>);
}
export function useMolecule() {
 const context = useContext(MoleculeContext);
 if (!context) {
 throw new Error('useMolecule must be used within a MoleculeProvider');
 }
 return context;
}
