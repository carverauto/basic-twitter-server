# basic-twitter-server

Connects to the twitter stream API and based on the rules we've defined, 
listens for our tweets and writes them to firestore

## DOCKER

### Building with Docker

Make sure you insert the twitter BEARER_TOKEN below

```
npm install
```


```
 docker build . --build-arg BEARER_TOKEN=TOKEN -t nodejs-twitter
```

### Running docker

```
docker run -d nodejs-twitter
```
### Container management

It seems this nodejs stuff likes to crash after a while so, we'll help it out:

Crontab:

```
0 */6 * * *	docker restart nodejs-twitter
```

## API

Coming soon..
