import { useRef, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGyroscope } from '../context/GyroscopeContext';

type AxisDirection = 'east' | 'west' | 'up' | 'down' | 'south' | 'north';

export function Gyroscope() {
  const {
    sphericalRef,
    viewQuaternionRef,
    showRotation,
    resetKey,
    selectedAtomId,
    moleculeAtoms,
    moleculeRotationRef,
    moleculeGroupRef,
    onViewDirection,
    isDarkMode,
  } = useGyroscope();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const ringsGroupRef = useRef<THREE.Group | null>(null);
  const arrowGroupRef = useRef<THREE.Group | null>(null);
  const centerDiscRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number>();
  const directionDisplayRef = useRef<HTMLDivElement>(null);
  const atomCoordDisplayRef = useRef<HTMLDivElement>(null);
  
  const cameraSphericalRef = sphericalRef;
  const isDarkModeRef = useRef(true);
  const selectedAtomIdRef = useRef(selectedAtomId);
  const moleculeAtomsRef = useRef(moleculeAtoms);
  const moleculeRotationRefRef = useRef(moleculeRotationRef);
  const moleculeGroupRefRef = useRef(moleculeGroupRef);

  // 保持 ref 始终指向最新值，让 animate 能读取到
  selectedAtomIdRef.current = selectedAtomId;
  moleculeAtomsRef.current = moleculeAtoms;
  moleculeGroupRefRef.current = moleculeGroupRef;

  // 跟踪每个轴的当前方向（正/反交替），用于切换
  const [axisDirection, setAxisDirection] = useState<{
    x: 'east' | 'west',
    y: 'up' | 'down',
    z: 'south' | 'north'
  }>({ x: 'east', y: 'up', z: 'south' });
  
  // 当前选中的轴
  const [activeAxis, setActiveAxis] = useState<'x' | 'y' | 'z' | null>(null);

  // 重置时恢复初始状态
  useEffect(() => {
    setAxisDirection({ x: 'east', y: 'up', z: 'south' });
    setActiveAxis(null);
  }, [resetKey]);

  useEffect(() => {
    isDarkModeRef.current = isDarkMode;
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isDarkMode ? 0x1a1a1a : 0xf0f0f0);
    }
  }, [isDarkMode]);

  const sphericalToPosition = (theta: number, phi: number, radius: number = 10): THREE.Vector3 => {
    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.cos(theta)
    );
  };

  // 方向映射（原则1）：+Z=南(屏幕内侧)，-Z=北(屏幕外侧)，-X=东，+X=西，+Y=上，-Y=下
  // 与 getViewDirectionFromQuat 一致，使用 viewQuat.invert()*(0,0,1) 公式
  const calculateDirection = (direction: THREE.Vector3): string => {
    const x = direction.x;
    const y = direction.y;
    const z = direction.z;

    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);

    let mainDirection = '';
    let horizontalDeviation = 0;
    let verticalDeviation = 0;

    if (absX >= absY && absX >= absZ) {
      mainDirection = x < 0 ? '东' : '西';
      horizontalDeviation = Math.atan2(Math.abs(z), Math.abs(x)) * (180 / Math.PI);
      verticalDeviation = Math.atan2(Math.abs(y), Math.abs(x)) * (180 / Math.PI);
    } else if (absZ >= absX && absZ >= absY) {
      mainDirection = z > 0 ? '南' : '北';
      horizontalDeviation = Math.atan2(Math.abs(x), Math.abs(z)) * (180 / Math.PI);
      verticalDeviation = Math.atan2(Math.abs(y), Math.abs(z)) * (180 / Math.PI);
    } else {
      mainDirection = y > 0 ? '上' : '下';
      horizontalDeviation = Math.atan2(Math.abs(x), Math.abs(y)) * (180 / Math.PI);
      verticalDeviation = Math.atan2(Math.abs(z), Math.abs(y)) * (180 / Math.PI);
    }

    let horizontalBias = '';
    if (mainDirection !== '东' && mainDirection !== '西') {
      horizontalBias = x < 0 ? '偏东' : '偏西';
    } else {
      horizontalBias = z > 0 ? '偏南' : '偏北';
    }

    let verticalBias = y > 0 ? '偏上' : '偏下';

    if (mainDirection === '上' || mainDirection === '下') {
      if (Math.abs(x) > Math.abs(z)) {
        horizontalBias = x < 0 ? '偏东' : '偏西';
      } else {
        horizontalBias = z > 0 ? '偏南' : '偏北';
      }
      return `${mainDirection}，${horizontalBias}${horizontalDeviation.toFixed(0)}°；`;
    }

    return `${mainDirection}，${horizontalBias}${horizontalDeviation.toFixed(0)}°，${verticalBias}${verticalDeviation.toFixed(0)}°；`;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = 120;
    const height = 120;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkModeRef.current ? 0x1a1a1a : 0xf0f0f0);
    sceneRef.current = scene;

    const aspect = width / height;
    const frustumSize = 3;
    const camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    camera.position.set(0, 0, -10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const group = new THREE.Group();
    scene.add(group);

    const ringsGroup = new THREE.Group();
    group.add(ringsGroup);
    ringsGroupRef.current = ringsGroup;

    const tubeRadius = 0.03;
    const verticalRingRadius = 1.4;
    const horizontalDiscRadius = 1.0;
    
    const yDiscGeometry = new THREE.CircleGeometry(horizontalDiscRadius, 64);
    const yDiscMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xD4AF37, transparent: true, opacity: 1.0, side: THREE.DoubleSide
    });
    const yDisc = new THREE.Mesh(yDiscGeometry, yDiscMaterial);
    yDisc.rotation.x = Math.PI / 2;
    ringsGroup.add(yDisc);
    
    const yDiscBackGeometry = new THREE.CircleGeometry(horizontalDiscRadius, 64);
    const yDiscBackMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xD4AF37, transparent: true, opacity: 1.0, side: THREE.BackSide
    });
    const yDiscBack = new THREE.Mesh(yDiscBackGeometry, yDiscBackMaterial);
    yDiscBack.rotation.x = Math.PI / 2;
    ringsGroup.add(yDiscBack);
    
    const yRingGeometry = new THREE.TorusGeometry(horizontalDiscRadius, tubeRadius, 16, 64);
    const yRingMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xD4AF37, transparent: true, opacity: 1.0, side: THREE.DoubleSide
    });
    const yRing = new THREE.Mesh(yRingGeometry, yRingMaterial);
    yRing.rotation.x = Math.PI / 2;
    ringsGroup.add(yRing);
    
    const xRingGeometry = new THREE.TorusGeometry(verticalRingRadius, tubeRadius, 16, 64);
    const xRingMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xff6666, transparent: true, opacity: 0.2, side: THREE.DoubleSide
    });
    const xRing = new THREE.Mesh(xRingGeometry, xRingMaterial);
    xRing.rotation.y = Math.PI / 2;
    ringsGroup.add(xRing);
    
    const zRingGeometry = new THREE.TorusGeometry(verticalRingRadius, tubeRadius, 16, 64);
    const zRingMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x6666ff, transparent: true, opacity: 1.0, side: THREE.DoubleSide
    });
    const zRing = new THREE.Mesh(zRingGeometry, zRingMaterial);
    ringsGroup.add(zRing);

    const discGeometry = new THREE.CircleGeometry(0.1, 32);
    const discMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xD4AF37, transparent: true, opacity: 1.0, side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeometry, discMaterial);
    ringsGroup.add(disc);
    centerDiscRef.current = disc;
    
    const centerBallGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const centerBallMaterial = new THREE.MeshBasicMaterial({ color: 0x909090, transparent: true, opacity: 1.0 });
    const centerBall = new THREE.Mesh(centerBallGeometry, centerBallMaterial);
    ringsGroup.add(centerBall);
    
    const arrowGroup = new THREE.Group();
    ringsGroup.add(arrowGroup);
    arrowGroupRef.current = arrowGroup;
    
    const arrowLineGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
    const arrowLineMaterial = new THREE.MeshBasicMaterial({ color: 0x6666ff, transparent: true, opacity: 1.0 });
    const arrowLine = new THREE.Mesh(arrowLineGeometry, arrowLineMaterial);
    arrowLine.position.y = 0.2;
    arrowGroup.add(arrowLine);
    
    const arrowHeadGeometry = new THREE.ConeGeometry(0.08, 0.25, 16);
    const arrowHeadMaterial = new THREE.MeshBasicMaterial({ color: 0x6666ff, transparent: true, opacity: 1.0 });
    const arrowHead = new THREE.Mesh(arrowHeadGeometry, arrowHeadMaterial);
    arrowHead.position.y = 0.525;
    arrowGroup.add(arrowHead);
    
    const ballGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    const ballMaterial = new THREE.MeshBasicMaterial({ color: 0x909090, transparent: true, opacity: 0.5 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.y = -0.4;
    arrowGroup.add(ball);
    
    const zArrowLineGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
    const zArrowLineMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 1.0 });
    const zArrowLine = new THREE.Mesh(zArrowLineGeometry, zArrowLineMaterial);
    zArrowLine.rotation.x = Math.PI / 2;
    zArrowLine.position.z = 0.2;
    arrowGroup.add(zArrowLine);
    
    const zArrowHeadGeometry = new THREE.ConeGeometry(0.08, 0.25, 16);
    const zArrowHeadMaterial = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 1.0 });
    const zArrowHead = new THREE.Mesh(zArrowHeadGeometry, zArrowHeadMaterial);
    zArrowHead.rotation.x = Math.PI / 2;
    zArrowHead.position.z = 0.525;
    arrowGroup.add(zArrowHead);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (ringsGroupRef.current && arrowGroupRef.current && cameraRef.current) {
        const currentViewQuat = viewQuaternionRef.current.clone();
        // 相机在 -Z 看向原点，与画布方向一致
        // 对 viewQuat 的 X 分量取反：X 轴旋转取反（修正上下），Y/Z 轴旋转不变
        const adjustedQuat = currentViewQuat.clone();
        adjustedQuat.x = -adjustedQuat.x;
        ringsGroupRef.current.quaternion.copy(adjustedQuat);
        
        // 显示当前观察者所看向的方向 = viewQuat.invert() * (0,0,1)
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(viewQuaternionRef.current.clone().invert());
        
        if (directionDisplayRef.current) {
          directionDisplayRef.current.textContent = calculateDirection(direction);
        }
        
        // 显示选中原子的世界坐标
        if (atomCoordDisplayRef.current) {
          const currentSelectedAtomId = selectedAtomIdRef.current;
          const currentMoleculeAtoms = moleculeAtomsRef.current;
          if (currentSelectedAtomId && currentMoleculeAtoms) {
            const atom = currentMoleculeAtoms.find(a => a.id === currentSelectedAtomId);
            if (atom) {
              // 直接使用原子局部坐标作为显示坐标
              const worldPos = new THREE.Vector3(atom.position.x, atom.position.y, atom.position.z);
              
              // 找原子编号
              const atomIndex = currentMoleculeAtoms.findIndex(a => a.id === currentSelectedAtomId);
              atomCoordDisplayRef.current.textContent =
                `${atomIndex}号${atom.symbol}（${worldPos.x.toFixed(2)}，${worldPos.y.toFixed(2)}，${worldPos.z.toFixed(2)}）`;
            } else {
              atomCoordDisplayRef.current.textContent = '';
            }
          } else {
            atomCoordDisplayRef.current.textContent = '';
          }
        }
      }
      
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  // 点击方向按钮
  const handleAxisClick = (axis: 'x' | 'y' | 'z') => {
    let newDirection: AxisDirection;
    setAxisDirection(prev => {
      let newState: typeof prev;
      if (axis === 'x') {
        // 如果当前已选中此轴，切换方向；否则重置到字面方向（东），其他轴恢复初始
        const next = activeAxis === 'x' ? (prev.x === 'east' ? 'west' : 'east') : 'east';
        newState = activeAxis === 'x' ? { ...prev, x: next } : { x: next, y: 'up', z: 'south' };
        newDirection = next;
      } else if (axis === 'y') {
        const next = activeAxis === 'y' ? (prev.y === 'up' ? 'down' : 'up') : 'up';
        newState = activeAxis === 'y' ? { ...prev, y: next } : { x: 'east', y: next, z: 'south' };
        newDirection = next;
      } else {
        const next = activeAxis === 'z' ? (prev.z === 'south' ? 'north' : 'south') : 'south';
        newState = activeAxis === 'z' ? { ...prev, z: next } : { x: 'east', y: 'up', z: next };
        newDirection = next;
      }
      return newState;
    });
    setActiveAxis(axis);
    setTimeout(() => {
      onViewDirection?.(newDirection!);
    }, 0);
  };

  // 方向按钮配置——文字随方向切换变化
  const axisConfig = [
    { 
      axis: 'x' as const, 
      getLabel: () => axisDirection.x === 'east' ? '东' : '西',
      hoverColor: '#D4AF37', 
      activeColor: '#D4AF37' 
    },
    { 
      axis: 'y' as const, 
      getLabel: () => axisDirection.y === 'up' ? '上' : '下',
      hoverColor: '#6666ff', 
      activeColor: '#6666ff' 
    },
    { 
      axis: 'z' as const, 
      getLabel: () => axisDirection.z === 'south' ? '南' : '北',
      hoverColor: '#ff4444', 
      activeColor: '#ff4444' 
    },
  ];

  // 万向仪宽度120px，3个按钮+2个间隔，间隔4px，按钮等宽
  // 120 = 3*btnW + 2*4 => btnW = (120-8)/3 ≈ 37.3px
  const btnWidth = (120 - 8) / 3;

  const defaultBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const defaultColor = isDarkMode ? '#ccc' : '#555';

  return useMemo(() => {
    return (
      <div className="relative" style={{ width: '160px', maxWidth: '320px' }}>
      <div
        ref={containerRef}
        style={{
          width: showRotation ? '120px' : '0px',
          height: showRotation ? '120px' : '0px',
          border: isDarkMode ? '2px solid #444' : '2px solid #ccc',
          borderRadius: '8px',
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: showRotation ? 1 : 0,
          transition: 'opacity 0.15s',
        }}
      />
      {/* 方向标签 + 方向/坐标显示 - 同一行 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '4px',
      }}>
        <div style={{
          display: 'flex',
          gap: '4px',
          flexShrink: 0,
        }}>
          {axisConfig.map(({ axis, getLabel, hoverColor, activeColor }) => {
            const isActive = activeAxis === axis;
            return (
              <div
                key={axis}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: `${btnWidth}px`,
                  height: '22px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: isActive ? '#fff' : defaultColor,
                  backgroundColor: isActive ? activeColor : defaultBg,
                  border: isActive ? `1px solid ${activeColor}` : '1px solid transparent',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s',
                }}
                onClick={() => handleAxisClick(axis)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = hoverColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {getLabel()}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '22px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#909090',
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            gap: '8px',
          }}
        >
          <span ref={directionDisplayRef}>南向，偏东0°，偏下0°；</span>
          <span ref={atomCoordDisplayRef} />
        </div>
      </div>
    </div>
  );}, [isDarkMode, onViewDirection, axisDirection, activeAxis, selectedAtomId, moleculeAtoms, moleculeRotationRef, showRotation]);
}
