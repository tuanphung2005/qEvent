FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src/ ./src/
COPY tsconfig.json ./

EXPOSE 8000

ENV NODE_ENV=production
ENV PORT=8000

CMD ["bun", "run", "src/index.ts"]
