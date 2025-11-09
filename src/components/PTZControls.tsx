import { useState, useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Home,
  Bookmark,
  Save,
  Loader2
} from 'lucide-react';

interface PTZControlsProps {
  cameraId: string;
  onvifAddress?: string;
  username?: string;
  password?: string;
}

export function PTZControls({ cameraId, onvifAddress, username, password }: PTZControlsProps) {
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [showPresetInput, setShowPresetInput] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const moveIntervalRef = useRef<number | null>(null);

  const API_BASE = 'http://localhost:3001/api';

  // Inicializar PTZ al montar el componente
  useEffect(() => {
    if (onvifAddress && username && password && !initialized) {
      initializePTZ();
    }

    return () => {
      // Limpiar intervalo si existe
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
      }
    };
  }, [onvifAddress, username, password]);

  const initializePTZ = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/ptz/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId,
          onvifAddress,
          username,
          password
        })
      });

      const data = await response.json();

      if (data.success) {
        setInitialized(true);
        setCapabilities(data.capabilities);

        // Cargar presets si están disponibles
        if (data.capabilities.hasPresets) {
          loadPresets();
        }
      } else {
        console.error('Failed to initialize PTZ:', data.error);
      }
    } catch (error) {
      console.error('Error initializing PTZ:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPresets = async () => {
    try {
      const response = await fetch(`${API_BASE}/ptz/presets/${cameraId}`);
      const data = await response.json();

      if (data.success && data.presets) {
        setPresets(data.presets);
      }
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  };

  const move = async (direction: string) => {
    try {
      await fetch(`${API_BASE}/ptz/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId,
          direction,
          speed: 0.5
        })
      });
    } catch (error) {
      console.error('Error moving camera:', error);
    }
  };

  const stop = async () => {
    try {
      await fetch(`${API_BASE}/ptz/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId })
      });
    } catch (error) {
      console.error('Error stopping camera:', error);
    }
  };

  const goHome = async () => {
    try {
      await fetch(`${API_BASE}/ptz/home`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId })
      });
    } catch (error) {
      console.error('Error going to home:', error);
    }
  };

  const gotoPreset = async (presetToken: string) => {
    try {
      await fetch(`${API_BASE}/ptz/preset/goto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId, presetToken })
      });
    } catch (error) {
      console.error('Error going to preset:', error);
    }
  };

  const savePreset = async () => {
    if (!newPresetName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/ptz/preset/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cameraId,
          presetName: newPresetName.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setNewPresetName('');
        setShowPresetInput(false);
        loadPresets(); // Recargar presets
      }
    } catch (error) {
      console.error('Error saving preset:', error);
    }
  };

  // Manejo de mouse down/up para movimiento continuo
  const handleMouseDown = (direction: string) => {
    move(direction);
    // Continuar moviendo mientras se mantiene presionado
    moveIntervalRef.current = window.setInterval(() => {
      move(direction);
    }, 100);
  };

  const handleMouseUp = () => {
    if (moveIntervalRef.current) {
      clearInterval(moveIntervalRef.current);
      moveIntervalRef.current = null;
    }
    stop();
  };

  if (!onvifAddress || !username || !password) {
    return null; // No mostrar controles si no hay credenciales
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!initialized || !capabilities?.hasPTZ) {
    return null; // No mostrar controles si no soporta PTZ
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <span className="text-blue-400">🎮</span> Controles PTZ
      </h3>

      {/* Directional Controls */}
      {capabilities.canMove && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Dirección:</p>
          <div className="grid grid-cols-3 gap-1">
            {/* Primera fila */}
            <div></div>
            <button
              onMouseDown={() => handleMouseDown('up')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('up')}
              onTouchEnd={handleMouseUp}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors active:bg-blue-600"
              title="Arriba"
            >
              <ChevronUp className="w-5 h-5 text-white" />
            </button>
            <div></div>

            {/* Segunda fila */}
            <button
              onMouseDown={() => handleMouseDown('left')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('left')}
              onTouchEnd={handleMouseUp}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors active:bg-blue-600"
              title="Izquierda"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={goHome}
              className="p-3 bg-blue-700 hover:bg-blue-600 rounded flex items-center justify-center transition-colors"
              title="Home"
            >
              <Home className="w-5 h-5 text-white" />
            </button>
            <button
              onMouseDown={() => handleMouseDown('right')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('right')}
              onTouchEnd={handleMouseUp}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors active:bg-blue-600"
              title="Derecha"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>

            {/* Tercera fila */}
            <div></div>
            <button
              onMouseDown={() => handleMouseDown('down')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('down')}
              onTouchEnd={handleMouseUp}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center transition-colors active:bg-blue-600"
              title="Abajo"
            >
              <ChevronDown className="w-5 h-5 text-white" />
            </button>
            <div></div>
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      {capabilities.canZoom && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Zoom:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onMouseDown={() => handleMouseDown('zoomIn')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('zoomIn')}
              onTouchEnd={handleMouseUp}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-2 transition-colors active:bg-green-600"
              title="Acercar"
            >
              <ZoomIn className="w-4 h-4 text-white" />
              <span className="text-xs text-white">Acercar</span>
            </button>
            <button
              onMouseDown={() => handleMouseDown('zoomOut')}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={() => handleMouseDown('zoomOut')}
              onTouchEnd={handleMouseUp}
              className="p-3 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center gap-2 transition-colors active:bg-green-600"
              title="Alejar"
            >
              <ZoomOut className="w-4 h-4 text-white" />
              <span className="text-xs text-white">Alejar</span>
            </button>
          </div>
        </div>
      )}

      {/* Presets */}
      {capabilities.hasPresets && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Posiciones guardadas:</p>

          {presets.length > 0 && (
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {presets.map((preset) => (
                <button
                  key={preset.token}
                  onClick={() => gotoPreset(preset.token)}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 transition-colors text-left"
                  title={`Ir a ${preset.name}`}
                >
                  <Bookmark className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <span className="text-xs text-white truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Guardar nuevo preset */}
          {showPresetInput ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Nombre del preset"
                className="flex-1 px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => e.key === 'Enter' && savePreset()}
              />
              <button
                onClick={savePreset}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs text-white"
              >
                OK
              </button>
              <button
                onClick={() => {
                  setShowPresetInput(false);
                  setNewPresetName('');
                }}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-xs text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPresetInput(true)}
              className="w-full p-2 bg-green-700 hover:bg-green-600 rounded flex items-center justify-center gap-2 transition-colors"
              title="Guardar posición actual"
            >
              <Save className="w-4 h-4 text-white" />
              <span className="text-xs text-white">Guardar Posición</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
