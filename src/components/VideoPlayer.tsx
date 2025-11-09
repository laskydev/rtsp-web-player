import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import type { Camera } from '../types';
import { Video, VideoOff, Trash2 } from 'lucide-react';

interface VideoPlayerProps {
  camera: Camera;
  onRemove: (id: string) => void;
}

export function VideoPlayer({ camera, onRemove }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);

    // Handle HLS streams
    if (camera.type === 'hls' && camera.url) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          // Configuración para mantener el stream en vivo
          liveSyncDuration: 0.5, // Sincronizar muy cerca del live edge
          liveMaxLatencyDuration: 3, // Latencia máxima antes de saltar al live
          liveDurationInfinity: true, // Permitir streams infinitos
          highBufferWatchdogPeriod: 1, // Verificar buffer frecuentemente
          // Limitar buffer histórico
          backBufferLength: 10, // Solo mantener 10 segundos atrás
          maxBufferLength: 10, // Buffer máximo de 10 segundos
          maxMaxBufferLength: 15, // Buffer máximo absoluto
        });

        hlsRef.current = hls;

        hls.loadSource(camera.url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // Saltar al final del stream al iniciar
          const seekToLive = () => {
            if (video.duration && isFinite(video.duration)) {
              video.currentTime = video.duration;
            }
          };

          video.play().then(() => {
            seekToLive();
          }).catch(err => {
            console.error('Error playing video:', err);
            setError('Error al reproducir el video');
          });
          setIsLoading(false);
        });

        // Cuando se actualiza el manifest, saltar al live edge
        hls.on(Hls.Events.LEVEL_UPDATED, () => {
          if (video && hls.liveSyncPosition !== undefined) {
            const latency = hls.liveSyncPosition - video.currentTime;
            // Si estamos más de 3 segundos atrás, saltar al live
            if (latency > 3) {
              video.currentTime = hls.liveSyncPosition;
            }
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setError('Error al cargar el stream');
            setIsLoading(false);
          }
        });

        // Intervalo para mantener sincronizado con el live edge
        const liveEdgeInterval = setInterval(() => {
          if (video && !video.paused && hls.liveSyncPosition !== undefined) {
            const latency = hls.liveSyncPosition - video.currentTime;
            // Si estamos más de 5 segundos atrás del live, saltar
            if (latency > 5) {
              console.log(`[VideoPlayer] Latency too high (${latency.toFixed(2)}s), jumping to live edge`);
              video.currentTime = hls.liveSyncPosition;
            }
          }
        }, 2000); // Verificar cada 2 segundos

        return () => {
          clearInterval(liveEdgeInterval);
          hls.destroy();
          hlsRef.current = null;
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        video.src = camera.url;

        const seekToLive = () => {
          if (video.duration && isFinite(video.duration)) {
            video.currentTime = video.duration;
          }
        };

        video.addEventListener('loadedmetadata', () => {
          video.play().then(() => {
            seekToLive();
          }).catch(err => {
            console.error('Error playing video:', err);
            setError('Error al reproducir el video');
          });
          setIsLoading(false);
        });

        // Intervalo para mantener en el live edge (Safari)
        const liveEdgeInterval = setInterval(() => {
          if (video && !video.paused && video.duration && isFinite(video.duration)) {
            const latency = video.duration - video.currentTime;
            if (latency > 5) {
              console.log(`[VideoPlayer] Safari: Latency too high (${latency.toFixed(2)}s), jumping to live edge`);
              video.currentTime = video.duration;
            }
          }
        }, 2000);

        return () => {
          clearInterval(liveEdgeInterval);
        };
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
      <div className="aspect-video bg-gray-800 flex items-center justify-center">
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
      </div>

      {/* Type indicator */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white uppercase">
        {camera.type}
      </div>
    </div>
  );
}
