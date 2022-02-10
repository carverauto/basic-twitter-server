FROM node:16

ENV BEARER_TOKEN AAAAAAAAAAAAAAAAAAAAAMVfKAEAAAAAiz2eWj1bQ8ctj%2BFlghFB797ooDo%3Drjmv4ZCGSkQuLhIDjFeJBSPPyUadZ3t9f8pJsjv3PEq0HrvGmt

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

CMD [ "node", "server.js" ]