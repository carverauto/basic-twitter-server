# basic-twitter-server

Connects to the twitter stream API and based on the rules we've defined, 
listens for our tweets and writes them to a pusher channel

## DOCKER

Example Dockerfile

```
FROM node:16

ENV BEARER_TOKEN twitterBearerTokenGoesHere
ENV API_KEY moreKeyz
ENV API_SECRET seCretz
ENV PUSHER_API_APPID apIdznstuff
ENV PUSHER_API_KEY moarApiKeyz
ENV PUSHER_API_SECRET moarSekreetz
ENV PUSHER_API_CLUSTER us2
EXPOSE 8080

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
```

### Building with Docker

Make sure you insert the twitter BEARER_TOKEN below

```shell
npm install
```

```shell
 docker build . --build-arg BEARER_TOKEN=TOKEN -t nodejs-twitter
```

### Running docker

```shell
docker run --restart always -d --name nodejs-twitter -p 8080:8080 nodejs-twitter
```

### Container management

It seems this nodejs stuff likes to crash after a while so, we'll help it out:

Crontab:

```shell
*/30 * * * *	docker restart nodejs-twitter
```

### Logs

```shell
docker logs nodejs-twitter
```

## API

Coming soon..
