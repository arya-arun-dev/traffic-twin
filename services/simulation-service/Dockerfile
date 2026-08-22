FROM node:24-alpine AS build

WORKDIR /workspace

COPY services/simulation-service/package.json services/simulation-service/
RUN cd services/simulation-service && npm install --no-audit --no-fund

COPY src/model ./src/model
COPY src/scenario ./src/scenario
COPY src/application/roadIdentity.ts ./src/application/roadIdentity.ts
COPY src/transport ./src/transport
COPY src/data/osm.ts ./src/data/osm.ts
COPY services/simulation-service ./services/simulation-service

RUN cd services/simulation-service && npm run build


FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY services/simulation-service/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=build /workspace/services/simulation-service/dist ./dist

EXPOSE 8081

CMD ["node", "dist/server.mjs"]
