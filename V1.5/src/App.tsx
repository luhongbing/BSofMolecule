import { MoleculeProvider } from './context/MoleculeContext';
import { DragProvider } from './context/DragContext';
import { Toolbar } from './components/Toolbar';
import { Canvas3D } from './components/Canvas3D';
import { AnalysisPanel } from './components/AnalysisPanel';
import { StatusBar } from './components/StatusBar';

function App() {
  return (
    <MoleculeProvider>
      <DragProvider>
        <div className="h-screen flex flex-col bg-gray-900">
          <Toolbar />
          <div className="flex-1 relative">
            <Canvas3D />
            <AnalysisPanel />
          </div>
          <StatusBar />
        </div>
      </DragProvider>
    </MoleculeProvider>
  );
}

export default App;
