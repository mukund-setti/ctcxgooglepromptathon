# ----------------------------------------------------------------------------
# Stage 1 — build the Vite frontend into dist/
# VITE_* keys are inlined into the client bundle at build time, so they must be
# present here. They are public, client-side keys (restrict them by referrer in
# Google Cloud). Pass them via Railway build args / variables.
# ----------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_GEMINI_API_KEY
ARG VITE_GOOGLE_CLOUD_API_KEY
ARG VITE_GEMINI_MODEL
# VITE_API_BASE_URL intentionally left empty: the frontend is served from the
# same origin as the API, so relative "/api/*" calls just work.

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2 — runtime: Express serves the API + the built frontend
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json* ./
COPY src ./src
COPY --from=build /app/dist ./dist

# Set production only after install so tsx (a devDependency) is available.
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npx", "tsx", "src/server/server.ts"]
