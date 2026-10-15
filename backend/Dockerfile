FROM node:22-alpine AS build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/package.json ./
COPY --chown=node:node database /app/database
RUN mkdir /app/backend/uploads && chown node:node /app/backend/uploads
USER node
EXPOSE 3000
CMD ["node","dist/server.js"]
