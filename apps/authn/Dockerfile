# Build stage — npm is only required to install dependencies.
FROM node:24.17.0-alpine3.24 AS builder
WORKDIR /usr/src/app
# Install dependencies first (cached unless package files change).
COPY package*.json ./
RUN npm ci
# Copy application source after npm ci so the dependency layer stays cached on code changes.
COPY --chown=node:node . .

# Remove devDependencies (jest, supertest) from node_modules.
RUN npm prune --omit=dev

# Run stage
FROM node:24.17.0-alpine3.24 AS fnl_base_image
ENV PORT=8082 \
    NODE_ENV=production
WORKDIR /usr/src/app
# Copy built application and production node_modules from the builder stage.
COPY --from=builder --chown=node:node /usr/src/app .
# Remove global npm shipped with the Node base image; only the node binary is needed at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    && mkdir -p logs && chown node:node logs
USER node
EXPOSE 8082
CMD ["node", "./bin/www"]
