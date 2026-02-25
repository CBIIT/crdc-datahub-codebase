FROM node:22.22.0-alpine3.23 AS fnl_base_image
ENV PORT 8080
ENV NODE_ENV production
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY  --chown=node:node . .
EXPOSE 8080
CMD [ "npm", "start" ]
