FROM node:24.13.0-alpine3.22 AS fnl_base_image
ENV PORT=8080
ENV NODE_ENV=production
WORKDIR /usr/src/app
RUN npm install -g glob@11.1.0
#COPY lib/db-driver/ ./tmp-db-drivers/
#RUN cp -rL ./tmp-db-drivers/. ./crdc-datahub-database-drivers/ && rm -rf ./tmp-db-drivers
#COPY lib/db-driver/ ./crdc-datahub-database-drivers/
COPY crdc-datahub-database-drivers/ ./crdc-datahub-database-drivers/
COPY package*.json ./
RUN npm ci
COPY  --chown=node:node . .
RUN npx prisma generate
EXPOSE 8080
CMD [ "node", "./bin/www" ]
