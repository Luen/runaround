FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm install --frozen-lockfile
COPY . .
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
ENV BETTER_AUTH_SECRET=docker-build-placeholder-secret-key
RUN pnpm run build
ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "build"]
