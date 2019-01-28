FROM node:current-alpine

RUN apk update
RUN apk add sudo
RUN mkdir /code
RUN chown node /code
WORKDIR /code
COPY --chown=node package.json package.json
RUN sudo -E -H -u node npm install mailparser adm-zip xml2js

COPY --chown=node dmarcation.js dmarcation.js
COPY --chown=node graph.html graph.html
COPY --chown=node graph.js graph.js

EXPOSE 8000
CMD sudo -E -H -u node npm start
