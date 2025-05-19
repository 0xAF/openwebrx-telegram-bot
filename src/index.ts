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
const requiredEnvVars = ['MQTT_BROKER_URL', 'BOT_TOKEN', 'BOT_CHAT_ID', 'MAXMIND_API_KEY', 'GEODATADIR'];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const mqttTopicBase = process.env.MQTT_TOPIC_BASE || "openwebrx";

console.log(`Connecting to MQTT broker at ${process.env.MQTT_BROKER_URL}...`);
const client = mqtt.connect(process.env.MQTT_BROKER_URL, { username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD });

const bot = new Telegraf(process.env.BOT_TOKEN);

interface Escapers {
  MarkdownV2: (input: string) => string;
}
const v2 = (x: string | undefined | null): string => x && x.length ? (escapers as Escapers).MarkdownV2(x) : "";

// Store messages in a ring buffer by mode
type RingBuffer = { [mode: string]: any[] };
const RING_BUFFER_SIZE = 100;
if (!globalThis._ringBuffers) globalThis._ringBuffers = {};
const ringBuffers: RingBuffer = globalThis._ringBuffers;

client.on("connect", () => {
  client.subscribe(mqttTopicBase + "/+");
  client.subscribe(mqttTopicBase + "/+/+");
  // const subTopics = ['CLIENT', 'RX', 'ADSB', 'AIS', 'FT4', 'FT8', 'APRS'];
  // for (const subTopic of subTopics) {
  //   client.subscribe(mqttTopicBase + "/" + subTopic);
  //   client.subscribe(mqttTopicBase + "/+/" + subTopic);
  // }
});

client.on("message", async (topic, message) => {
  const parts = topic.split("/");
  const receiver = parts.length === 3 ? parts[1] : undefined;
  const action = parts[parts.length - 1];
  const data = JSON.parse(message.toString());
  let msg = receiver ? `[__*${v2(receiver)}*__]: ` : '';

  switch (action) {

    case "CLIENT": {
      const ip = data?.ip?.replace("::ffff:", "");
      const geo = geoip?.lookup(ip);
      switch (data?.state) {
        case "Connected":
          msg += `_client connected_`;
          break;
        case "Disconnected":
          if (data?.banned) {
            msg += `_client banned_`;
          } else {
            msg += `_client disconnected_`;
          }
          break;
        case "ChatMessage":
          msg += `*${v2(data?.name)}*: ${v2(data?.message)}`;
          break;
        default:
          msg += v2(JSON.stringify(data));
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
      console.log(`${msg}`);
      await bot.telegram.sendMessage(process.env.BOT_CHAT_ID as string, msg, { parse_mode: "MarkdownV2", disable_notification: true, link_preview_options: { is_disabled: true } });
      break;
    }

    case "RX":
      msg += `_Profile on_ *${v2(data?.source)}*  ⇾  *${v2(data?.profile)}* \\(${v2((data?.freq / 1000 / 1000).toFixed(3))} MHz\\)`;
      console.log(`${msg}`);
      await bot.telegram.sendMessage(process.env.BOT_CHAT_ID as string, msg, { parse_mode: "MarkdownV2", disable_notification: true, link_preview_options: { is_disabled: true } });
      break;

    default: {
      let mode = data?.mode?.toUpperCase() || action.toUpperCase();
      // let type = data?.type ? '-' + data.type.toUpperCase() : '';
      // mode += type;
      // if (mode === "AIS-NMEA") break;

      if (!ringBuffers[mode]) ringBuffers[mode] = [];
      let parsedData = data;
      if (typeof data === "string") {
        try {
          parsedData = JSON.parse(data);
        } catch {
          parsedData = data;
        }
      }
      delete parsedData?.raw;
      ringBuffers[mode].push(parsedData);
      if (ringBuffers[mode].length > RING_BUFFER_SIZE) ringBuffers[mode].shift();
    }
  }

});

bot.use(async (ctx, next) => {
  console.time(`Processing update ${ctx.update.update_id}`);
  await next() // runs next middleware
  // runs after next middleware finishes
  console.timeEnd(`Processing update ${ctx.update.update_id}`);
});

bot.start(async (ctx) => {
  await ctx.reply(`Type /help to see available commands.`);
});

bot.help(async (ctx) => {
  console.log(`Help command:`, ctx.update.message);
  await ctx.reply(`
/help - Show this help message
/getid - Get your chat ID
/last <mode> [how many] - Show the last messages in the specified mode
`);
});

bot.command('getid', async (ctx) => {
  await ctx.reply(`Your chat ID is: ${ctx.message.chat.id}`);
});

function timeStampToString(ts: number): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = new Date(ts);
  const y = date.getFullYear() % 100;
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${pad(y)}-${m}-${d} ${h}:${min}:${s}`;
}

function footToKilometer(alt: number | string): number {
  const numAlt = typeof alt === "string" ? parseFloat(alt) : alt;
  return numAlt * 0.0003048;
}

function knotsToKmh(speed: number | string): number {
  const numSpeed = typeof speed === "string" ? parseFloat(speed) : speed;
  return numSpeed * 1.852;
}

function degreesToCompass(degrees: number | string): string {
  const numDegrees = typeof degrees === "string" ? parseFloat(degrees) : degrees;
  const directions = [
    "(N 🢁)", "(NNE 🢁🢅)", "(NE 🢅)", "(ENE 🢂🢅)",
    "(E 🢂)", "(ESE 🢂🢆)", "(SE 🢆)", "(SSE 🢃🢆)",
    "(S 🢃)", "(SSW 🢃🢇)", "(SW 🢇)", "(WSW 🢀🢇)",
    "(W 🢀)", "(WNW 🢀🢄)", "(NW 🢄)", "(NNW 🢁🢄)"
  ];
  const index = Math.round(((numDegrees % 360) / 22.5)) % 16;
  return directions[index];
}

bot.command('last', async (ctx) => {
  if (ctx.args.length === 0) {
    await ctx.replyWithMarkdownV2(`Use \\/last \\<_mode_\\> \\[_how many_\\] to see the last messages\\.\nAvailable modes: *${Object.keys(ringBuffers).map(v2).join("*\\, *")}*`);
    return;
  }
  if (!ringBuffers[ctx.args[0].toUpperCase()]) {
    await ctx.replyWithMarkdownV2(`Mode *${v2(ctx.args[0])}* not found\\.\nAvailable modes: *${Object.keys(ringBuffers).map(v2).join("*\\, *")}*`);
    return;
  }
  const mode = ctx.args[0].toUpperCase();
  const howMany = parseInt(ctx.args[1] || "10");
  const lastBuf = ringBuffers[mode];

  if (lastBuf.length === 0) {
    await ctx.replyWithMarkdownV2(`No messages found in mode *${v2(mode)}*\\.`);
    return;
  }
  let reply = `Last messages in mode *${v2(mode)}*\\:\n`;
  const msgs = lastBuf.slice(-howMany).reverse();
  for (const msg of msgs) {
    reply += '\n▶ ';
    if (mode === "FT8" || mode === 'FT4') {
      // {"timestamp":1747612417000,"db":-1,"dt":-0.1,"freq":7048925,"msg":"CQ OE7LGT JN57","callsign":"OE7LGT","locator":"JN57","mode":"FT4","interval":7.5,"ccode":"AT","country":"Austria"}
      // {"timestamp":1747609095000,"db":-20,"dt":0.3,"freq":7074291,"msg":"CQ IN3IZQ JN56","callsign":"IN3IZQ","locator":"JN56","mode":"FT8","interval":15,"ccode":"IT","country":"Italy"}
      reply += `__${v2(timeStampToString(msg?.timestamp))}__ ` +
        `\\(${v2((msg?.freq / 1000 / 1000).toFixed(3))} _MHz_\\) ` +
        `*[${v2(msg?.callsign)}](https://qrz.com/db/${msg?.callsign})* ` +
        `\\[_QTH_\\: ${v2(msg?.locator)}, ${v2(msg?.country)}\\]\\: ${v2(msg?.msg)}\n`;
    } else if (mode === 'ADSB') {
      // {"mode":"ADSB","icao":"4BA995","timestamp":1747610678500,"msgs":1570,"rssi":-11.2,"country":"Turkey","ccode":"TR","aircraft":"TC-JLU","lat":43.124131,"lon":28.085109,"flight":"THY4SY","category":"A3","squawk":"6340","altitude":17900,"vspeed":-1536,"speed":302,"course":271,"ttl":1747611578500,"mapid":"4BA995","color":"#FF99CC"}
      reply += `__${v2(timeStampToString(msg?.timestamp))}__ ` +
        `*${v2(msg?.aircraft)} [${v2(msg?.icao)}](https://www.planespotters.net/hex/${msg?.icao})* ` +
        (msg?.flight ? `\\[[${v2(msg.flight)}](https://www.flightradar24.com/${msg.flight})\\] ` : "") +
        (msg?.altitude ? `Alt: *${v2(footToKilometer(msg.altitude).toFixed(2))}* km ` : "") +
        (msg?.speed ? `Spd: *${v2(knotsToKmh(msg.speed).toFixed(2))}* km/h ` : "") +
        (msg?.course ? `Dir: *${v2(degreesToCompass(msg.course))}* ` : "") +
        (msg?.country ? `\\[${v2(msg.country)}\\] ` : "") +
        (msg?.lat && msg?.lon
          ? `[Map](https://www.openstreetmap.org/?mlat=${msg.lat}&mlon=${msg.lon}) `
          : "");
    } else if (mode === 'AIS') {
      // {"source":"AIS","destination":"APDW16","path":[],"raw":"","type":"object","object":"207834870","live":true,"timestamp":1747611660000,"lat":43.18933333333333,"lon":27.654166666666665,"symbol":{"symbol":"s","table":"/","index":82,"tableindex":14},"course":82,"speed":0,"comment":"RIGEL, LZH3487, dest. VARNA","ccode":"BG","country":"Bulgaria","mode":"AIS"}
      if (msg?.type === "nmea") {
        reply += `NMEA Message`;
        continue;
      }
      reply += `__${v2(timeStampToString(msg?.timestamp))}__ ` +
        (msg?.object ? `\\[[${v2(msg.object)}](https://www.vesselfinder.com/vessels/details/${msg.object})\\] ` : "") +
        (msg?.speed !== undefined ? `Spd: *${v2(knotsToKmh(msg.speed).toFixed(2))}* km/h ` : "") +
        (msg?.course !== undefined ? `Dir: *${v2(degreesToCompass(msg.course))}* ` : "") +
        (msg?.country ? `\\(${v2(msg.country)}\\) ` : "") +
        (msg?.lat && msg?.lon
          ? `[Map](https://www.openstreetmap.org/?mlat=${msg.lat}&mlon=${msg.lon}) `
          : "") +
        (msg?.comment ? `\\[${v2(msg.comment)}\\] ` : "");
    } else if (mode === 'APRS') {
      // {"source":"TB1DVM-7","destination":"APAT51","path":["YM3BUR*","WIDE1*","LZ0DAD*","WIDE2*"],"raw":"","lat":40.965666666666664,"lon":28.660166666666665,"symbol":{"symbol":"y","table":"/","index":88,"tableindex":14},"type":"regular","course":169,"speed":0,"altitude":59.7408,"comment":"OP.MURATHAN 0532 348 3764","mode":"APRS"}
      reply += msg?.timestamp ? `__${v2(timeStampToString(msg?.timestamp))}__ ` : '' +
        (msg?.source
          ? `*[${v2(msg.source)}](https://aprs.fi/#!z=11&call=a%2F${msg.source}&timerange=3600&tail=3600) \\[[QRZ](https://www.qrz.com/db/${v2(msg.source.replace(/-\d+$/, ""))})\\]* `
          : "") +
        (msg?.destination ? `→ *${v2(msg.destination)}* ` : "") +
        (msg?.altitude !== undefined ? `Alt: *${v2(msg.altitude?.toFixed(2))}* m ` : "") +
        (msg?.speed !== undefined ? `Spd: *${v2(knotsToKmh(msg.speed).toFixed(2))}* km/h ` : "") +
        (msg?.course !== undefined ? `Dir: *${v2(degreesToCompass(msg.course))}* ` : "") +
        (msg?.country ? `\\(${v2(msg.country)}\\) ` : "") +
        (msg?.lat && msg?.lon
          ? `[Map](https://www.openstreetmap.org/?mlat=${msg.lat}&mlon=${msg.lon}) `
          : "") +
        (msg?.comment ? `\\[${v2(msg.comment)}\\] ` : "");
    } else {
      reply += v2(JSON.stringify(msg));
    }
  }


  // Telegram message limit is 4096 characters, so split and send in parts
  const MAX_LENGTH = 4096;
  const replyParts: string[] = [];
  let current = "";

  for (const line of reply.trim().split('\n')) {
    if ((current + line + '\n').length > MAX_LENGTH) {
      replyParts.push(current);
      current = "";
    }
    current += line + '\n';
  }
  if (current.length > 0) replyParts.push(current);

  for (const part of replyParts) {
    await ctx.replyWithMarkdownV2(part.trim(), { link_preview_options: { is_disabled: true } });
  }
});

bot.on(message('text'), async (ctx) => {
  // if (ctx.message.text.startsWith('/')) return;
  if ('entities' in ctx.update.message && Array.isArray(ctx.update.message.entities) && ctx.update.message.entities[0]?.type === "bot_command") return;
  console.log(`Private message:`, ctx.update.message);
  // Explicit usage
  await ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.message.from.first_name}, your Chat ID is: ${ctx.message.chat.id}.\nType /help to see available commands.`);
});

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
