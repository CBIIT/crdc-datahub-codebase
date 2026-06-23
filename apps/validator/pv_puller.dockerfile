FROM python:3.14.6-alpine3.24 AS fnl_base_image

# Alpine 3.24 ships sqlite-libs 3.53.2-r0 (3.23 pins 3.51.2-r0 via python-rundeps).
RUN apk upgrade --no-cache
 
WORKDIR /usr/validator
COPY src/bento/ ./src/bento/
COPY . .
RUN pip3 install -r requirements.txt
 
CMD ["/usr/local/bin/python3", "src/validator.py", "configs/pv-puller-config-deploy.yml"]
