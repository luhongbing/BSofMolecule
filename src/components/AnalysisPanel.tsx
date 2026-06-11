import { useState } from 'react';
import { useMolecule } from '../context/MoleculeContext';
import {
  checkCollinearity,
  checkCoplanarity,
  canAdjustToCollinear,
  canAdjustToCoplanar,
  adjustToCollinear,
  adjustToCoplanar
} from '../utils/chemistry';

export function AnalysisPanel() {
  const { state, updateSelectedAtoms, setMolecule } = useMolecule();
  const [showPanel, setShowPanel] = useState(false);

  const handleAnalyzeSelection = () => {
    const messages: string[] = [];
    
    // 共线分析（>=3个原子）
    if (state.selectedAtoms.length >= 3) {
      const collinearResult = checkCollinearity(state.molecule.atoms, state.selectedAtoms);
      messages.push(`📐 ${collinearResult.explanation}`);
    }
    
    // 共面分析（>=4个原子）
    if (state.selectedAtoms.length >= 4) {
      const coplanarResult = checkCoplanarity(state.molecule.atoms, state.selectedAtoms);
      messages.push(`📊 ${coplanarResult.explanation}`);
    }
    
    if (messages.length > 0) {
      alert(messages.join('\n\n'));
    }
  };

  const handleAdjustToCollinear = () => {
    const check = canAdjustToCollinear(state.molecule, state.selectedAtoms);
    if (!check.canAdjust) {
      alert(`⚠️ 无法调整为共线\n\n原因：${check.reason}`);
      return;
    }
    const newMolecule = adjustToCollinear(state.molecule, state.selectedAtoms);
    if (newMolecule) {
      setMolecule(newMolecule);
    }
  };

  const handleAdjustToCoplanar = () => {
    const check = canAdjustToCoplanar(state.molecule, state.selectedAtoms);
    if (!check.canAdjust) {
      alert(`⚠️ 无法调整为共面\n\n原因：${check.reason}`);
      return;
    }
    const newMolecule = adjustToCoplanar(state.molecule, state.selectedAtoms);
    if (newMolecule) {
      setMolecule(newMolecule);
    }
  };

  const handleSelectAllCollinear = () => {
    if (state.analysisResult.collinearGroups.length > 0) {
      const allCollinear = state.analysisResult.collinearGroups.flat();
      updateSelectedAtoms(allCollinear);
    }
  };

  const handleSelectAllCoplanar = () => {
    if (state.analysisResult.coplanarGroups.length > 0) {
      const allCoplanar = state.analysisResult.coplanarGroups.flat();
      updateSelectedAtoms(allCoplanar);
    }
  };

  const selectedAtomSymbols = state.selectedAtoms
    .map(id => state.molecule.atoms.find(a => a.id === id)?.symbol)
    .filter(Boolean);

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-800/80 hover:bg-gray-700 text-white px-2 py-4 rounded-l-lg z-40 transition-colors"
      >
        {showPanel ? '◀' : '▶'}
      </button>
      
      {showPanel && (
        <div className="absolute right-0 top-0 h-full w-72 bg-gray-900 text-white overflow-y-auto z-30 shadow-xl">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-lg font-bold">
              🔬 分子分析
              {state.molecule.name && <span className="text-blue-400 ml-2">：{state.molecule.name}</span>}
            </h2>
            <div className="space-y-2 text-sm">
              {state.molecule.formula && (
                <div className="flex justify-between">
                  <span className="text-gray-400">分子式:</span>
                  <span className="font-mono">{state.molecule.formula}</span>
                </div>
              )}
              {state.molecule.molecularWeight && (
                <div className="flex justify-between">
                  <span className="text-gray-400">分子量:</span>
                  <span>{state.molecule.molecularWeight.toFixed(2)}</span>
                </div>
              )}
              {state.molecule.unsaturation !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-400">不饱和度:</span>
                  <span>{state.molecule.unsaturation}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">原子数:</span>
                <span>{state.molecule.atoms.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">化学键数:</span>
                <span>{state.molecule.bonds.length}</span>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-gray-700">
            <h3 className="font-semibold mb-2">⚛️ 杂化轨道分析</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-orange-400">sp³</span>
                <span>{state.analysisResult.hybridization.sp3.length} 个碳原子</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-400">sp²</span>
                <span>{state.analysisResult.hybridization.sp2.length} 个碳原子</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-red-400">sp</span>
                <span>{state.analysisResult.hybridization.sp.length} 个碳原子</span>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-gray-700">
            <h3 className="font-semibold mb-2">📐 共线分析</h3>
            {state.analysisResult.collinearGroups.length > 0 ? (
              <div className="space-y-2">
                {state.analysisResult.collinearGroups.map((group, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-800 rounded-lg p-2 text-sm cursor-pointer hover:bg-gray-700 hover:ring-2 hover:ring-red-500 transition-all"
                    onClick={() => updateSelectedAtoms(group)}
                    title="点击选中此共线组的原子"
                  >
                    <div className="text-red-400">共线组 {index + 1}</div>
                    <div className="font-mono">
                      {group.map(id => state.molecule.atoms.find(a => a.id === id)?.symbol).join('-')}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSelectAllCollinear}
                  className="w-full mt-2 px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-sm transition-colors"
                >
                  选中所有共线原子
                </button>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">未检测到共线原子</div>
            )}
          </div>

          <div className="p-4 border-b border-gray-700">
            <h3 className="font-semibold mb-2">📊 共面分析</h3>
            {state.analysisResult.coplanarGroups.length > 0 ? (
              <div className="space-y-2">
                {state.analysisResult.coplanarGroups.map((group, index) => (
                  <div 
                    key={index} 
                    className="bg-gray-800 rounded-lg p-2 text-sm cursor-pointer hover:bg-gray-700 hover:ring-2 hover:ring-blue-500 transition-all"
                    onClick={() => updateSelectedAtoms(group)}
                    title="点击选中此共面组的原子"
                  >
                    <div className="text-blue-400">共面组 {index + 1}</div>
                    <div className="font-mono">
                      {group.map(id => state.molecule.atoms.find(a => a.id === id)?.symbol).join('-')}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSelectAllCoplanar}
                  className="w-full mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors"
                >
                  选中所有共面原子
                </button>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">未检测到共面原子</div>
            )}
          </div>

          <div className="p-4">
            <h3 className="font-semibold mb-2">🎯 手动分析</h3>
            <div className="text-sm text-gray-400 mb-3">
              按住 Shift 键选择多个原子
            </div>
            {selectedAtomSymbols.length > 0 ? (
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <div className="text-sm text-gray-400 mb-1">已选择:</div>
                <div className="font-mono text-lg">{selectedAtomSymbols.join(', ')}</div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm mb-3">未选择原子</div>
            )}
            <button
              onClick={handleAnalyzeSelection}
              disabled={selectedAtomSymbols.length < 3}
              className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors mb-2 ${
                selectedAtomSymbols.length >= 3
                  ? 'bg-green-600 hover:bg-green-500'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              分析选中原子
            </button>
            
            <div className="space-y-2 mt-3">
              <button
                onClick={handleAdjustToCollinear}
                disabled={selectedAtomSymbols.length < 3 || !canAdjustToCollinear(state.molecule, state.selectedAtoms).canAdjust}
                className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                  selectedAtomSymbols.length >= 3 && canAdjustToCollinear(state.molecule, state.selectedAtoms).canAdjust
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                📐 调整为共线
              </button>
              <button
                onClick={handleAdjustToCoplanar}
                disabled={selectedAtomSymbols.length < 4 || !canAdjustToCoplanar(state.molecule, state.selectedAtoms).canAdjust}
                className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                  selectedAtomSymbols.length >= 4 && canAdjustToCoplanar(state.molecule, state.selectedAtoms).canAdjust
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                📊 调整为共面
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
