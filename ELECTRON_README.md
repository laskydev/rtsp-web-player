# RTSP Web Player - Aplicación de Escritorio

Esta es la versión de escritorio del RTSP Web Player construida con Electron.js. La aplicación levanta automáticamente el backend y proporciona una experiencia nativa de escritorio.

## ✨ Características

- **Backend Automático**: El servidor backend se inicia automáticamente al abrir la aplicación
- **Reproductor Nativo con mpv**: Reproduce RTSP directamente con aceleración por hardware
- **Sin Conversión HLS**: Reproduce RTSP sin conversión intermedia (menor latencia, mejor performance)
- **Siempre en Vivo**: El reproductor nativo muestra siempre el video en tiempo real, sin cache
- **Empaquetado Nativo**: Distribución como aplicación de escritorio para Windows, macOS y Linux
- **Sin Configuración Manual**: No necesitas levantar el backend manualmente

## 📋 Requisitos Previos

Antes de usar la aplicación, asegúrate de tener instalado:

1. **Node.js** (versión 18 o superior)
2. **mpv** (reproductor nativo - REQUERIDO para reproducción de cámaras)
3. **FFmpeg** (opcional - solo si quieres conversión RTSP → HLS para modo web)

### Instalar mpv:

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install mpv
```

**macOS (con Homebrew):**
```bash
brew install mpv
```

**Windows:**
- Descarga desde: https://mpv.io/installation/
- Instala usando Chocolatey: `choco install mpv`
- O descarga el instalador y agrega mpv al PATH del sistema

### Instalar FFmpeg (Opcional):

Solo necesario si quieres usar el modo web o conversión HLS.

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS (con Homebrew):**
```bash
brew install ffmpeg
```

**Windows:**
- Descarga desde: https://ffmpeg.org/download.html
- Agrega FFmpeg al PATH del sistema

## 🚀 Instalación

1. **Instalar dependencias del proyecto y del servidor:**
```bash
npm run setup
```

Este comando instalará todas las dependencias necesarias tanto para el frontend como para el backend.

## 🎮 Uso

### Modo Desarrollo

Para ejecutar la aplicación en modo desarrollo:

```bash
npm run electron:dev
```

Esto iniciará:
1. El servidor de desarrollo de Vite (frontend)
2. La aplicación de Electron (que levantará automáticamente el backend)

### Compilar la Aplicación

Para crear una build de producción:

```bash
npm run electron:build
```

Esto:
1. Compilará el frontend con Vite
2. Empaquetará la aplicación con electron-builder
3. Generará los instaladores en la carpeta `release/`

### Crear Build Local (sin instalador)

Para crear una versión ejecutable sin generar instaladores:

```bash
npm run electron:dist
```

## 📦 Distribución

Los archivos de distribución se generarán en la carpeta `release/` con los siguientes formatos:

- **Windows**: `.exe` (instalador NSIS) y versión portable
- **macOS**: `.dmg` y `.zip`
- **Linux**: `.AppImage` y `.deb`

## 🎯 Cómo Usar la Aplicación

1. **Abre la aplicación**: La ventana principal se abrirá automáticamente
2. **El backend se inicia solo**: No necesitas hacer nada, el backend se levanta automáticamente
3. **Agrega cámaras**:
   - Haz clic en el botón "+" en la esquina inferior derecha
   - Ingresa el nombre y la URL RTSP de tu cámara
   - La URL RTSP se guardará para usarla con el reproductor nativo

4. **Reproduce con el Reproductor Nativo (RECOMENDADO)**:
   - Una vez agregada la cámara, verás un botón "Abrir en Reproductor Nativo (mpv)"
   - Haz clic y mpv se abrirá en una ventana separada
   - **Ventajas**:
     - ⚡ Menor latencia (sin conversión HLS intermedia)
     - 🎮 Aceleración por hardware
     - 📺 Siempre en vivo (sin cache de segmentos viejos)
     - 💪 Mayor estabilidad y mejor performance

5. **Descubre cámaras**:
   - Haz clic en "Descubrir Cámaras" en la barra superior
   - La aplicación escaneará tu red local en busca de cámaras IP

## 🔧 Configuración

### Variables de Entorno

La aplicación detecta automáticamente si está corriendo en Electron o en el navegador.

- **En Electron**: El backend usa el puerto 3001 por defecto
- **En Navegador**: Puedes configurar la URL del backend con la variable `VITE_API_URL`

### Configuración del Backend

El backend se configura en `server/index.js`:
- Puerto: 3001 (por defecto)
- Streams se almacenan en: `server/streams/`

## 🐛 Solución de Problemas

### mpv no encontrado

**Síntoma**: Al hacer clic en "Abrir en Reproductor Nativo" aparece un error

**Solución**:
1. Verifica la instalación: `mpv --version`
2. Asegúrate de que mpv esté en el PATH del sistema:
   - Linux/macOS: Debería estar en `/usr/bin/mpv` o `/usr/local/bin/mpv`
   - Windows: Agrega la carpeta de mpv al PATH
3. Reinicia la aplicación después de instalar mpv

### La cámara muestra video viejo/no actualizado

**Solución**: Este problema se ha resuelto con el reproductor nativo mpv, que:
- Reproduce directamente desde RTSP sin cache
- Siempre muestra el video en vivo más reciente
- No usa conversión HLS intermedia que pueda tener segmentos viejos

### La aplicación no inicia el backend

1. Verifica que Node.js esté instalado: `node --version`
2. Asegúrate de que las dependencias del servidor estén instaladas: `cd server && npm install`
3. Revisa los logs en la consola de la aplicación

### El reproductor nativo tiene latencia

El reproductor nativo mpv está configurado con perfil de baja latencia:
- `--profile=low-latency`: Optimizado para streams en vivo
- `--cache-secs=5`: Solo 5 segundos de buffer
- `--untimed`: Sin sincronización temporal que añada retrasos

Si aún hay latencia, puede ser de la cámara misma, no del reproductor.

## 🏗️ Arquitectura

```
rtsp-web-player/
├── electron/              # Proceso principal de Electron
│   ├── main.js           # Maneja ventana y backend
│   └── preload.js        # Bridge seguro IPC
├── src/                  # Frontend React
│   ├── components/       # Componentes UI
│   ├── config.ts         # Configuración de API
│   └── ...
├── server/               # Backend Node.js
│   ├── index.js         # Servidor Express
│   ├── streamManager.js # Gestión RTSP→HLS
│   └── ...
└── dist/                # Build de producción
```

### Flujo de Inicio

1. Usuario abre la aplicación
2. Electron inicia (`electron/main.js`)
3. Backend se levanta automáticamente
4. Electron espera confirmación del backend
5. Ventana de la aplicación se abre
6. Frontend se carga y detecta que está en Electron
7. Frontend se conecta al backend local

## 🎨 Mejoras Implementadas

### Reproductor HLS Mejorado

- **Buffer optimizado**: 30s de buffer para streams estables
- **Recuperación automática**: Reintentos en errores de red/media
- **Timeouts aumentados**: Mayor tolerancia a latencia de red
- **ABR adaptativo**: Ajuste automático de calidad según red

### Integración Electron

- **IPC seguro**: Comunicación aislada y segura
- **Gestión de procesos**: Cleanup automático del backend
- **Detección de entorno**: Frontend adapta URLs automáticamente

## 📝 Scripts Disponibles

```bash
# Desarrollo web (sin Electron)
npm run dev           # Inicia Vite dev server
npm run server        # Inicia backend manualmente

# Desarrollo Electron
npm run electron      # Inicia solo Electron
npm run electron:dev  # Desarrollo completo (frontend + electron)

# Producción
npm run build         # Build del frontend
npm run electron:build # Build completo con instaladores
npm run electron:dist  # Build sin instaladores
npm run dist          # Alias de electron:build

# Utilidades
npm run setup         # Instala todas las dependencias
npm run lint          # Ejecuta linter
```

## 🤝 Contribuir

Si encuentras bugs o quieres agregar features:
1. Reporta issues en el repositorio
2. Crea pull requests con mejoras

## 📄 Licencia

Este proyecto es de código abierto. Consulta el archivo LICENSE para más detalles.

## 🎉 ¡Listo!

Ahora tienes una aplicación de escritorio completa que:
- Se abre como cualquier app nativa
- Levanta el backend automáticamente
- Reproduce múltiples streams RTSP simultáneamente
- Tiene recuperación automática de errores
- Se puede distribuir fácilmente

¡Disfruta tu reproductor RTSP de escritorio! 📹✨
