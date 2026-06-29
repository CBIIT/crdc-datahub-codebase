FROM python:3.14.6-alpine3.24 AS fnl_base_image

RUN apk upgrade --no-cache

WORKDIR /usr/validator
COPY src/bento/ ./src/bento/
COPY . .
RUN pip3 install -r requirements.txt
 
#CMD [/usr/local/bin/python3 src/validator.py configs/validate-metadata-config-deploy.yml]
CMD ["/usr/local/bin/python3", "src/validator.py", "configs/validate-metadata-config-deploy.yml"]
