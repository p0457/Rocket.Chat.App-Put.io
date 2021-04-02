# Rocket.Chat.App-Put.io

Interact with your Put.io account.

# Deprecated

This project will no longer be maintained by me, I have retired my Rocket.Chat server in favor of a Matrix Synapse server.

## Configuration

> Create a Put.io application at https://put.io

Other Settings include:

### Client Id
Client Id of your created Put.io application.
### Client Secret
Client Secret of your created Put.io application.

## Docker
A Dockerfile and docker-compose are provided.

Build the docker image and run it to deploy to your server:
`docker build -t rocketchatapp_putio . && docker run -it --rm -e URL=YOUR_SERVER -e USERNAME=YOUR_USERNAME -e PASSWORD=YOUR_PASSWORD rocketchatapp_putio`

Build the docker image and run docker-compose to deploy to your server:
`docker build -t rocketchatapp_putio . && docker-compose run --rm -e URL=YOUR_SERVER -e USERNAME=YOUR_USERNAME -e PASSWORD=YOUR_PASSWORD rocketchatapp_putio`
