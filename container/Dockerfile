FROM node:20-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
RUN npx playwright install --with-deps chromium
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "run", "start"]
