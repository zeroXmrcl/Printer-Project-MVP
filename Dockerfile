FROM node:22-bookworm-slim AS deps
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
ENV NODE_OPTIONS=--experimental-sqlite
ENV PRINTCAST_DATA=/data
ENV CONFIG_DIR=/repo/config

FROM deps AS web
RUN npm run build -w @printcast/web
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@printcast/web"]

FROM deps AS ingest
CMD ["npm", "run", "start", "-w", "@printcast/mqtt-ingest"]

FROM deps AS media
COPY --from=mwader/static-ffmpeg:8.1.2 /ffmpeg /usr/local/bin/ffmpeg
CMD ["npm", "run", "start", "-w", "@printcast/media-worker"]
