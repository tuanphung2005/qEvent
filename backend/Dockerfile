FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile

# Generate Prisma Client & copy source files
FROM base AS prerelease
COPY --from=install /temp/prod/node_modules node_modules
COPY . .
RUN bun x prisma generate

# Final runtime image
FROM base AS release
COPY --from=prerelease /usr/src/app .

# Ensure entrypoint is executable
RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
