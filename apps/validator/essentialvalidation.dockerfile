FROM python:3.14.7-alpine3.24 AS builder
# Amazon DocumentDB CA bundle (gitignored). Always download so a local PEM cannot skip wget.
RUN apk add --no-cache wget \
 && mkdir -p /certs \
 && wget -O /certs/global-bundle.pem \
      https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

FROM python:3.14.7-alpine3.24 AS fnl_base_image
RUN apk upgrade --no-cache
WORKDIR /usr/validator
COPY src/bento/ ./src/bento/
COPY . .
COPY --from=builder /certs/global-bundle.pem \
     resources/aws-documentdb-certificate/global-bundle.pem
RUN pip3 install --no-cache-dir --upgrade "pip>=26.2" \
 && pip3 install --no-cache-dir -r requirements.txt \
 && pip3 uninstall -y pip setuptools wheel

CMD ["/usr/local/bin/python3", "src/validator.py", "configs/validate-essential-config-deploy.yml"]
