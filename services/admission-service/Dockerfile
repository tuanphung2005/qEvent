FROM oven/bun:1.2-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY prisma ./prisma
RUN bunx prisma generate

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV KEYS_DIR=/app/keys
EXPOSE 3002

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run start"]
