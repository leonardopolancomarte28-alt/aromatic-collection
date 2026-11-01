# Dockerfile de Producción para Plataforma LuxePerfumes
FROM node:20-alpine

WORKDIR /app

# Crear directorio de datos persistente para la base de datos
RUN mkdir -p /app/data

# Copiar dependencias
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/perfumes.db

EXPOSE 3000

CMD ["node", "src/server.js"]
