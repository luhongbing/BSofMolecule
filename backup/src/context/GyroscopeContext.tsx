import React, { createContext, useContext, useRef, useCallback, useState, useEffect, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Atom } from '../types';

interface GyroscopeContextType {
  sphericalRef: React.MutableRefObject<{ theta: number; phi: number; radius: number }>;
  viewQuaternionRef: React.MutableRefObject<THREE.Quaternion>;
  showRotation: boolean;
  resetKey: number;
  selectedAtomId: string | null;
  moleculeAtoms: Atom[];
  moleculeRotationRef: React.MutableRefObject<THREE.Quaternion>;
  moleculeGroupRef: React.MutableRefObject<THREE.Group | null>;
  onViewDirection: (direction: string) => void;
  isDarkMode: boolean;
}

const GyroscopeContext = createContext<GyroscopeContextType | null>(null);

export function GyroscopeProvider({ children }: { children: ReactNode }) {
  const sphericalRef = useRef({ theta: 0, phi: Math.PI / 2, radius: 20 });
  const viewQuaternionRef = useRef(new THREE.Quaternion());
  const moleculeRotationRef = useRef(new THREE.Quaternion());
  const moleculeGroupRef = useRef<THREE.Group | null>(null);
  
  const [showRotation, setShowRotation] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [moleculeAtoms, setMoleculeAtoms] = useState<Atom[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const onViewDirection = useCallback((direction: string) => {
    const event = new CustomEvent('viewDirection', { detail: direction });
    window.dispatchEvent(event);
  }, []);

  useEffect(() => {
    const handleSelectAtom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSelectedAtomId(detail?.atomId || null);
    };
    const handleMoleculeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMoleculeAtoms(detail?.atoms || []);
    };
    const handleShowRotation = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setShowRotation(detail?.show || false);
    };
    const handleResetGyro = () => {
      setResetKey(k => k + 1);
    };
    const handleDarkModeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsDarkMode(detail?.isDarkMode ?? true);
    };

    window.addEventListener('selectAtom', handleSelectAtom);
    window.addEventListener('moleculeChange', handleMoleculeChange);
    window.addEventListener('showGyroRotation', handleShowRotation);
    window.addEventListener('resetGyro', handleResetGyro);
    window.addEventListener('darkModeChange', handleDarkModeChange);

    return () => {
      window.removeEventListener('selectAtom', handleSelectAtom);
      window.removeEventListener('moleculeChange', handleMoleculeChange);
      window.removeEventListener('showGyroRotation', handleShowRotation);
      window.removeEventListener('resetGyro', handleResetGyro);
      window.removeEventListener('darkModeChange', handleDarkModeChange);
    };
  }, []);

  return (
    <GyroscopeContext.Provider
      value={{
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
      }}
    >
      {children}
    </GyroscopeContext.Provider>
  );
}

export function useGyroscope() {
  const context = useContext(GyroscopeContext);
  if (!context) {
    throw new Error('useGyroscope must be used within a GyroscopeProvider');
  }
  return context;
}
