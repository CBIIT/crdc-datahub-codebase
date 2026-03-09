FROM node:22.22.0-alpine3.23 AS fnl_base_image

WORKDIR /usr/src/app

COPY  --chown=node:node . .

RUN npm ci

ENV PORT=8081
ENV NODE_ENV=production

EXPOSE 8081
CMD ["npm", "start"]
