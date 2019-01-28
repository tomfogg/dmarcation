#!/bin/sh

docker build -t dmarcation .
docker run --name dmarcation -v $PWD:/codecopy -p8000:8000 --rm -v $PWD/mailbox:/mailbox -v $PWD/logs:/logs dmarcation
