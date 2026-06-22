import { useState, useRef, useEffect } from 'react';
import { useMolecule } from '../context/MoleculeContext';

export function StatusBar() {
  const { state, setZoomLevel, resetZoom } = useMolecule();
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(state.zoomLevel.toString());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedAtom = state.selectedAtom 
    ? state.molecule.atoms.find(a => a.id === state.selectedAtom)
    : null;

  const selectedBond = state.selectedBond
    ? state.molecule.bonds.find(b => b.id === state.selectedBond)
    : null;

  const zoomOptions = [
    { value: 10, label: '10%' },
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 75, label: '75%' },
    { value: 100, label: '100%' },
    { value: 125, label: '125%' },
    { value: 150, label: '150%' },
    { value: 175, label: '175%' },
    { value: 200, label: '200%' },
  ];

  useEffect(() => {
    setInputValue(state.zoomLevel.toString());
  }, [state.zoomLevel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setInputValue(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue >= 10 && numValue <= 200) {
      setZoomLevel(numValue);
    }
  };

  const handleInputBlur = () => {
    const numValue = parseInt(inputValue);
    if (isNaN(numValue) || numValue < 10) {
      setInputValue('10');
      setZoomLevel(10);
    } else if (numValue > 200) {
      setInputValue('200');
      setZoomLevel(200);
    }
  };

  const handleSelectOption = (value: number) => {
    setZoomLevel(value);
    setInputValue(value.toString());
    setShowDropdown(false);
  };

  return (
    <div className="bg-gray-800 text-white px-4 py-2 border-t border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">
            工具: {
              state.tool === 'edit' ? '编辑' :
              state.tool === 'analyze' ? '分析' :
              state.tool === 'atom' ? '添加原子' :
              state.tool === 'bond_single' ? '单键' :
              state.tool === 'bond_double' ? '双键' :
              state.tool === 'bond_triple' ? '三键' : '未知'
            }
          </span>
          <span className="text-gray-400 text-sm">
            渲染模式: {
              state.renderMode === 'ball-stick' ? '球棍模型' :
              state.renderMode === 'space-fill' ? '空间填充' : '线框'
            }
          </span>
        </div>

        <div className="flex items-center gap-4">
          {selectedAtom && (
            <span className="text-sm">
              选中原子: <span className="font-medium" style={{ color: selectedAtom.color }}>{selectedAtom.symbol}</span>
              {selectedAtom.hybridization && (
                <span className="ml-2 text-gray-400">({selectedAtom.hybridization})</span>
              )}
            </span>
          )}
          {selectedBond && (
            <span className="text-sm">
              选中化学键: 键级 {selectedBond.order}
            </span>
          )}
          
          <div className="flex items-center gap-3" ref={dropdownRef}>
            {/* 百分比文本框 */}
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-20 bg-gray-700 text-white text-sm pl-2 pr-5 py-1 rounded border border-gray-600 hover:border-gray-500 focus:border-blue-500 focus:outline-none cursor-pointer"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">%</span>

              {/* 下拉选项 */}
              {showDropdown && (
                <div className="absolute bottom-full mb-1 left-0 bg-gray-700 border border-gray-600 rounded shadow-lg min-w-[80px] z-50">
                  {zoomOptions.map(option => (
                    <div
                      key={option.value}
                      onClick={() => handleSelectOption(option.value)}
                      className="px-3 py-1.5 hover:bg-gray-600 cursor-pointer text-sm text-center"
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 重置按钮 */}
            <button
              onClick={resetZoom}
              className="p-1.5 hover:bg-gray-700 rounded transition-colors"
              title="重置视图"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4V1h3M15 12v3h-3M1 12c0-2 1.5-4 4-5.5M15 4c0 2-1.5 4-4 5.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
