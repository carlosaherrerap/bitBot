---
description: Guía de despliegue del bot (Node.js + Python)
---

# Guía de Despliegue en Servidor

Para que el bot funcione correctamente en tu servidor tras descargarlo de GitHub, debes seguir estos pasos para instalar ambos entornos (Node.js y Python).

## 1. Clonar y Actualizar
Asegúrate de tener la última versión del código en tu servidor:
```bash
git pull origin master
```

## 2. Instalar Dependencias de Node.js
// turbo
```bash
npm install
```

## 3. Instalar Dependencias de Python (CRÍTICO)
Como ahora usamos `yt-dlp` nativo para que los videos funcionen en el celular, debes instalarlo en el servidor:
// turbo
```bash
pip install -r requirements.txt
```

## 4. Instalar FFmpeg (OBLIGATORIO para Video HD)
El bot necesita FFmpeg para unir audio/video y convertir para WhatsApp.
- **En Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install ffmpeg -y`
- **En Windows**: 
  1. Descarga de [ffmpeg.org](https://ffmpeg.org/download.html).
  2. Extrae y añade la carpeta `bin` a tu variable de entorno PATH.
  3. Reinicia la terminal.
- **En Mac**: `brew install ffmpeg`

## 5. Ejecutar el Bot
// turbo
```bash
node app.js
```

---
**Nota**: Si al ejecutarlo ves errores de "ffmpeg not found" o "python not found", asegúrate de que ambos estén en la variable de entorno PATH de tu servidor.
