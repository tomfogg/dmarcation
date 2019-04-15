FROM node:current-alpine

RUN mkdir /code
WORKDIR /code

COPY dmarcation.js dmarcation.js
COPY graph.html graph.html
COPY graph.js graph.js

COPY package.json package.json
RUN npm install
USER node

EXPOSE 8000
ENTRYPOINT ["npm", "start", "--"]
