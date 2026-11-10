FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:5000
ARG NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL=
ARG NEXT_PUBLIC_NOVARETAIL_TENANT=tenant_novaretail
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL=${NEXT_PUBLIC_NOVARETAIL_GATEWAY_URL} \
    NEXT_PUBLIC_NOVARETAIL_TENANT=${NEXT_PUBLIC_NOVARETAIL_TENANT}
RUN npm run build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "start", "--", "-H", "0.0.0.0"]
