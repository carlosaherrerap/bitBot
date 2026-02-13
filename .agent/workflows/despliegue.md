# Guía de Despliegue con Docker (Recomendado)

La dockerización garantiza que el servidor tenga exactamente las mismas versiones de Node, Python y FFmpeg que el bot necesita.

## 1. Requisitos Previos
Asegúrate de tener instalados en tu servidor:
- **Docker**
- **Docker Compose**

## 2. Despliegue Rápido
// turbo
```bash
git pull origin master
docker-compose up -d --build
```

## 3. Vincular WhatsApp
1. Abre tu navegador y ve a `http://tu-servidor:9001`.
2. Escanea el código QR que aparecerá.
3. El bot se conectará y guardará la sesión en la carpeta persistente `auth_info_baileys`.

## 4. Gestión del Contenedor
- **Ver logs**: `docker logs -f bitbot`
- **Detener**: `docker-compose down`
- **Reiniciar**: `docker-compose restart`

---
### ¿Por qué Docker?
Docker soluciona los errores de "ffmpeg no encontrado" o librerías de Python faltantes, ya que todo el entorno se descarga e instala automáticamente dentro del contenedor.
