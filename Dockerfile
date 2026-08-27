FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_SECRET=docker-build-placeholder-secret-key
RUN npm run build
ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "build"]
