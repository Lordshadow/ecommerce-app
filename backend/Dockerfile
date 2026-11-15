FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=5000 \
    DATABASE_PATH=/data/ecommerce.db
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p /data && chown -R node:node /app /data
USER node
EXPOSE 5000
CMD ["sh", "-c", "if [ \"$DATABASE_ENGINE\" = \"postgres\" ]; then npm start; else npm run seed && npm start; fi"]
