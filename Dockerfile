# Usar imagen base de Node.js
FROM node:20-slim

# Instalar dependencias del sistema (Python3, Pip, FFmpeg)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de la aplicación
WORKDIR /app

# Instalar dependencias de Node.js
COPY package*.json ./
RUN npm install

# Copiar y colocar los requerimientos de Python
COPY requirements.txt ./
RUN python3 -m pip install --break-system-packages --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Crear carpetas necesarias
RUN mkdir -p downloads

# Comando para iniciar
CMD ["node", "app.js"]
