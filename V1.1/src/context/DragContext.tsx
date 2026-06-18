import React, { createContext, useContext, useState, useCallback } from 'react';

interface DragContextType {
  draggedAtom: string | null;
  draggedBondOrder: number | null;
  bondStartAtom: string | null;
  tempBondEnd: { x: number; y: number; z: number } | null;
  startDragAtom: (symbol: string) => void;
  startDragBond: (order: number) => void;
  setBondStartAtom: (atomId: string | null) => void;
  setTempBondEnd: (pos: { x: number; y: number; z: number } | null) => void;
  clearDrag: () => void;
}

const DragContext = createContext<DragContextType | null>(null);

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [draggedAtom, setDraggedAtom] = useState<string | null>(null);
  const [draggedBondOrder, setDraggedBondOrder] = useState<number | null>(null);
  const [bondStartAtom, setBondStartAtom] = useState<string | null>(null);
  const [tempBondEnd, setTempBondEnd] = useState<{ x: number; y: number; z: number } | null>(null);

  const startDragAtom = useCallback((symbol: string) => {
    setDraggedAtom(symbol);
    setDraggedBondOrder(null);
    setBondStartAtom(null);
  }, []);

  const startDragBond = useCallback((order: number) => {
    setDraggedBondOrder(order);
    setDraggedAtom(null);
  }, []);

  const clearDrag = useCallback(() => {
    setDraggedAtom(null);
    setDraggedBondOrder(null);
    setBondStartAtom(null);
    setTempBondEnd(null);
  }, []);

  return (
    <DragContext.Provider value={{
      draggedAtom,
      draggedBondOrder,
      bondStartAtom,
      tempBondEnd,
      startDragAtom,
      startDragBond,
      setBondStartAtom,
      setTempBondEnd,
      clearDrag,
    }}>
      {children}
    </DragContext.Provider>
  );
}

export function useDrag() {
  const context = useContext(DragContext);
  if (!context) {
    throw new Error('useDrag must be used within a DragProvider');
  }
  return context;
}
