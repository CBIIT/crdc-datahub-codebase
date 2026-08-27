FROM python:3.14.6-alpine3.24 AS fnl_base_image

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
 
#CMD [/usr/local/bin/python3 src/validator.py configs/validate-essential-config-deploy.yml]
CMD ["/usr/local/bin/python3", "src/validator.py", "configs/validate-essential-config-deploy.yml"]
