#!/bin/sh

docker build -t dmarcation .
docker run --rm -v $PWD/mailbox:/mailbox -v $PWD/logs:/logs dmarcation
