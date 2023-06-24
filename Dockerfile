FROM node:16.20.0

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

USER node

COPY --chown=node:node . .

RUN npm install

CMD ["npm", "run", "tsoa", "spec-and-routes"]

EXPOSE 4201

CMD ["npm", "start"]
