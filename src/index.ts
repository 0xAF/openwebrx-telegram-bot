/**
 * OpenWebRX Telegram Bot
 * 
 * Required Environment Variables:
 * 
 * - `MQTT_BROKER_URL`: The URL of the MQTT broker to connect to.
 * - `MQTT_USERNAME`: (Optional) Username for MQTT broker authentication.
 * - `MQTT_PASSWORD`: (Optional) Password for MQTT broker authentication.
 * - `BOT_TOKEN`: Telegram bot token for authenticating with the Telegram Bot API.
 * - `BOT_CHAT_ID`: The Telegram chat ID where notifications will be sent.
 * - `MAXMIND_API_KEY`: API key for MaxMind GeoIP services (not directly used in this code, but required for DB updates).
 * - `GEODATADIR`: Directory path for geolocation data files.
 */

import { OpenWebRXBot } from './lib/openwebrx-bot';

const botInstance = new OpenWebRXBot();
botInstance.start();
