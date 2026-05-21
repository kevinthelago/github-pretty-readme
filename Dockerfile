FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY express.js ./
COPY api/ ./api/
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 8080

ENV port=8080

CMD ["node", "express.js"]
