import { useState, useRef, useEffect } from 'react';
import { useMolecule } from '../context/MoleculeContext';
import { ELEMENTS, getElementColor } from '../utils/elements';
import { FUNCTIONAL_GROUPS, FUNCTIONAL_GROUP_CATEGORIES } from '../utils/functionalGroups';

const ALL_ATOMS = ELEMENTS.map(elem => ({
  symbol: elem.symbol,
  name: elem.name,
  color: getElementColor(elem.symbol),
}));

interface AtomSelectPageProps {
  onClose: () => void;
}

export function AtomSelectPage({ onClose }: AtomSelectPageProps) {
  const { state, setInsertAtom, setInsertFunctionalGroup } = useMolecule();
  const [tab, setTab] = useState<'atom' | 'group'>('atom');
  const [search, setSearch] = useState('');
  const [selectedAtomSymbol, setSelectedAtomSymbol] = useState<string | null>(state.insertAtomSymbol);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(state.insertFunctionalGroupId);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 最小化操作，不修改 document 级别样式，避免影响视口
    setTimeout(() => inputRef.current?.focus(), 100);
    
    // 若已有选中项，自动滚动到该行
    setTimeout(() => {
      if (selectedAtomSymbol && tab === 'atom') {
        const el = listRef.current?.querySelector(`[data-symbol="${selectedAtomSymbol}"]`);
        if (el && el instanceof HTMLElement) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else if (selectedGroupId && tab === 'group') {
        const el = listRef.current?.querySelector(`[data-group="${selectedGroupId}"]`);
        if (el && el instanceof HTMLElement) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 200);
    
    return () => {
      // 清理时也不做任何样式修改
      window.scrollTo(0, 0);
    };
  }, []);

  // 列表始终显示全部，不做过滤
  const displayAtoms = ALL_ATOMS;
  const displayGroups = FUNCTIONAL_GROUPS;

  // 点击原子：高亮 + 填充搜索框（只显示符号），不关闭页面
  const handleAtomClick = (symbol: string, _name: string) => {
    setSelectedAtomSymbol(symbol);
    setSelectedGroupId(null);
    setSearch(symbol);
    // 滚动到选中项
    setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-symbol="${symbol}"]`);
      if (el && el instanceof HTMLElement) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  };

  // 点击官能团：高亮 + 填充搜索框（只显示分子式），不关闭页面
  const handleGroupClick = (groupId: string, _name: string, formula: string) => {
    setSelectedGroupId(groupId);
    setSelectedAtomSymbol(null);
    setSearch(formula);
    // 滚动到选中项
    setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-group="${groupId}"]`);
      if (el && el instanceof HTMLElement) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  };

  // 确定按钮：真正选择并关闭
  const handleConfirm = () => {
    if (tab === 'atom' && selectedAtomSymbol) {
      setInsertAtom(selectedAtomSymbol);
      onClose();
      return;
    }
    if (tab === 'group' && selectedGroupId) {
      setInsertFunctionalGroup(selectedGroupId);
      onClose();
      return;
    }
    // 没有通过点击选中时，尝试从搜索框精确匹配
    if (tab === 'atom') {
      const trimmed = search.trim();
      const match = ALL_ATOMS.find(a =>
        a.symbol.toLowerCase() === trimmed.toLowerCase() ||
        a.name === trimmed
      );
      if (match) {
        setInsertAtom(match.symbol);
        onClose();
      }
    } else {
      const trimmed = search.trim();
      const match = FUNCTIONAL_GROUPS.find(g =>
        g.name === trimmed ||
        g.formula.toLowerCase() === trimmed.toLowerCase() ||
        trimmed.endsWith(g.formula) ||
        trimmed.startsWith(g.name)
      );
      if (match) {
        setInsertFunctionalGroup(match.id);
        onClose();
      }
    }
  };

  const hasSelection = tab === 'atom' ? !!selectedAtomSymbol : !!selectedGroupId;

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
            // 输入内容变化时，清空选中状态（避免误会）
            setSelectedAtomSymbol(null);
            setSelectedGroupId(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleConfirm();
            }
          }}
          placeholder="搜索原子或官能团..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          className="bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 rounded-lg"
          style={{ flex: 1, height: '28px', padding: '0 0.75rem', border: 'none', outline: 'none', fontSize: '16px' }}
        />
        <button
          onClick={handleConfirm}
          disabled={!hasSelection && !search.trim()}
          className={`rounded-lg text-sm font-bold transition-colors ${
            (hasSelection || search.trim()) ? 'bg-blue-600/80 hover:bg-blue-700/80 text-white' : 'bg-gray-600/80 text-gray-400'
          }`}
          style={{ height: '28px', padding: '0 0.75rem', border: 'none', cursor: (hasSelection || search.trim()) ? 'pointer' : 'not-allowed', opacity: (hasSelection || search.trim()) ? 1 : 0.6 }}
        >
          选中
        </button>
      </div>

      {/* 提示行 */}
      <div style={{
        padding: '0.5rem 1rem',
        color: '#9ca3af',
        fontSize: '12px',
        borderBottom: '1px solid #1f2937',
      }}>
        {hasSelection
          ? `已选：${tab === 'atom'
              ? (ALL_ATOMS.find(a => a.symbol === selectedAtomSymbol)?.name || '') + ' ' + selectedAtomSymbol
              : (FUNCTIONAL_GROUPS.find(g => g.id === selectedGroupId)?.name || '') + ' ' +
                (FUNCTIONAL_GROUPS.find(g => g.id === selectedGroupId)?.formula || '')
            }，点击"选中"完成选择`
          : search.trim() ? '输入关键字过滤，点击列表项选择' : '从下方列表选择一项'}
      </div>

      {/* 页签 */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #374151',
      }}>
        <button
          onClick={() => {
            setTab('atom');
          }}
          style={{
            flex: 1,
            padding: '0.6rem 0',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: tab === 'atom' ? '#2563eb' : '#9ca3af',
            borderBottom: tab === 'atom' ? '2px solid #2563eb' : '2px solid transparent',
          }}
        >
          原子
        </button>
        <button
          onClick={() => {
            setTab('group');
          }}
          style={{
            flex: 1,
            padding: '0.6rem 0',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: tab === 'group' ? '#2563eb' : '#9ca3af',
            borderBottom: tab === 'group' ? '2px solid #2563eb' : '2px solid transparent',
          }}
        >
          官能团
        </button>
      </div>

      {/* 列表 */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem',
        }}
      >
        {tab === 'atom' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.5rem',
            }}>
              {displayAtoms.map((atom) => {
                const isSelected = selectedAtomSymbol === atom.symbol;
                return (
                  <button
                    key={atom.symbol}
                    data-symbol={atom.symbol}
                    onClick={() => handleAtomClick(atom.symbol, atom.name)}
                    style={{
                      padding: '0.75rem 0.5rem',
                      textAlign: 'center',
                      background: isSelected ? 'rgba(37, 99, 235, 0.25)' : '#1f2937',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #374151',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <span style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: atom.color,
                      color: atom.color === '#FFFFFF' || atom.color === '#FFFF30' ? '#000' : '#FFF',
                      opacity: isSelected ? 1 : 0.8,
                    }}>
                      {atom.symbol.length > 2 ? atom.symbol.slice(0, 2) : atom.symbol}
                    </span>
                    <span style={{ color: isSelected ? '#60a5fa' : '#d1d5db', fontSize: '11px' }}>{atom.name}</span>
                    <span style={{ color: '#9ca3af', fontSize: '10px', fontFamily: 'monospace' }}>{atom.symbol}</span>
                  </button>
                );
              })}
            </div>
        ) : (
            <>
              {FUNCTIONAL_GROUP_CATEGORIES.map(category => {
                const groups = displayGroups.filter(g => g.category === category);
                if (groups.length === 0) return null;
                return (
                  <div key={category}>
                    <div style={{
                      padding: '0.5rem 0.5rem 0.25rem',
                      fontSize: '12px',
                      color: '#9ca3af',
                      fontWeight: 'bold',
                      position: 'sticky',
                      top: 0,
                      backgroundColor: '#111827',
                    }}>
                      {category}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                      padding: '0 0 0.75rem',
                    }}>
                      {groups.map(group => {
                        const isSelected = selectedGroupId === group.id;
                        return (
                          <button
                            key={group.id}
                            data-group={group.id}
                            onClick={() => handleGroupClick(group.id, group.name, group.formula)}
                            style={{
                              padding: '0.75rem 0.5rem',
                              textAlign: 'center',
                              background: isSelected ? 'rgba(37, 99, 235, 0.25)' : '#1f2937',
                              border: isSelected ? '2px solid #2563eb' : '1px solid #374151',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'background-color 0.15s',
                            }}
                          >
                            <span style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.5)' : '#4b5563',
                              color: '#d1d5db',
                            }}>
                              {group.formula.slice(0, 2)}
                            </span>
                            <span style={{ color: isSelected ? '#60a5fa' : '#d1d5db', fontSize: '11px' }}>{group.name}</span>
                            <span style={{ color: '#9ca3af', fontSize: '10px', fontFamily: 'monospace' }}>{group.formula}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
        )}
      </div>
    </div>
  );
}
