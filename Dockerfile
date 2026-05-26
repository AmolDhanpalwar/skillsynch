# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# Node 20 Alpine builds the Vite SPA. VITE_* vars are compile-time constants
# inlined into the JS bundle — they must be present during `npm run build`,
# not at container runtime.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first — this layer is cached until package-lock.json changes
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source after dependency install to preserve the npm cache layer
COPY . .

# Build args become VITE_ env vars consumed by Vite's define transform
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Serve
# Nginx Alpine serves the /dist output. Final image ~50 MB with no Node.js.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Remove the default Nginx virtual host
RUN rm /etc/nginx/conf.d/default.conf

# Copy our SPA-aware Nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy the Vite build output from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
