FROM node:22-bookworm-slim AS base
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mqtt-ingest/package.json apps/mqtt-ingest/package.json
COPY apps/media-worker/package.json apps/media-worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
RUN npm ci
COPY . .
RUN npm run build -w @printcast/web
ENV NODE_OPTIONS=--experimental-sqlite
ENV PRINTCAST_DATA=/data
ENV CONFIG_DIR=/repo/config

FROM base AS web
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@printcast/web"]

FROM base AS ingest
CMD ["npm", "run", "start", "-w", "@printcast/mqtt-ingest"]

FROM base AS media
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
CMD ["npm", "run", "start", "-w", "@printcast/media-worker"]
