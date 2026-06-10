FROM node:22-alpine3.23 AS build

WORKDIR /usr/src/app

COPY . .

RUN NODE_OPTIONS="--max-old-space-size=4096" npm ci

RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

FROM nginx:1.30.2-alpine3.23-slim AS fnl_base_image

# openssl: CVE-2026-34182, CVE-2026-45447, CVE-2026-7383, CVE-2026-34180, ...
RUN apk update && apk add --no-cache --upgrade openssl

COPY --from=build /usr/src/app/build /usr/share/nginx/html
COPY --from=build /usr/src/app/conf/inject.template.js /usr/share/nginx/html/inject.template.js
COPY --from=build /usr/src/app/conf/nginx.conf /etc/nginx/conf.d/configfile.template
COPY --from=build /usr/src/app/conf/entrypoint.sh /

ENV PORT=80
ENV HOST=0.0.0.0

RUN sh -c "envsubst '\$PORT'  < /etc/nginx/conf.d/configfile.template > /etc/nginx/conf.d/default.conf"

EXPOSE 80

ENTRYPOINT [ "sh", "/entrypoint.sh" ]
