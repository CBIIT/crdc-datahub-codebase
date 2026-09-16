FROM python:3.14.6-alpine3.24 AS fnl_base_image

# Alpine 3.24 ships sqlite-libs 3.53.2-r0 (3.23 pins 3.51.2-r0 via python-rundeps).
RUN apk upgrade --no-cache
 
WORKDIR /usr/validator
COPY src/bento/ ./src/bento/
COPY . .
# Amazon DocumentDB CA bundle (gitignored). Always download so a local PEM cannot skip wget.
RUN apk add --no-cache wget \
 && mkdir -p resources/aws-documentdb-certificate \
 && wget -O resources/aws-documentdb-certificate/global-bundle.pem \
      https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
RUN pip3 install -r requirements.txt
 
CMD ["/usr/local/bin/python3", "src/validator.py", "configs/pv-puller-config-deploy.yml"]
