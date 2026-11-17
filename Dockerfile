FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG PUBLIC_SITE_URL=https://testing.greenleafpacific.com
ARG SITE_INDEXING_ENABLED=false
ENV PUBLIC_SITE_URL=${PUBLIC_SITE_URL}
ENV SITE_INDEXING_ENABLED=${SITE_INDEXING_ENABLED}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28.1-alpine
COPY --from=build /app/nginx.generated.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
EXPOSE 8080
