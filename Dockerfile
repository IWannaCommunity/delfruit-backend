FROM node:16.20.1-bookworm

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

COPY --chown=node:node package.json .

# RUN npm install
RUN npm install --force

COPY --chown=node:node . .

USER node

EXPOSE 4201

RUN npm run tsoa spec-and-routes

CMD ["npm", "run", "start"]
