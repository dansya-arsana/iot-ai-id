#!/bin/sh
set -eu
# Renew only this project's certificate; reload the shared gateway after validation.
docker exec certbot certbot renew --cert-name iot-ai-release --quiet --webroot -w /var/www/certbot
docker exec gateway-nginx nginx -t
docker exec gateway-nginx nginx -s reload
