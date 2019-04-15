#!/bin/sh

docker build -t dmarcation .
docker run --name dmarcation -p8000:8000 --rm -v $PWD/$1:/code/$1 dmarcation $1
