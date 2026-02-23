# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Build args para variables PUBLIC_ que Astro inlinea en build-time
ARG PUBLIC_SUPABASE_URL
ARG PUBLIC_SUPABASE_ANON_KEY
ARG PUBLIC_ADMIN_EMAIL
ARG PUBLIC_STRIPE_PUBLIC_KEY
ARG PUBLIC_CLOUDINARY_CLOUD_NAME
ARG SUPABASE_SERVICE_ROLE_KEY
ARG STRIPE_SECRET_KEY
ARG CLOUDINARY_API_KEY
ARG CLOUDINARY_API_SECRET
ARG ADMIN_EMAIL

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

# Copiar archivos .env para variables de entorno en runtime (SSR)
COPY .env* ./

# Expose port
EXPOSE 4321

# Health check con curl
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4321/ || exit 1

# Ejecutar el servidor SSR
CMD ["node", "./dist/server/entry.mjs"]

