# openwebrx-telegram-bot

Telegram bot to report OpenWebRX MQTT events.

## Overview

**openwebrx-telegram-bot** listens to MQTT events from an OpenWebRX server and sends notifications to a specified Telegram chat. It provides real-time updates about client connections, disconnections, chat messages, and receiver profile changes.

## Features

- Connects to an MQTT broker and subscribes to OpenWebRX topics.
- Sends notifications to a Telegram chat.
- Includes geolocation lookup for client IP addresses.

## Requirements

- Node.js (v16+ recommended)
- Access to an MQTT broker used by OpenWebRX
- Telegram Bot Token and Chat ID
- MaxMind GeoIP API key (for database updates)

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
    GEODATADIR=/tmp/geoip
    ```

1. Update GeoIP database:

    ```sh
    ./update-geoip-db.sh
    ```

## Usage

Build and start the bot:

```sh
npm run start
```

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

## MQTT Topics

The bot subscribes to the following MQTT topics from OpenWebRX:

- `openwebrx/+/CLIENT` — for client connection, disconnection, and chat messages
- `openwebrx/+/RX` — for receiver profile changes

## License

MIT License. See LICENSE for details.
