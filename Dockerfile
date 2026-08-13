FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/render/project/src

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=10000
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 10000

CMD ["node", "server/index.js"]
