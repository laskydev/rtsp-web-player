import { BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'path';

class NativePlayerManager {
  constructor() {
    this.players = new Map(); // streamId -> { window, mpvProcess }
  }

  /**
   * Abre un reproductor nativo para un stream RTSP
   * @param {string} streamId - ID único del stream
   * @param {string} cameraName - Nombre de la cámara
   * @param {string} rtspUrl - URL RTSP directa
   */
  async openNativePlayer(streamId, cameraName, rtspUrl) {
    // Si ya existe un reproductor para este stream, enfocarlo
    if (this.players.has(streamId)) {
      const existing = this.players.get(streamId);
      if (existing.window && !existing.window.isDestroyed()) {
        existing.window.focus();
        return;
      }
      // Si la ventana fue destruida, limpiar
      this.closePlayer(streamId);
    }

    console.log(`[NativePlayer] Abriendo reproductor nativo para: ${cameraName} (${streamId})`);
    console.log(`[NativePlayer] RTSP URL: ${rtspUrl}`);

    // Spawn mpv con configuración optimizada para RTSP
    const mpvProcess = spawn('mpv', [
      rtspUrl,
      '--title=' + cameraName,
      '--force-window=immediate',
      '--keep-open=yes',
      '--rtsp-transport=tcp',
      '--cache=yes',
      '--cache-secs=5',
      '--demuxer-max-bytes=50M',
      '--demuxer-max-back-bytes=10M',
      '--hr-seek=no',
      '--video-sync=audio',
      '--framedrop=vo',
      '--hwdec=auto-safe',
      '--vo=gpu',
      '--profile=low-latency',
      '--untimed'
    ], {
      stdio: 'pipe'
    });

    mpvProcess.stdout.on('data', (data) => {
      console.log(`[mpv ${streamId}] ${data.toString().trim()}`);
    });

    mpvProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg.includes('error') || msg.includes('Error')) {
        console.error(`[mpv ${streamId}] Error: ${msg}`);
      } else {
        console.log(`[mpv ${streamId}] ${msg}`);
      }
    });

    mpvProcess.on('error', (error) => {
      console.error(`[mpv ${streamId}] Error al iniciar mpv:`, error);
    });

    mpvProcess.on('exit', (code, signal) => {
      console.log(`[mpv ${streamId}] Proceso terminado - code: ${code}, signal: ${signal}`);
      this.players.delete(streamId);
    });

    // Guardar referencia al proceso
    this.players.set(streamId, {
      mpvProcess,
      cameraName,
      rtspUrl
    });

    return true;
  }

  /**
   * Cierra un reproductor específico
   * @param {string} streamId - ID del stream
   */
  closePlayer(streamId) {
    const player = this.players.get(streamId);
    if (!player) {
      console.log(`[NativePlayer] Reproductor ${streamId} no encontrado`);
      return;
    }

    console.log(`[NativePlayer] Cerrando reproductor: ${streamId}`);

    if (player.mpvProcess) {
      player.mpvProcess.kill('SIGTERM');

      // Forzar kill después de 2 segundos si no cerró
      setTimeout(() => {
        if (player.mpvProcess && !player.mpvProcess.killed) {
          console.log(`[NativePlayer] Forzando cierre de mpv: ${streamId}`);
          player.mpvProcess.kill('SIGKILL');
        }
      }, 2000);
    }

    this.players.delete(streamId);
  }

  /**
   * Cierra todos los reproductores
   */
  closeAllPlayers() {
    console.log('[NativePlayer] Cerrando todos los reproductores...');
    const streamIds = Array.from(this.players.keys());
    streamIds.forEach(streamId => this.closePlayer(streamId));
  }

  /**
   * Obtiene lista de reproductores activos
   */
  getActivePlayers() {
    const players = [];
    this.players.forEach((player, streamId) => {
      players.push({
        id: streamId,
        cameraName: player.cameraName,
        rtspUrl: player.rtspUrl
      });
    });
    return players;
  }
}

export default NativePlayerManager;
