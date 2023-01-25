FROM node:14.21.2

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

RUN apt install -y curl

WORKDIR /home/node/app

COPY package*.json ./

USER node

RUN npm install

COPY --chown=node:node . .

RUN cp ./src/config/config.dev.json ./src/config/config.json

EXPOSE 4201

CMD ["npm", "run", "start"]
