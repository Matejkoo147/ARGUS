# ARGUS — static SPA + nginx (production)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
  && test -f dist/static/favicon-180.png \
  && test -f dist/static/favicon.ico \
  && test -f dist/static/manifest.json \
  && test -f dist/apple-touch-icon.png

FROM nginx:1.27-alpine
RUN apk add --no-cache openssl \
  && mkdir -p /etc/nginx/argus /etc/nginx/argus-templates /etc/nginx/argus/tls
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/argus-app-locations.conf /etc/nginx/argus/argus-app-locations.conf
COPY deploy/nginx/ha-proxy.conf.template /etc/nginx/argus-templates/ha-proxy.conf.template
COPY deploy/nginx/ssl.conf.template /etc/nginx/argus-templates/ssl.conf.template
COPY deploy/nginx/stt-proxy.conf.template /etc/nginx/argus-templates/stt-proxy.conf.template
COPY deploy/nginx/ollama-proxy.conf.template /etc/nginx/argus-templates/ollama-proxy.conf.template
COPY deploy/nginx/42-argus-stt-proxy.sh /docker-entrypoint.d/42-argus-stt-proxy.sh
COPY deploy/nginx/43-argus-ollama-proxy.sh /docker-entrypoint.d/43-argus-ollama-proxy.sh
COPY deploy/nginx/docker-entrypoint.sh /docker-entrypoint.d/40-argus-ha-proxy.sh
COPY deploy/nginx/41-argus-ssl.sh /docker-entrypoint.d/41-argus-ssl.sh
RUN chmod +x /docker-entrypoint.d/40-argus-ha-proxy.sh /docker-entrypoint.d/41-argus-ssl.sh /docker-entrypoint.d/42-argus-stt-proxy.sh /docker-entrypoint.d/43-argus-ollama-proxy.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080 8443
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
