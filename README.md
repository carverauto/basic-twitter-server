# basic-twitter-server

Connects to the twitter stream API and based on the rules we've defined, 
listens for our tweets and writes them to a pusher channel

## DOCKER

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
