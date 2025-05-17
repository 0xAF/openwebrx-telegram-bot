#!/bin/bash

docker buildx create --name owrx-telegram-builder --driver docker-container --bootstrap --use --driver-opt network=host

docker buildx build --platform linux/amd64,linux/arm64,linux/arm/v7 --pull --push -t "slechev/openwebrx-telegram-bot" .

