import onvif from 'node-onvif';

class PTZController {
  constructor() {
    this.activeDevices = new Map(); // Map<cameraId, { device, capabilities }>
  }

  /**
   * Inicializa un dispositivo ONVIF para control PTZ
   */
  async initializePTZ(cameraId, onvifAddress, username, password) {
    try {
      // Si ya está inicializado, reutilizarlo
      if (this.activeDevices.has(cameraId)) {
        return { success: true, message: 'PTZ device already initialized' };
      }

      console.log(`[PTZ] Initializing PTZ for camera ${cameraId}`);

      const device = new onvif.OnvifDevice({
        xaddr: onvifAddress,
        user: username,
        pass: password
      });

      await device.init();

      // Verificar si el dispositivo tiene capacidades PTZ
      const capabilities = {
        hasPTZ: false,
        canMove: false,
        canZoom: false,
        hasPresets: false,
        hasHome: false
      };

      if (device.services && device.services.ptz) {
        capabilities.hasPTZ = true;
        capabilities.canMove = true;
        capabilities.canZoom = true;
        capabilities.hasPresets = true;
        capabilities.hasHome = true;
      }

      this.activeDevices.set(cameraId, {
        device,
        capabilities,
        onvifAddress,
        username,
        password
      });

      console.log(`[PTZ] Camera ${cameraId} initialized. Capabilities:`, capabilities);

      return {
        success: true,
        capabilities
      };

    } catch (error) {
      console.error(`[PTZ] Error initializing PTZ for ${cameraId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mueve la cámara en una dirección específica
   * @param {string} cameraId - ID de la cámara
   * @param {string} direction - up, down, left, right, zoomIn, zoomOut
   * @param {number} speed - Velocidad del movimiento (0.1 - 1.0)
   */
  async move(cameraId, direction, speed = 0.5) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;

      if (!device.services || !device.services.ptz) {
        throw new Error('Camera does not support PTZ');
      }

      // Obtener el primer perfil con PTZ
      const profile = device.services.media?.profiles?.[0];
      if (!profile) {
        throw new Error('No media profile found');
      }

      // Preparar vector de velocidad según la dirección
      let velocity = {
        x: 0,
        y: 0,
        zoom: 0
      };

      switch (direction) {
        case 'up':
          velocity.y = speed;
          break;
        case 'down':
          velocity.y = -speed;
          break;
        case 'left':
          velocity.x = -speed;
          break;
        case 'right':
          velocity.x = speed;
          break;
        case 'zoomIn':
          velocity.zoom = speed;
          break;
        case 'zoomOut':
          velocity.zoom = -speed;
          break;
        case 'upleft':
          velocity.x = -speed;
          velocity.y = speed;
          break;
        case 'upright':
          velocity.x = speed;
          velocity.y = speed;
          break;
        case 'downleft':
          velocity.x = -speed;
          velocity.y = -speed;
          break;
        case 'downright':
          velocity.x = speed;
          velocity.y = -speed;
          break;
        default:
          throw new Error(`Invalid direction: ${direction}`);
      }

      // Ejecutar movimiento continuo
      await device.services.ptz.continuousMove({
        ProfileToken: profile.token,
        Velocity: {
          PanTilt: { x: velocity.x, y: velocity.y },
          Zoom: { x: velocity.zoom }
        }
      });

      console.log(`[PTZ] Moving ${cameraId} ${direction} at speed ${speed}`);

      return {
        success: true,
        message: `Moving ${direction}`
      };

    } catch (error) {
      console.error(`[PTZ] Error moving camera ${cameraId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detiene el movimiento de la cámara
   */
  async stop(cameraId) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;
      const profile = device.services.media?.profiles?.[0];

      if (!profile) {
        throw new Error('No media profile found');
      }

      await device.services.ptz.stop({
        ProfileToken: profile.token,
        PanTilt: true,
        Zoom: true
      });

      console.log(`[PTZ] Stopped movement for ${cameraId}`);

      return {
        success: true,
        message: 'Movement stopped'
      };

    } catch (error) {
      console.error(`[PTZ] Error stopping camera ${cameraId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mueve la cámara a una posición absoluta
   */
  async moveAbsolute(cameraId, pan, tilt, zoom) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;
      const profile = device.services.media?.profiles?.[0];

      await device.services.ptz.absoluteMove({
        ProfileToken: profile.token,
        Position: {
          PanTilt: { x: pan, y: tilt },
          Zoom: { x: zoom }
        }
      });

      return {
        success: true,
        message: 'Moved to absolute position'
      };

    } catch (error) {
      console.error(`[PTZ] Error in absolute move:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Va a la posición home/inicial
   */
  async gotoHome(cameraId) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;
      const profile = device.services.media?.profiles?.[0];

      await device.services.ptz.gotoHomePosition({
        ProfileToken: profile.token
      });

      console.log(`[PTZ] Camera ${cameraId} moved to home position`);

      return {
        success: true,
        message: 'Moved to home position'
      };

    } catch (error) {
      console.error(`[PTZ] Error going to home:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Guarda la posición actual como preset
   */
  async setPreset(cameraId, presetName) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;
      const profile = device.services.media?.profiles?.[0];

      const result = await device.services.ptz.setPreset({
        ProfileToken: profile.token,
        PresetName: presetName
      });

      return {
        success: true,
        presetToken: result.PresetToken,
        message: `Preset "${presetName}" saved`
      };

    } catch (error) {
      console.error(`[PTZ] Error setting preset:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Va a una posición preset guardada
   */
  async gotoPreset(cameraId, presetToken) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;
      const profile = device.services.media?.profiles?.[0];

      await device.services.ptz.gotoPreset({
        ProfileToken: profile.token,
        PresetToken: presetToken
      });

      return {
        success: true,
        message: 'Moved to preset position'
      };

    } catch (error) {
      console.error(`[PTZ] Error going to preset:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene la lista de presets disponibles
   */
  async getPresets(cameraId) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;
      const profile = device.services.media?.profiles?.[0];

      const presets = await device.services.ptz.getPresets({
        ProfileToken: profile.token
      });

      return {
        success: true,
        presets: presets || []
      };

    } catch (error) {
      console.error(`[PTZ] Error getting presets:`, error);
      return {
        success: false,
        error: error.message,
        presets: []
      };
    }
  }

  /**
   * Obtiene el estado actual de PTZ
   */
  async getStatus(cameraId) {
    try {
      const deviceData = this.activeDevices.get(cameraId);
      if (!deviceData) {
        throw new Error('PTZ device not initialized for this camera');
      }

      const { device } = deviceData;
      const profile = device.services.media?.profiles?.[0];

      const status = await device.services.ptz.getStatus({
        ProfileToken: profile.token
      });

      return {
        success: true,
        status
      };

    } catch (error) {
      console.error(`[PTZ] Error getting status:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Limpia un dispositivo PTZ de la caché
   */
  cleanup(cameraId) {
    this.activeDevices.delete(cameraId);
    console.log(`[PTZ] Cleaned up PTZ device ${cameraId}`);
  }

  /**
   * Obtiene las capacidades PTZ de una cámara
   */
  getCapabilities(cameraId) {
    const deviceData = this.activeDevices.get(cameraId);
    if (!deviceData) {
      return null;
    }
    return deviceData.capabilities;
  }
}

// Singleton
const ptzController = new PTZController();

export default ptzController;
