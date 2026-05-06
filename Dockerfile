FROM node:24.15.0-alpine3.23 AS fnl_base_image
ENV PORT 8082
ENV NODE_ENV production
WORKDIR /usr/src/app
RUN npm install -g npm@11.13.0 
COPY package*.json ./
RUN npm ci --only=production
COPY  --chown=node:node . .
EXPOSE 8082
CMD [ "node", "./bin/www" ]
