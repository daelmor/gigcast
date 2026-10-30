FROM node:24-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm exec svelte-kit sync && pnpm build
RUN pnpm prune --prod --ignore-scripts

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
# Drizzle migrations, applied on start when MIGRATE_ON_START=true.
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
# Set ORIGIN at deploy time (for example https://gigcast.example.com); adapter-node reads it.
CMD ["node", "build"]
