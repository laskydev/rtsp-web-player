import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import streamManager from './streamManager.js';
import cameraDiscovery from './cameraDiscovery.js';
import ptzController from './ptzController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos de streams HLS
app.use('/streams', express.static(path.join(__dirname, 'streams')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/streams
 * Inicia un nuevo stream RTSP
 * Body: { id: string, rtspUrl: string }
 */
app.post('/api/streams', async (req, res) => {
  try {
    const { id, rtspUrl } = req.body;

    if (!id || !rtspUrl) {
      return res.status(400).json({
        error: 'Se requieren los campos: id y rtspUrl'
      });
    }

    // Validar formato RTSP URL
    if (!rtspUrl.startsWith('rtsp://')) {
      return res.status(400).json({
        error: 'La URL debe comenzar con rtsp://'
      });
    }

    console.log(`[API] Iniciando stream: ${id}`);

    const hlsUrl = await streamManager.startStream(id, rtspUrl);

    res.json({
      success: true,
      stream: {
        id,
        rtspUrl,
        hlsUrl: `http://localhost:${PORT}${hlsUrl}`,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('[API] Error al iniciar stream:', error);
    res.status(500).json({
      error: 'Error al iniciar stream',
      message: error.message
    });
  }
});

/**
 * DELETE /api/streams/:id
 * Detiene un stream activo
 */
app.delete('/api/streams/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!streamManager.isStreamActive(id)) {
      return res.status(404).json({
        error: 'Stream no encontrado o no está activo'
      });
    }

    console.log(`[API] Deteniendo stream: ${id}`);

    await streamManager.stopStream(id);

    res.json({
      success: true,
      message: `Stream ${id} detenido correctamente`
    });
  } catch (error) {
    console.error('[API] Error al detener stream:', error);
    res.status(500).json({
      error: 'Error al detener stream',
      message: error.message
    });
  }
});

/**
 * GET /api/streams
 * Obtiene la lista de streams activos
 */
app.get('/api/streams', (req, res) => {
  try {
    const streams = streamManager.getActiveStreams();

    res.json({
      success: true,
      count: streams.length,
      streams: streams.map(stream => ({
        ...stream,
        hlsUrl: `http://localhost:${PORT}${stream.hlsUrl}`
      }))
    });
  } catch (error) {
    console.error('[API] Error al obtener streams:', error);
    res.status(500).json({
      error: 'Error al obtener streams',
      message: error.message
    });
  }
});

/**
 * GET /api/streams/:id
 * Obtiene información de un stream específico
 */
app.get('/api/streams/:id', (req, res) => {
  try {
    const { id } = req.params;

    if (!streamManager.isStreamActive(id)) {
      return res.status(404).json({
        error: 'Stream no encontrado o no está activo'
      });
    }

    const streams = streamManager.getActiveStreams();
    const stream = streams.find(s => s.id === id);

    res.json({
      success: true,
      stream: {
        ...stream,
        hlsUrl: `http://localhost:${PORT}${stream.hlsUrl}`
      }
    });
  } catch (error) {
    console.error('[API] Error al obtener stream:', error);
    res.status(500).json({
      error: 'Error al obtener stream',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 📡 CAMERA DISCOVERY ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/discovery/start
 * Inicia el descubrimiento de cámaras en la red local
 * Body: { tapoEmail?: string, tapoPassword?: string, scanRtsp?: boolean }
 */
app.post('/api/discovery/start', async (req, res) => {
  try {
    const { tapoEmail, tapoPassword, scanRtsp = true } = req.body;

    console.log('[API] Iniciando descubrimiento de cámaras...');

    // Iniciar descubrimiento de forma asíncrona
    cameraDiscovery.startDiscovery({
      tapoEmail,
      tapoPassword,
      scanRtsp
    }).catch(error => {
      console.error('[API] Error en descubrimiento:', error);
    });

    res.json({
      success: true,
      message: 'Descubrimiento iniciado',
      status: cameraDiscovery.getDiscoveryStatus()
    });
  } catch (error) {
    console.error('[API] Error al iniciar descubrimiento:', error);
    res.status(500).json({
      error: 'Error al iniciar descubrimiento',
      message: error.message
    });
  }
});

/**
 * GET /api/discovery/status
 * Obtiene el estado actual del descubrimiento
 */
app.get('/api/discovery/status', (req, res) => {
  try {
    const status = cameraDiscovery.getDiscoveryStatus();

    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    console.error('[API] Error al obtener estado:', error);
    res.status(500).json({
      error: 'Error al obtener estado',
      message: error.message
    });
  }
});

/**
 * GET /api/discovery/devices
 * Obtiene la lista de dispositivos descubiertos
 */
app.get('/api/discovery/devices', (req, res) => {
  try {
    const devices = cameraDiscovery.getDiscoveredDevices();

    res.json({
      success: true,
      count: devices.length,
      devices
    });
  } catch (error) {
    console.error('[API] Error al obtener dispositivos:', error);
    res.status(500).json({
      error: 'Error al obtener dispositivos',
      message: error.message
    });
  }
});

/**
 * POST /api/discovery/test
 * Prueba la conexión a una cámara con credenciales
 * Body: { camera: object, credentials: { username, password } }
 */
app.post('/api/discovery/test', async (req, res) => {
  try {
    const { camera, credentials } = req.body;

    if (!camera) {
      return res.status(400).json({
        error: 'Se requiere el objeto camera'
      });
    }

    console.log(`[API] Probando conexión a cámara ${camera.name || camera.id}`);

    const result = await cameraDiscovery.testCameraConnection(camera, credentials);

    res.json({
      success: result.success,
      ...result
    });
  } catch (error) {
    console.error('[API] Error al probar conexión:', error);
    res.status(500).json({
      error: 'Error al probar conexión',
      message: error.message
    });
  }
});

/**
 * POST /api/discovery/rtsp-urls
 * Genera URLs RTSP sugeridas para una cámara
 * Body: { camera: object, credentials?: { username, password } }
 */
app.post('/api/discovery/rtsp-urls', (req, res) => {
  try {
    const { camera, credentials = {} } = req.body;

    if (!camera) {
      return res.status(400).json({
        error: 'Se requiere el objeto camera'
      });
    }

    const urls = cameraDiscovery.generateRtspUrls(camera, credentials);

    res.json({
      success: true,
      camera: camera.name || camera.id,
      urls
    });
  } catch (error) {
    console.error('[API] Error al generar URLs:', error);
    res.status(500).json({
      error: 'Error al generar URLs',
      message: error.message
    });
  }
});

/**
 * DELETE /api/discovery/clear
 * Limpia los dispositivos descubiertos
 */
app.delete('/api/discovery/clear', (req, res) => {
  try {
    cameraDiscovery.clearDiscoveredDevices();

    res.json({
      success: true,
      message: 'Dispositivos descubiertos eliminados'
    });
  } catch (error) {
    console.error('[API] Error al limpiar dispositivos:', error);
    res.status(500).json({
      error: 'Error al limpiar dispositivos',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// 🎮 PTZ CONTROL ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/ptz/init
 * Inicializa control PTZ para una cámara
 * Body: { cameraId, onvifAddress, username, password }
 */
app.post('/api/ptz/init', async (req, res) => {
  try {
    const { cameraId, onvifAddress, username, password } = req.body;

    if (!cameraId || !onvifAddress || !username || !password) {
      return res.status(400).json({
        error: 'Se requieren: cameraId, onvifAddress, username, password'
      });
    }

    console.log(`[API] Inicializando PTZ para cámara ${cameraId}`);

    const result = await ptzController.initializePTZ(cameraId, onvifAddress, username, password);

    res.json(result);
  } catch (error) {
    console.error('[API] Error al inicializar PTZ:', error);
    res.status(500).json({
      error: 'Error al inicializar PTZ',
      message: error.message
    });
  }
});

/**
 * POST /api/ptz/move
 * Mueve la cámara en una dirección
 * Body: { cameraId, direction, speed }
 */
app.post('/api/ptz/move', async (req, res) => {
  try {
    const { cameraId, direction, speed = 0.5 } = req.body;

    if (!cameraId || !direction) {
      return res.status(400).json({
        error: 'Se requieren: cameraId, direction'
      });
    }

    const result = await ptzController.move(cameraId, direction, speed);

    res.json(result);
  } catch (error) {
    console.error('[API] Error al mover cámara:', error);
    res.status(500).json({
      error: 'Error al mover cámara',
      message: error.message
    });
  }
});

/**
 * POST /api/ptz/stop
 * Detiene el movimiento de la cámara
 * Body: { cameraId }
 */
app.post('/api/ptz/stop', async (req, res) => {
  try {
    const { cameraId } = req.body;

    if (!cameraId) {
      return res.status(400).json({
        error: 'Se requiere: cameraId'
      });
    }

    const result = await ptzController.stop(cameraId);

    res.json(result);
  } catch (error) {
    console.error('[API] Error al detener cámara:', error);
    res.status(500).json({
      error: 'Error al detener cámara',
      message: error.message
    });
  }
});

/**
 * POST /api/ptz/home
 * Mueve la cámara a la posición home
 * Body: { cameraId }
 */
app.post('/api/ptz/home', async (req, res) => {
  try {
    const { cameraId } = req.body;

    if (!cameraId) {
      return res.status(400).json({
        error: 'Se requiere: cameraId'
      });
    }

    const result = await ptzController.gotoHome(cameraId);

    res.json(result);
  } catch (error) {
    console.error('[API] Error al ir a home:', error);
    res.status(500).json({
      error: 'Error al ir a home',
      message: error.message
    });
  }
});

/**
 * GET /api/ptz/presets/:cameraId
 * Obtiene la lista de presets de una cámara
 */
app.get('/api/ptz/presets/:cameraId', async (req, res) => {
  try {
    const { cameraId } = req.params;

    const result = await ptzController.getPresets(cameraId);

    res.json(result);
  } catch (error) {
    console.error('[API] Error al obtener presets:', error);
    res.status(500).json({
      error: 'Error al obtener presets',
      message: error.message
    });
  }
});

/**
 * POST /api/ptz/preset/goto
 * Va a una posición preset
 * Body: { cameraId, presetToken }
 */
app.post('/api/ptz/preset/goto', async (req, res) => {
  try {
    const { cameraId, presetToken } = req.body;

    if (!cameraId || !presetToken) {
      return res.status(400).json({
        error: 'Se requieren: cameraId, presetToken'
      });
    }

    const result = await ptzController.gotoPreset(cameraId, presetToken);

    res.json(result);
  } catch (error) {
    console.error('[API] Error al ir a preset:', error);
    res.status(500).json({
      error: 'Error al ir a preset',
      message: error.message
    });
  }
});

/**
 * POST /api/ptz/preset/set
 * Guarda la posición actual como preset
 * Body: { cameraId, presetName }
 */
app.post('/api/ptz/preset/set', async (req, res) => {
  try {
    const { cameraId, presetName } = req.body;

    if (!cameraId || !presetName) {
      return res.status(400).json({
        error: 'Se requieren: cameraId, presetName'
      });
    }

    const result = await ptzController.setPreset(cameraId, presetName);

    res.json(result);
  } catch (error) {
    console.error('[API] Error al guardar preset:', error);
    res.status(500).json({
      error: 'Error al guardar preset',
      message: error.message
    });
  }
});

/**
 * GET /api/ptz/capabilities/:cameraId
 * Obtiene las capacidades PTZ de una cámara
 */
app.get('/api/ptz/capabilities/:cameraId', (req, res) => {
  try {
    const { cameraId } = req.params;

    const capabilities = ptzController.getCapabilities(cameraId);

    if (!capabilities) {
      return res.status(404).json({
        error: 'PTZ no inicializado para esta cámara'
      });
    }

    res.json({
      success: true,
      capabilities
    });
  } catch (error) {
    console.error('[API] Error al obtener capacidades:', error);
    res.status(500).json({
      error: 'Error al obtener capacidades',
      message: error.message
    });
  }
});

// Manejo de shutdown graceful
process.on('SIGTERM', async () => {
  console.log('\n[Server] SIGTERM recibido, cerrando servidor...');
  await streamManager.stopAllStreams();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n[Server] SIGINT recibido, cerrando servidor...');
  await streamManager.stopAllStreams();
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║    🎥 RTSP Web Player - Backend Server                ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Servidor corriendo en: http://localhost:${PORT}`);
  console.log('');
  console.log('📡 Endpoints - Streams:');
  console.log(`   GET    /api/health          - Health check`);
  console.log(`   GET    /api/streams         - Listar streams activos`);
  console.log(`   POST   /api/streams         - Iniciar nuevo stream`);
  console.log(`   GET    /api/streams/:id     - Info de stream específico`);
  console.log(`   DELETE /api/streams/:id     - Detener stream`);
  console.log('');
  console.log('🔍 Endpoints - Camera Discovery:');
  console.log(`   POST   /api/discovery/start     - Iniciar descubrimiento`);
  console.log(`   GET    /api/discovery/status    - Estado del descubrimiento`);
  console.log(`   GET    /api/discovery/devices   - Dispositivos encontrados`);
  console.log(`   POST   /api/discovery/test      - Probar conexión a cámara`);
  console.log(`   POST   /api/discovery/rtsp-urls - Generar URLs RTSP`);
  console.log(`   DELETE /api/discovery/clear     - Limpiar dispositivos`);
  console.log('');
  console.log('🎮 Endpoints - PTZ Control:');
  console.log(`   POST   /api/ptz/init            - Inicializar PTZ`);
  console.log(`   POST   /api/ptz/move            - Mover cámara`);
  console.log(`   POST   /api/ptz/stop            - Detener movimiento`);
  console.log(`   POST   /api/ptz/home            - Ir a posición home`);
  console.log(`   GET    /api/ptz/presets/:id     - Obtener presets`);
  console.log(`   POST   /api/ptz/preset/goto     - Ir a preset`);
  console.log(`   POST   /api/ptz/preset/set      - Guardar preset`);
  console.log('');
  console.log('🎬 Directorio de streams: ./server/streams/');
  console.log('');
  console.log('💡 Ejemplo de uso:');
  console.log('   curl -X POST http://localhost:3001/api/discovery/start');
  console.log('');
  console.log('⌨️  Presiona Ctrl+C para detener el servidor');
  console.log('════════════════════════════════════════════════════════');
});
