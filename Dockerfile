# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Compilar la aplicación Astro
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Instalar curl para healthcheck
RUN apk add --no-cache curl

# Copiar package.json para instalar solo dependencias de producción
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm install --only=production

# Copiar archivos compilados desde el builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4321

# Health check con curl
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4321/ || exit 1

# Ejecutar el servidor SSR
CMD ["node", "./dist/server/entry.mjs"]

