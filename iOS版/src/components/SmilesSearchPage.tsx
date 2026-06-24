import { useState, useRef, useEffect } from 'react';
import { useMolecule } from '../context/MoleculeContext';
import { PRESET_MOLECULES } from '../utils/presets';
import { MOLECULE_CREATORS } from '../utils/molecules';
import { parseSmilesToMolecule } from '../utils/smilesParser';

interface SmilesSearchPageProps {
  onClose: () => void;
}

export function SmilesSearchPage({ onClose }: SmilesSearchPageProps) {
  const { state, setMolecule } = useMolecule();
  const [search, setSearch] = useState(state.molecule.smiles || state.molecule.name || '');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // 根据当前输入（name 或 smiles）找到匹配项（用于高亮显示）
  const getMatchFromInput = () => {
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return null;
    // 优先精确匹配 name
    let match = PRESET_MOLECULES.find(p => p.name.toLowerCase() === trimmed);
    if (match) return match;
    // 其次精确匹配 smiles
    match = PRESET_MOLECULES.find(p => p.smiles.toLowerCase() === trimmed);
    if (match) return match;
    // 再尝试包含匹配 name
    match = PRESET_MOLECULES.find(p => p.name.toLowerCase().includes(trimmed) || trimmed.includes(p.name.toLowerCase()));
    if (match) return match;
    return null;
  };

  useEffect(() => {
    // 最小化操作，不修改 document 级别样式，避免影响视口
    setTimeout(() => inputRef.current?.focus(), 100);
    
    return () => {
      // 清理时也不做任何样式修改
      window.scrollTo(0, 0);
    };
  }, []);

  // 输入有内容时，自动滚动到匹配的分子行（仅首次或匹配变化时）
  useEffect(() => {
    if (!search.trim()) {
      hasScrolledRef.current = false;
      return;
    }
    const match = getMatchFromInput();
    if (!match) {
      hasScrolledRef.current = false;
      setSelectedName(null);
      return;
    }
    setSelectedName(match.name);
    if (listRef.current && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      setTimeout(() => {
        const row = listRef.current?.querySelector(`[data-name="${match.name}"]`);
        if (row && row instanceof HTMLElement) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // 列表始终显示全部预置分子，不做过滤
  const displayList = PRESET_MOLECULES;

  // 点击某一行：填充输入框，高亮，不关闭页面
  const handleRowClick = (preset: { name: string; smiles: string }) => {
    setSelectedName(preset.name);
    setSearch(preset.smiles);
    hasScrolledRef.current = false;
  };

  // 确定按钮：实际加载分子并关闭页面
  const handleConfirm = () => {
    const nameOrSmiles = search.trim();
    if (!nameOrSmiles) return;

    // 先尝试通过匹配项加载
    const match = getMatchFromInput();
    if (match) {
      if (MOLECULE_CREATORS[match.name]) {
        const molecule = MOLECULE_CREATORS[match.name]();
        setMolecule({ ...molecule, name: match.name, smiles: match.smiles });
        onClose();
        return;
      }
    }

    // 特殊分子处理
    if (nameOrSmiles === 'C(C=C)(C=C)(C=C)C=C' || nameOrSmiles === 'C(=C)(=C)(=C)=C') {
      const atoms: { id: string; symbol: string; position: { x: number; y: number; z: number }; atomicNumber: number; color: string }[] = [];
      const bonds: { id: string; atom1Id: string; atom2Id: string; order: number }[] = [];
      let atomId = 0;
      let bondId = 0;
      const ccBondLength = 1.54;
      const chBondLength = 1.09;
      const cdBondLength = 1.34;
      const normalize = (v: { x: number; y: number; z: number }) => {
        const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        return len > 0 ? { x: v.x / len, y: v.y / len, z: v.z / len } : { x: 1, y: 0, z: 0 };
      };
      const cross = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      });
      const addVec = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => ({
        x: a.x + b.x, y: a.y + b.y, z: a.z + b.z,
      });
      const scale = (v: { x: number; y: number; z: number }, s: number) => ({
        x: v.x * s, y: v.y * s, z: v.z * s,
      });
      const center = { x: 0, y: 0, z: 0 };
      atoms.push({ id: `a${atomId++}`, symbol: 'C', position: center, atomicNumber: 6, color: '#888888' });
      const directions = [
        normalize({ x: 1, y: 1, z: 1 }),
        normalize({ x: -1, y: -1, z: 1 }),
        normalize({ x: 1, y: -1, z: -1 }),
        normalize({ x: -1, y: 1, z: -1 }),
      ];
      directions.forEach((dir) => {
        const cp = addVec(center, scale(dir, cdBondLength));
        atoms.push({ id: `a${atomId++}`, symbol: 'C', position: cp, atomicNumber: 6, color: '#888888' });
        bonds.push({ id: `b${bondId++}`, atom1Id: 'a0', atom2Id: `a${atomId - 1}`, order: 2 });
        const perp1 = normalize(cross(dir, { x: 0, y: 0, z: 1 }));
        const perp2 = normalize(cross(dir, perp1));
        const hp = addVec(cp, scale(perp1, chBondLength));
        atoms.push({ id: `a${atomId++}`, symbol: 'H', position: hp, atomicNumber: 1, color: '#ffffff' });
        bonds.push({ id: `b${bondId++}`, atom1Id: `a${atomId - 2}`, atom2Id: `a${atomId - 1}`, order: 1 });
        const hp2 = addVec(cp, scale(perp2, chBondLength));
        atoms.push({ id: `a${atomId++}`, symbol: 'H', position: hp2, atomicNumber: 1, color: '#ffffff' });
        bonds.push({ id: `b${bondId++}`, atom1Id: `a${atomId - 3}`, atom2Id: `a${atomId - 1}`, order: 1 });
      });
      setMolecule({ atoms, bonds, name: '四乙烯基甲烷', smiles: 'C(C=C)(C=C)(C=C)C=C' });
      onClose();
      return;
    }

    // 尝试作为 SMILES 解析
    try {
      const molecule = parseSmilesToMolecule(nameOrSmiles);
      if (molecule) {
        setMolecule({ ...molecule, name: nameOrSmiles, smiles: nameOrSmiles });
      }
    } catch {
      alert('无法解析该SMILES表达式，请检查输入是否正确');
      return;
    }
    onClose();
  };

  const hasInput = search.trim().length > 0;

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 'env(safe-area-inset-top, 44px)',
      bottom: 0,
      backgroundColor: '#111827',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* 顶部输入栏 - 与主页面工具栏保持一致的位置和高度 */}
      <div className="bg-gray-800/80 backdrop-blur-sm text-white pl-2 pr-3 py-1" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onClose}
          className="flex items-center justify-center text-blue-600 hover:text-blue-500 transition-colors"
          style={{ width: '32px', height: '28px', fontSize: '18px', background: 'none', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          ←
        </button>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            hasScrolledRef.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleConfirm();
            }
          }}
          placeholder="输入 SMILES 或分子名搜索..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          className="bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg"
          style={{ flex: 1, height: '28px', padding: '0 0.75rem', border: 'none', outline: 'none', fontSize: '16px' }}
        />
        <button
          onClick={handleConfirm}
          disabled={!hasInput}
          className={`rounded-lg text-sm font-bold transition-colors ${
            hasInput ? 'bg-blue-600/80 hover:bg-blue-700/80 text-white' : 'bg-gray-600/80 text-gray-400'
          }`}
          style={{ height: '28px', padding: '0 0.75rem', border: 'none', cursor: hasInput ? 'pointer' : 'not-allowed', opacity: hasInput ? 1 : 0.6 }}
        >
          确定
        </button>
      </div>

      {/* 提示行 */}
      <div style={{
        padding: '0.5rem 1rem',
        color: '#9ca3af',
        fontSize: '12px',
        borderBottom: '1px solid #1f2937',
      }}>
        {hasInput ? '点击列表项可快速填充输入框，点击确定加载分子' : '从下方列表选择一个分子'}
      </div>

      {/* 列表 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem 0',
        }}
      >
        {displayList.map((preset) => {
          const isSelected = selectedName === preset.name;
          const isMatchFromInput = getMatchFromInput()?.name === preset.name;
          const isHighlight = isSelected || isMatchFromInput;
          return (
            <button
              key={preset.name}
              data-name={preset.name}
              onClick={() => handleRowClick(preset)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                textAlign: 'left',
                backgroundColor: isHighlight ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                border: 'none',
                borderBottom: isHighlight ? '2px solid #2563eb' : '1px solid #1f2937',
                borderLeft: isHighlight ? '3px solid #2563eb' : 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isHighlight) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(55, 65, 81, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isHighlight) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: isHighlight ? '#60a5fa' : '#f3f4f6', fontSize: '15px', fontWeight: 'bold' }}>{preset.name}</span>
                <span style={{ color: '#9ca3af', fontSize: '12px', fontFamily: 'monospace' }}>{preset.smiles}</span>
                {isHighlight && (
                  <span style={{
                    marginLeft: 'auto',
                    color: '#60a5fa',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}>已选</span>
                )}
              </div>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>{preset.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
