# openwebrx-telegram-bot

Telegram reporting OpenWebRX MQTT events to @YourChannel or in private message.

## Overview

**openwebrx-telegram-bot** listens to MQTT events from an OpenWebRX server and sends notifications to a specified Telegram chat. It provides real-time updates about client connections, disconnections, chat messages, receiver profile changes, etc.

## ChangeLog

See [ChangeLog](CHANGELOG.md) for more info.

## Features

- The bot will reply to some [Commands](#commands)
- Includes offline geolocation lookup for client IP addresses. You need maxmind.com free license key. (**WARNING**: Keep in mind that the first run will take few minutes to cache the GeoIP data)
- The Bot will reply to your private messages with your Chat ID (so you can use it later in the config)

# Commands

- /help - show help
- /getid - reply with ChatID of the user, who sent the command
- /last <`mode`> [`how_many`] - reply with last messages from background decoders

## Requirements

- Node.js
- A working MQTT Broker.
- Access to an MQTT broker used by OpenWebRX. [Configure MQTT in OpenWebRX](#configure-mqtt-in-openwebrx).
- Telegram Bot Token. [Setup Telegram Bot](#setup-telegram-bot).
- MaxMind GeoIP API License key (for database updates). [Register](https://maxmind.com) for a free account and get a License Key.

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/0xAF/openwebrx-telegram-bot.git
   cd openwebrx-telegram-bot
   ```

1. Install dependencies:

    ```sh
    npm install
    ```

1. Configure environment variables by editing the .env file:

    ```sh
    MQTT_BROKER_URL="mqtt://your-mqtt-broker:1883"
    MQTT_USERNAME=
    MQTT_PASSWORD=
    BOT_TOKEN=your_telegram_bot_token
    BOT_CHAT_ID=your_telegram_chat_id
    MAXMIND_API_KEY=your_maxmind_api_key
    GEODATADIR=/tmp/geoip # absolute path
    ```

1. Update GeoIP database:

    ```sh
    ./update-geoip-db.sh
    ```

1. Start the bot:

    ```sh
    npm run start
    ```

## Docker Installation

You can also run the bot using Docker. This is the easiest way to get started if you don't want to install Node.js and dependencies manually.

1. Get the docker image by one of the following methods:

    - Pull from Docker hub.

        ```sh
        docker pull slechev/openwebrx/telegram-bot
        ```

    - Build it yourself.

        ```sh
        docker build -t openwebrx-telegram-bot .
        ```

1. Create a `.env` file in the project directory with your configuration (see above for required variables).

1. Run the container, mounting the directory for GeoIP data and using the .env file:

    - Docker stand alone

        ```sh
        docker run --env-file .env -v /tmp/geoip:/tmp/geoip slechev/openwebrx-telegram-bot
        ```

    - Docker compose (use the exmample file)

        ```sh
        docker compose up -d
        ```

This will start the bot inside a container, using your environment variables and the GeoIP database directory.

## Usage

The bot will connect to the MQTT broker and start sending notifications to the configured Telegram chat.

| Variable           | Description                                               | Required |
|--------------------|-----------------------------------------------------------|----------|
| MQTT_BROKER_URL    | URL of the MQTT broker                                    | Yes      |
| MQTT_USERNAME      | MQTT broker username                                      | No       |
| MQTT_PASSWORD      | MQTT broker password                                      | No       |
| BOT_TOKEN          | Telegram bot token                                        | Yes      |
| BOT_CHAT_ID        | Telegram chat ID (e.g., `@YourChannel` or chat numeric ID)| Yes      |
| MAXMIND_API_KEY    | MaxMind GeoIP API key (for DB updates)                    | Yes      |
| GEODATADIR         | Directory for geolocation data files                      | Yes      |

## Configure MQTT in OpenWebRX

- Open OpenWebRX Settings page.
- Go to "Spotting and reporting".
- Find "MQTT settings" section.
- Fill the required data.
- Set the "MQTT topic" to "`openwebrx/YourReceiverShortName`"

## MQTT Topics

The bot subscribes to the following MQTT topics from OpenWebRX:

- `openwebrx/+/CLIENT` — for client connection, disconnection, and chat messages
- `openwebrx/+/RX` — for receiver profile changes

This is due to support multiple OpenWebRx receivers in one MQTT broker. You should set the "MQTT topic" in OpenWebRx to "`openwebrx/ReceiverShortName`"

## Setup Telegram Bot

- Create new Bot with @BotFather. See [instructions](https://core.telegram.org/bots/features#creating-a-new-bot).
- Get the Token and set it in your `.env` file.
- (Optionaly) Create a Channel and add the Bot to the channel (with admin role).

## License

MIT License. See LICENSE for details.
