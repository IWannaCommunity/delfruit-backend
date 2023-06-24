FROM node:16.20.0

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

COPY --chown=node:node package.json .

RUN npm install

CMD ["npm", "run", "tsoa", "spec-and-routes"]

COPY --chown=node:node . .

USER node

EXPOSE 4201

CMD ["npm", "run", "start"]
