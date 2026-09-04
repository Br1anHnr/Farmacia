FROM node:20-alpine AS runner
WORKDIR /app

# Instalar dependencias de sistema
RUN apk add --no-cache libc6-compat

# Copiar definicoes de workspaces e dependencias
COPY package.json package-lock.json ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
COPY apps/integration-service/package.json ./apps/integration-service/

# Instalar dependencias completas (incluindo TypeScript e Webpack)
ENV NODE_ENV=development
RUN npm ci --include=dev

# Copiar o restante dos fontes
COPY . .

# Variaveis de build
ENV NEXT_TELEMETRY_DISABLED=1

# Compilar pacotes, backend e Next.js
RUN npm run build

# Definir producao para o runtime final
ENV NODE_ENV=production

# Portas dos servicos
EXPOSE 3000
EXPOSE 3001

# Iniciar aplicacao
CMD ["node", "scripts/start-production.js"]
