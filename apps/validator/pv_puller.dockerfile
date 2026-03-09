FROM python:3.14.2-alpine3.22 AS fnl_base_image
 
WORKDIR /usr/validator
COPY . .
RUN pip3 install -r requirements.txt
 
CMD ["/usr/local/bin/python3", "src/validator.py", "configs/pv-puller-config-deploy.yml"]
