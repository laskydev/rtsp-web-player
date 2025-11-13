// Configuration for backend API URL
// This handles both Electron and browser environments

interface ElectronAPI {
  getBackendUrl: () => string;
  getBackendStatus: () => Promise<{ running: boolean; port: number }>;
  openNativePlayer: (streamId: string, cameraName: string, rtspUrl: string) => Promise<{ success: boolean; error?: string }>;
  closeNativePlayer: (streamId: string) => Promise<{ success: boolean; error?: string }>;
  getActivePlayers: () => Promise<Array<{ id: string; cameraName: string; rtspUrl: string }>>;
  isElectron: boolean;
  platform: string;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export const isElectron = typeof window !== 'undefined' && window.electron?.isElectron === true;

export const API_BASE_URL = isElectron
  ? window.electron?.getBackendUrl() || 'http://localhost:3001'
  : import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const getBackendStatus = async () => {
  if (isElectron && window.electron) {
    return await window.electron.getBackendStatus();
  }
  return null;
};

// Native Player API (solo en Electron)
export const openNativePlayer = async (streamId: string, cameraName: string, rtspUrl: string) => {
  if (isElectron && window.electron) {
    return await window.electron.openNativePlayer(streamId, cameraName, rtspUrl);
  }
  return { success: false, error: 'Native player only available in Electron' };
};

export const closeNativePlayer = async (streamId: string) => {
  if (isElectron && window.electron) {
    return await window.electron.closeNativePlayer(streamId);
  }
  return { success: false, error: 'Native player only available in Electron' };
};

export const getActivePlayers = async () => {
  if (isElectron && window.electron) {
    return await window.electron.getActivePlayers();
  }
  return [];
};

console.log('Running in:', isElectron ? 'Electron' : 'Browser');
console.log('API Base URL:', API_BASE_URL);
