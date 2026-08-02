# Lightweight static hub: Swagger UI multi-spec aggregator (served behind Kong /docs).
FROM node:22-alpine AS assets
WORKDIR /tmp
RUN npm pack swagger-ui-dist@5.18.2 \
  && tar -xzf swagger-ui-dist-5.18.2.tgz \
  && mkdir -p /out \
  && cp package/swagger-ui.css \
        package/swagger-ui-bundle.js \
        package/swagger-ui-standalone-preset.js \
        /out/ \
  && cp package/favicon-32x32.png package/favicon-16x16.png /out/ 2>/dev/null || true

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY swagger-config.json /usr/share/nginx/html/swagger-config.json
COPY --from=assets /out/ /usr/share/nginx/html/

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
