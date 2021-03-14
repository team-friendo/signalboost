FROM node:alpine

COPY . /srv/code-retriever
WORKDIR /srv/code-retriever
RUN yarn install

EXPOSE 3000
ENTRYPOINT node index.js