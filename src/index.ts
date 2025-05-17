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

import dotenv from 'dotenv';
dotenv.config();
import mqtt from "mqtt";
import { version } from "../package.json";
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { escapers } from "@telegraf/entity";
import geoip from 'geoip-lite';


console.log(`Starting OpenWebRX Telegram Bot v${version}...`);
const requiredEnvVars = ['MQTT_BROKER_URL', 'BOT_TOKEN', 'BOT_CHAT_ID', 'MAXMIND_API_KEY', 'GEODATADIR' ];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

console.log(`Connecting to MQTT broker at ${process.env.MQTT_BROKER_URL}...`);
const client = mqtt.connect(process.env.MQTT_BROKER_URL, { username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD });

const bot = new Telegraf(process.env.BOT_TOKEN);
const v2 = escapers.MarkdownV2;

client.on("connect", () => {
  client.subscribe("openwebrx/+/CLIENT", err => {
    if (err) throw err;
  });
  client.subscribe("openwebrx/+/RX", err => {
    if (err) throw err;
  });
});

client.on("message", async (topic, message) => {
  const parts = topic.split("/");
  const receiver = parts.length === 3 ? parts[1] : undefined;
  const action = parts[parts.length - 1];
  const data = JSON.parse(message.toString());
  let msg = `[__*${v2(receiver)}*__]: `

  if (action === "CLIENT") {
    const ip = data.ip.replace("::ffff:", "");
    const geo = geoip.lookup(ip);
    switch (data.state) {
      case "Connected":
        msg += `_client connected_`;
        break;
      case "Disconnected":
        if (data.banned) {
          msg += `_client banned_`;
        } else {
          msg += `_client disconnected_`;
        }
        break;
      case "ChatMessage":
        msg += `*${v2(data.name)}*: ${v2(data.message)}`;
        break;
      default:
        msg += JSON.stringify(data);
    }
    if (geo) {
      msg += `\n[${v2(ip)}](${v2("https://ip-api.com#" + ip)})`;
      if (geo?.city) msg += `, ${v2(geo.city)}`;
      // if (geo?.region) msg += `, ${v2(geo.region)}`;
      if (geo?.country) msg += `, ${v2(geo.country)}`;
      if (geo?.eu) msg += ` \\(EU\\)`;
      msg += '';
    } else {
      msg += `\n${v2(ip)}`;
    }
  } else if (action === "RX") {
    msg += `_Profile on_ *${v2(data.source)}*  ⇾  *${v2(data.profile)}* \\(${v2((data.freq / 1000 / 1000).toFixed(3))} MHz\\)`;
  }

  console.log(`${msg}`);
  await bot.telegram.sendMessage(process.env.BOT_CHAT_ID as string, msg, { parse_mode: "MarkdownV2", disable_notification: true, link_preview_options: { is_disabled: true } });
});


bot.on(message('text'), async (ctx) => {
  console.log(ctx.update.message);
  // Explicit usage
  await ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.message.from.first_name}`)
})

console.log(`Starting Telegram Bot...`);
bot.launch();

function terminate() {
  console.log("Terminating...");
  bot.stop('Terminating...')
  client.end();
  process.exit();
}

process.on("SIGINT", () => {
  terminate();
});

process.on("SIGTERM", () => {
  terminate();
});
