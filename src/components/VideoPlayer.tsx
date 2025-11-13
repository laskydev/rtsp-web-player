import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Camera } from '../types';
import { Video, VideoOff, Trash2, Play } from 'lucide-react';
import { isElectron, openNativePlayer, closeNativePlayer } from '../config';

interface VideoPlayerProps {
  camera: Camera;
  onRemove: (id: string) => void;
}

export function VideoPlayer({ camera, onRemove }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNativePlayerOpen, setIsNativePlayerOpen] = useState(false);

  const handleOpenNative = async () => {
    try {
      // Usar la URL RTSP original si existe, de lo contrario usar la URL normal
      let rtspUrl = camera.rtspUrl || camera.url;

      // Si no hay URL RTSP y la URL actual es HLS, mostrar error
      if (!camera.rtspUrl && camera.url.includes('/streams/')) {
        alert('Esta cámara no tiene URL RTSP guardada. Por favor, vuelve a agregar la cámara con la URL RTSP original.');
        return;
      }

      const result = await openNativePlayer(camera.id, camera.name, rtspUrl);

      if (result.success) {
        setIsNativePlayerOpen(true);
      } else {
        alert(`Error al abrir reproductor nativo: ${result.error}\n\nAsegúrate de tener mpv instalado en tu sistema.`);
      }
    } catch (error) {
      console.error('Error opening native player:', error);
      alert('Error al abrir reproductor nativo. Asegúrate de tener mpv instalado.');
    }
  };

  const handleCloseNative = async () => {
    try {
      await closeNativePlayer(camera.id);
      setIsNativePlayerOpen(false);
    } catch (error) {
      console.error('Error closing native player:', error);
    }
  };

  useEffect(() => {
    // Cleanup: cerrar reproductor nativo cuando se desmonta el componente
    return () => {
      if (isNativePlayerOpen) {
        closeNativePlayer(camera.id).catch(console.error);
      }
    };
  }, [camera.id, isNativePlayerOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // En Electron, no cargar el video web automáticamente
    // El usuario puede elegir usar el reproductor nativo
    if (isElectron) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Handle HLS streams
    if (camera.type === 'hls' && camera.url) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          // Configuración optimizada para estabilidad
          maxBufferLength: 30, // Buffer máximo de 30 segundos
          maxMaxBufferLength: 60, // Buffer máximo absoluto
          backBufferLength: 10, // Mantener 10s de buffer anterior
          maxBufferSize: 60 * 1000 * 1000, // 60 MB
          maxBufferHole: 0.5, // Tolerancia de huecos en el buffer
          highBufferWatchdogPeriod: 3, // Monitoreo de buffer alto
          // Configuración de recuperación de errores
          fragLoadingTimeOut: 20000, // Timeout de 20s para cargar fragmentos
          manifestLoadingTimeOut: 10000, // Timeout de 10s para manifest
          levelLoadingTimeOut: 10000, // Timeout de 10s para niveles
          // Reintentos automáticos
          fragLoadingMaxRetry: 6, // 6 reintentos para fragmentos
          levelLoadingMaxRetry: 4, // 4 reintentos para niveles
          manifestLoadingMaxRetry: 6, // 6 reintentos para manifest
          // Optimización de inicio
          startPosition: -1, // Comenzar desde el final (live edge)
          liveSyncDuration: 3, // Sincronización a 3s del final
          liveMaxLatencyDuration: 10, // Latencia máxima de 10s
          // ABR (Adaptive Bitrate)
          abrEwmaFastLive: 3,
          abrEwmaSlowLive: 9,
        });

        hls.loadSource(camera.url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(err => {
            console.error('Error playing video:', err);
            setError('Error al reproducir el video');
          });
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          console.error('HLS Error:', data);

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Network error, attempting recovery...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Media error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error, cannot recover');
                setError('Error al cargar el stream');
                setIsLoading(false);
                hls.destroy();
                break;
            }
          }
        });

        return () => {
          hls.destroy();
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        video.src = camera.url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(err => {
            console.error('Error playing video:', err);
            setError('Error al reproducir el video');
          });
          setIsLoading(false);
        });
      } else {
        setError('HLS no soportado en este navegador');
        setIsLoading(false);
      }
    }
    // Handle MJPEG streams
    else if (camera.type === 'mjpeg' && camera.url) {
      video.src = camera.url;
      setIsLoading(false);
    }
    // Handle direct video URLs
    else if (camera.url) {
      video.src = camera.url;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
      });
      video.addEventListener('error', () => {
        setError('Error al cargar el video');
        setIsLoading(false);
      });
    }
  }, [camera.url, camera.type]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-lg group">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-white" />
            <h3 className="text-white text-sm font-medium truncate">{camera.name}</h3>
          </div>
          <button
            onClick={() => onRemove(camera.id)}
            className="p-1.5 bg-red-500/80 hover:bg-red-600 rounded-md transition-colors"
            title="Eliminar cámara"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-xs text-gray-300 mt-1 truncate">{camera.url}</p>
      </div>

      {/* Video */}
      <div className="aspect-video bg-gray-800 flex items-center justify-center relative">
        {isElectron ? (
          // Interfaz para Electron con reproductor nativo
          <div className="flex flex-col items-center gap-4 p-6">
            {isNativePlayerOpen ? (
              <>
                <div className="flex items-center gap-3 text-green-400">
                  <Play className="w-8 h-8" />
                  <div className="text-center">
                    <p className="text-lg font-semibold">Reproductor Nativo Activo</p>
                    <p className="text-sm text-gray-300">La cámara se está reproduciendo en mpv</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseNative}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white font-medium"
                >
                  Cerrar Reproductor
                </button>
              </>
            ) : (
              <>
                <Video className="w-16 h-16 text-blue-400 mb-2" />
                <p className="text-white text-lg font-semibold mb-2">{camera.name}</p>
                <button
                  onClick={handleOpenNative}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-white font-medium flex items-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  Abrir en Reproductor Nativo (mpv)
                </button>
                <p className="text-xs text-gray-400 text-center max-w-xs mt-2">
                  El reproductor nativo ofrece mejor performance y menor latencia usando aceleración por hardware
                </p>
              </>
            )}
          </div>
        ) : (
          // Interfaz web normal
          <>
            {error ? (
              <div className="flex flex-col items-center gap-2 text-red-400">
                <VideoOff className="w-12 h-12" />
                <p className="text-sm">{error}</p>
                <p className="text-xs text-gray-400">Verifica la URL y el tipo de stream</p>
              </div>
            ) : (
              <>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-400">Cargando stream...</p>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  controls
                  muted
                  playsInline
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Type indicator */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white uppercase">
        {camera.type}
      </div>
    </div>
  );
}
