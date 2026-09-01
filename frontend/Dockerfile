FROM node:20-alpine

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_BASE_DOMAIN
ARG API_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_BASE_DOMAIN=$NEXT_PUBLIC_BASE_DOMAIN
ENV API_URL=$API_URL

COPY package.json package-lock.json* ./
# npm ci is strict about lockfile version; the lock may be written by a newer
# npm locally than node:20-alpine ships. Fall back to npm install (respects
# the lock where compatible) so the build never hard-fails on format drift.
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .

RUN --mount=type=cache,target=/app/.next/cache npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
