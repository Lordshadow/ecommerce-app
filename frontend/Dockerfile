FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG API_PROXY_TARGET=http://localhost:5000
ARG NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL=
ARG NEXT_PUBLIC_NOVARETAIL_TENANT=tenant_novaretail
ENV API_PROXY_TARGET=${API_PROXY_TARGET} \
    NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL=${NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL} \
    NEXT_PUBLIC_NOVARETAIL_TENANT=${NEXT_PUBLIC_NOVARETAIL_TENANT}
RUN npm run build

FROM node:22-bookworm-slim AS runner
ARG API_PROXY_TARGET=http://localhost:5000
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_PROXY_TARGET=${API_PROXY_TARGET}
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start", "--", "-H", "0.0.0.0"]
