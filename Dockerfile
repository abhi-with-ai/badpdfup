FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    qpdf \
    ghostscript \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    fonts-dejavu \
    fonts-liberation \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && \
    if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY --chown=node:node server ./server

RUN mkdir -p /app/tmp /home/node/.config && \
    chown -R node:node /app /home/node

ENV NODE_ENV=production \
    HOME=/home/node \
    TMPDIR=/app/tmp

USER node
EXPOSE 5000
CMD ["node", "server/src/server.js"]