import { useRef, useEffect, useState, useCallback } from 'react';
import { MoleculeProvider } from './context/MoleculeContext';
import { DragProvider } from './context/DragContext';
import { GyroscopeProvider } from './context/GyroscopeContext';
import { Toolbar } from './components/Toolbar';
import { Canvas3D } from './components/Canvas3D';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Gyroscope } from './components/Gyroscope';
import { SmilesSearchPage } from './components/SmilesSearchPage';
import { AtomSelectPage } from './components/AtomSelectPage';

// 空心圆（左 C / 右 C）
function CircleSvg({ size = 24 }: { size?: number }) {
  const s = size / 24;
  return (
    <svg viewBox="-15 -15 30 30" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <circle cx="0" cy="0" r={7 * s} fill="none" stroke="#a0a0a0" strokeWidth={2 * s} />
    </svg>
  );
}

// 键（短横线）
function BondSvg({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: `${size}px`,
      height: `${size}px`,
      lineHeight: `${size}px`,
      fontSize: `${Math.round(size * 0.8)}px`,
      color: '#a0a0a0',
      textAlign: 'center',
      userSelect: 'none',
    }}>
      -
    </span>
  );
}

// 每个元素的路径定义：时间(秒) → {x%, y%}，角度扰动幅度
interface PathPoint { t: number; x: number; y: number; wobble?: number; }

// 为每个元素生成路径
function buildPaths(): { paths: Record<string, PathPoint[]>; converge: Record<string, {x:number, y:number}> } {
  const paths: Record<string, PathPoint[]> = {};
  const converge: Record<string, {x:number, y:number}> = {};

  // 分子整体：右侧进入 → 右半拉晃悠一个来回 → 汇聚右侧
   const molBase = [
     { t: 0, x: 82, y: 50 },
     { t: 3, x: 90, y: 35 },
     { t: 6, x: 75, y: 50 },
   ];
   // 所有分子元素走同一个路径（内部 flex 排列）
   ['circle-l', 'bond', 'circle-r'].forEach((id, i) => {
     paths[id] = molBase.map(p => ({ t: p.t + i * 0.3, x: p.x, y: p.y, wobble: 1 }));
   });

   converge['circle-l'] = { x: 82, y: 50 };
   converge['bond'] = { x: 82, y: 50 };
   converge['circle-r'] = { x: 82, y: 50 };

  // 文字：起点=终点，每个字走一个来回（用 flex 内部排列，整体定位）
   const charBase = [
     { t: 0, x: 2, y: 55 },
     { t: 3, x: 42, y: 35 },
     { t: 6, x: 2, y: 55 },
   ];
   // 所有字走同一个路径（内部 flex 排列）
   ['char-分', 'char-子', 'char-漫', 'char-游'].forEach((id, i) => {
     paths[id] = charBase.map(p => ({ t: p.t + i * 0.3, x: p.x, y: p.y, wobble: 2 }));
   });

   converge['char-分'] = { x: 2, y: 50 };
   converge['char-子'] = { x: 2, y: 50 };
   converge['char-漫'] = { x: 2, y: 50 };
   converge['char-游'] = { x: 2, y: 50 };

  return { paths, converge };
}

// 沿路径插值，加鱼游扰动
function samplePath(pts: PathPoint[], elapsed: number): { x: number; y: number } {
  const t = elapsed % pts[pts.length - 1].t;
  if (t <= pts[0].t) return { x: pts[0].x, y: pts[0].y };
  for (let i = 0; i < pts.length - 1; i++) {
    if (t >= pts[i].t && t < pts[i + 1].t) {
      const f = (t - pts[i].t) / (pts[i + 1].t - pts[i].t);
      const ease = f * f * (3 - 2 * f);
      const wobble = (pts[i].wobble || 1) * 0.6;
      const fishX = Math.sin(t * 8 + i) * wobble;
      const fishY = Math.sin(t * 6 + i * 1.3) * wobble;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * ease + fishX,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * ease + fishY,
      };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}

function TopBar() {
  const [items, setItems] = useState<Record<string, {x:number, y:number}>>({});
  const statusRef = useRef<'enter' | 'wander' | 'converge' | 'dwell' | 'reset'>('enter');
  const statusTimer = useRef(0);
  const animRef = useRef(0);
  const { paths, converge } = buildPaths();

  useEffect(() => {
    setItems({
      'char-分': { x: 50, y: 50 },
      'char-子': { x: 50, y: 50 },
      'char-漫': { x: 50, y: 50 },
      'char-游': { x: 50, y: 50 },
      'circle-l': { x: 50, y: 50 },
      'bond': { x: 50, y: 50 },
      'circle-r': { x: 50, y: 50 },
    });
  }, []);

  const tick = useCallback((now: number) => {
    if (!statusTimer.current) statusTimer.current = now;
    const elapsed = (now - statusTimer.current) / 1000;
    const result: Record<string, {x:number, y:number}> = {};
    const ids = ['circle-l', 'bond', 'circle-r', 'char-分', 'char-子', 'char-漫', 'char-游'];

    ids.forEach((id, i) => {
      const seed = i;
      const pt = paths[id];
      const delay = i < 3 ? i * 0.4 : 2.5 + (i - 3) * 0.4;
      const ct = converge[id];

      if (statusRef.current === 'enter') {
        const pe = Math.max(0, elapsed - delay);
        const pathLen = pt[pt.length - 1].t;
        const cycleT = 10;
        const t = Math.min(pe, cycleT);
        const pos = samplePath(pt, t);
        result[id] = pos;
        if (pe > cycleT && i === ids.length - 1) {
          statusRef.current = 'wander';
          statusTimer.current = now;
        }
      } else if (statusRef.current === 'wander') {
        const pe = Math.max(0, elapsed - delay);
        const t = (pe * 0.4) % 12;
        const pos = samplePath(pt, t);
        // 加入位置微扰
        const wiggle = Math.sin(now * 0.001 + seed) * 3;
        result[id] = { x: pos.x + wiggle * 0.6, y: pos.y + Math.sin(now * 0.0013 + seed * 1.3) * 2 };
        if (elapsed > 12) {
          statusRef.current = 'converge';
          statusTimer.current = now;
        }
      } else if (statusRef.current === 'converge') {
        const cx = ct.x;
         const cy = ct.y;
         const srcX = items[id]?.x ?? cx;
        const srcY = items[id]?.y ?? cy;
        const progress = Math.min(1, Math.max(0, (elapsed - 0.5) / 890));
        const ease = 1 - Math.pow(1 - progress, 3);
        const fishX = Math.sin(now * 0.003 + seed) * (1 - progress) * 1;
        const fishY = Math.sin(now * 0.0025 + seed * 1.7) * (1 - progress) * 1;
        result[id] = {
          x: srcX + (cx - srcX) * ease + fishX,
          y: srcY + (cy - srcY) * ease + fishY,
        };
        if (elapsed > 5) {
          statusRef.current = 'dwell';
          statusTimer.current = now;
        }
      } else if (statusRef.current === 'dwell') {
        const breathX = Math.sin(now * 0.0005 + seed) * 0.5;
        const breathY = Math.sin(now * 0.0004 + seed * 0.7) * 0.3;
        result[id] = { x: ct.x + breathX, y: ct.y + breathY };
        if (elapsed > 60) {
          statusRef.current = 'reset';
          statusTimer.current = now;
        }
      } else if (statusRef.current === 'reset') {
        const isMol = id === 'circle-l' || id === 'bond' || id === 'circle-r';
        result[id] = { x: isMol ? 105 : -5, y: 50 };
        if (elapsed > 0.5) {
          statusRef.current = 'enter';
          statusTimer.current = now;
        }
      }
    });

    setItems(result);
    animRef.current = requestAnimationFrame(tick);
  }, [items]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [tick]);

  // 总体位置：用文字第一个字的 position 作为组位置，分子用 circle-l 的位置
  const charPos = items['char-分'] || { x: 50, y: 50 };
  const molPos = items['circle-l'] || { x: 50, y: 50 };

  return (
    <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: '44px', backgroundColor: 'rgba(10, 10, 10, 0.8)', backdropFilter: 'blur(8px)', lineHeight: 0 }} className="relative overflow-hidden">
      {/* 文字组：固定在左侧，右移一个字的距离 */}
        <div style={{
           position: 'absolute',
           left: 'calc(max(0.5rem, env(safe-area-inset-left, 0.5rem)) + 14px)',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', userSelect: 'none' }}>分</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', userSelect: 'none' }}>子</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', userSelect: 'none' }}>漫</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', userSelect: 'none' }}>游</span>
        </div>
      {/* 分子组：整体定位 */}
      <div style={{
        position: 'absolute',
        left: `${molPos.x}%`,
        top: `${molPos.y}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
      }}>
        <CircleSvg size={22} />
        <BondSvg size={14} />
        <CircleSvg size={22} />
      </div>
    </div>
  );
}

function AppInner() {
  const [showSmilesPage, setShowSmilesPage] = useState(false);
  const [showAtomSelectPage, setShowAtomSelectPage] = useState(false);

  // 键盘弹出时滚动当前激活的输入框到可视区域
  useEffect(() => {
    const handleFocusin = () => {
      // 只有在主页面（没有弹出页面）时才执行滚动
      if (showSmilesPage || showAtomSelectPage) return;
      
      const activeElement = document.activeElement;
      if (!activeElement) return;
      
      // 检查元素是否已经在可视区域内
      const rect = activeElement.getBoundingClientRect();
      const isInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
      if (isInView) return;
      
      setTimeout(() => {
        document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    };
    document.addEventListener('focusin', handleFocusin);
    return () => document.removeEventListener('focusin', handleFocusin);
  }, [showSmilesPage, showAtomSelectPage]);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarHeight, setToolbarHeight] = useState(76);

  useEffect(() => {
    const measure = () => {
      if (toolbarRef.current) {
        setToolbarHeight(toolbarRef.current.offsetHeight);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (toolbarRef.current) observer.observe(toolbarRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-dvh relative bg-gray-900" style={{ minHeight: '100dvh' }}>
      {/* Canvas 占据全屏，分子原点位于屏幕中心 */}
      <div className="absolute inset-0">
        <Canvas3D toolbarHeight={toolbarHeight} />
        <AnalysisPanel toolbarHeight={toolbarHeight} />
      </div>
      {/* 万向仪 - 左下角，使用 absolute 定位，相对于根容器 */}
      <div
        style={{
          position: 'absolute',
          left: 'max(10px, env(safe-area-inset-left, 10px))',
          bottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
          zIndex: 10
        }}
      >
        <Gyroscope />
      </div>
      {/* TopBar - 叠加在 Canvas 上方 */}
      <div ref={toolbarRef} className="absolute top-0 left-0 right-0 z-20">
        <TopBar />
        <Toolbar onOpenSmilesSearch={() => setShowSmilesPage(true)} onOpenAtomSelect={() => setShowAtomSelectPage(true)} />
      </div>
      {showSmilesPage && <SmilesSearchPage onClose={() => setShowSmilesPage(false)} />}
      {showAtomSelectPage && <AtomSelectPage onClose={() => setShowAtomSelectPage(false)} />}
    </div>
  );
}

function App() {
  return (
    <MoleculeProvider>
      <DragProvider>
        <GyroscopeProvider>
          <AppInner />
        </GyroscopeProvider>
      </DragProvider>
    </MoleculeProvider>
  );
}

export default App;
