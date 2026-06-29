FROM python:3.14.6-alpine3.24 AS fnl_base_image

# Alpine 3.24 ships sqlite-libs 3.53.2-r0 (3.23 pins 3.51.2-r0 via python-rundeps).
RUN apk upgrade --no-cache

WORKDIR /usr/validator
COPY src/bento/ ./src/bento/
COPY . .
RUN pip3 install -r requirements.txt
 
#CMD ["/usr/local/bin/python3", "src/validator.py", "-u", "$MONGO_DB_USER", "-p", "$MONGO_DB_PASSWORD", "-d", "$DATABASE_NAME", "-s", "$MONGO_DB_HOST", "-o", "27017", "-q", "$FILE_QUEUE", "-m", "https://raw.githubusercontent.com/CBIIT/crdc-datahub-models/", "configs/validate-file-config-deploy.yml"]
CMD ["/usr/local/bin/python3", "src/validator.py", "configs/validate-file-config-deploy.yml"]
