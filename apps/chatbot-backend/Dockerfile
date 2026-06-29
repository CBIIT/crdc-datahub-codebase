FROM node:24-alpine3.23 AS fnl_base_image

# openssl: CVE-2026-34182, CVE-2026-45447, CVE-2026-7383, CVE-2026-34180, ...
RUN apk update && apk add --no-cache --upgrade openssl

WORKDIR /usr/src/app

COPY  --chown=node:node . .

RUN npm ci

RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm \
  && rm -f /usr/local/bin/npx

ENV PORT=8081
ENV NODE_ENV=production

EXPOSE 8081
CMD ["node", "src/index.ts"]
