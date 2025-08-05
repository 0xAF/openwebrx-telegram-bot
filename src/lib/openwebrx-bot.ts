import dotenv from 'dotenv';
dotenv.config(); // initialize dotenv before DEBUG
import _debug from 'debug';
import mqtt from "mqtt";
import { version } from "../../package.json";
import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
// import geoip from 'geoip-lite';
import { formatLastMessages } from './decoders-parser';
import { v2 } from './utils';
import { formatClientMessage } from './client-parser';
import { formatRxMessage } from './rs-parser';
import fs from 'fs';
import path from 'path';

export class OpenWebRXBot {
    private bot: Telegraf<any>;
    private mqtt: mqtt.MqttClient;
    private ringBuffers: { [mode: string]: any[] };
    private readonly RING_BUFFER_SIZE = 100;
    private readonly mqttTopicBase: string;
    private readonly requiredEnvVars = ['MQTT_BROKER_URL', 'BOT_TOKEN', 'BOT_CHAT_ID', 'MAXMIND_API_KEY', 'GEODATADIR', 'DATA_DIR'];
    private showBanned: boolean = true;
    private ipAliases: { [alias: string]: string[] } = {};

    constructor() {
        console.log(`Starting OpenWebRX Telegram Bot v${version}...${process.env.DEBUG ? ` (DEBUG=${process.env.DEBUG})` : ""}`);
        this.checkEnv();
        this.mqttTopicBase = process.env.MQTT_TOPIC_BASE || "openwebrx";
        console.log(`Connecting to MQTT broker at ${process.env.MQTT_BROKER_URL}...`);
        this.mqtt = mqtt.connect(process.env.MQTT_BROKER_URL!, { username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD });
        this.bot = new Telegraf(process.env.BOT_TOKEN!);
        if (!this.ringBuffers) this.ringBuffers = {};
        this.setupMQTT();
        this.setupBot();
    }

    private checkEnv() {
        const missingVars = this.requiredEnvVars.filter((key) => !process.env[key]);
        if (missingVars.length > 0) {
            console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
            process.exit(1);
        }
    }

    private setupMQTT() {
        const debugMQTT = _debug('bot:MQTT');
        const debugGeo = _debug('bot:Geo');
        const debugTelegram = _debug('bot:Telegram');
        const debugDecoders = _debug('bot:Decoders');
        this.mqtt.on("connect", () => {
            debugMQTT("Connected to MQTT broker. Subscribing to topics...");
            this.mqtt.subscribe(this.mqttTopicBase + "/+");
            this.mqtt.subscribe(this.mqttTopicBase + "/+/+");
        });

        this.mqtt.on("message", async (topic, message) => {
            const parts = topic.split("/");
            const receiver = parts.length === 3 ? parts[1] : undefined;
            const action = parts[parts.length - 1];
            const data = JSON.parse(message.toString());
            let msg = receiver ? `[__*${v2(receiver)}*__]: ` : '';

            switch (action) {
                case "CLIENT": {
                    debugMQTT("Client message received on topic %s: %j", topic, data);
                    if (data.state === "Disconnected" && data?.banned && !this.showBanned) break;
                    msg += formatClientMessage(data, this.ipAliases);
                    debugTelegram("Sending message to Telegram: %s", msg);
                    await this.bot.telegram.sendMessage(
                        process.env.BOT_CHAT_ID as string,
                        msg,
                        { parse_mode: "MarkdownV2", disable_notification: true, link_preview_options: { is_disabled: true } }
                    );
                    break;
                }
                case "RX":
                    debugMQTT("RX message received on topic %s: %j", topic, data);
                    msg += formatRxMessage(data);
                    debugTelegram("Sending message to Telegram: %s", msg);
                    await this.bot.telegram.sendMessage(
                        process.env.BOT_CHAT_ID as string,
                        msg,
                        { parse_mode: "MarkdownV2", disable_notification: true, link_preview_options: { is_disabled: true } }
                    );
                    break;
                default: {
                    debugDecoders("Decoder message received on topic %s: %j", topic, data);
                    let mode = data?.mode?.toUpperCase() || action.toUpperCase();
                    if (!this.ringBuffers[mode]) this.ringBuffers[mode] = [];
                    let parsedData = data;
                    if (typeof data === "string") {
                        try {
                            parsedData = JSON.parse(data);
                        } catch {
                            parsedData = data;
                        }
                    }
                    delete parsedData?.raw;
                    this.ringBuffers[mode].push(parsedData);
                    if (this.ringBuffers[mode].length > this.RING_BUFFER_SIZE) this.ringBuffers[mode].shift();
                }
            }
        });
    }

    private isAdmin(chatId: number): boolean {
        const adminIds = (process.env.BOT_ADMIN_ID || "")
            .split(",")
            .map(id => id.trim())
            .filter(id => /^\d+$/.test(id));
        return adminIds.includes(String(chatId));
    }

    private setupBot() {
        try {
            const aliasesPath = path.join(process.env.DATA_DIR!, 'aliases.json');
            if (fs.existsSync(aliasesPath)) {
                const raw = fs.readFileSync(aliasesPath, 'utf-8');
                this.ipAliases = JSON.parse(raw);
                console.log(`Loaded ${Object.keys(this.ipAliases).length} IP aliases from ${aliasesPath}`);
            } else {
                console.log(`No aliases.json found at ${aliasesPath}, starting with empty aliases.`);
            }
        } catch (err) {
            console.error('Failed to load aliases.json:', err);
            this.ipAliases = {};
        }

        const commands = [
            { command: 'help', description: 'Show help message' },
            { command: 'whoami', description: 'Get your chat ID and admin status' },
            { command: 'getid', description: 'Get your chat ID and admin status' },
            { command: 'last', description: 'Show the last messages in the specified mode' },
            { command: 'reportbanned', description: '[admin] Show or hide banned clients when they try to connect' },
            { command: 'alias', description: '[admin] Alias CIDR (IP/Net Address) to name' }
        ];
        this.bot.telegram.setMyCommands(commands);

        // Middleware to log processing time and message details
        this.bot.use(async (ctx, next) => {
            const debug = _debug('bot:Profiler');
            const start = Date.now();
            await next();
            const end = Date.now();
            debug(`Processing message ${ctx.update.update_id} took ${(end - start)} ms, Message details:`, {ctx: ctx.update, chatId: ctx.message?.chat.id, from: ctx.message?.from});
        });

        this.bot.start(async (ctx) => {
            await ctx.reply(`Type /help to see available commands.`);
        });

        this.bot.help(async (ctx) => {
            const helpMsg = commands.map(cmd => `/${cmd.command} - ${cmd.description}`).join('\n');
            await ctx.reply(helpMsg);
        });

        this.bot.command('alias', async (ctx) => {
            if (!this.isAdmin(ctx.message.chat.id)) {
                await ctx.reply("You are not an admin, this command is restricted.");
                return;
            }

            // Expecting: /alias <add|del> <name> <CIDR>
            const args = ctx.args || [];
            if (args.length === 0) {
                if (Object.keys(this.ipAliases).length === 0) {
                    await ctx.reply("No IP aliases are currently set.");
                } else {
                    const aliasList = Object.entries(this.ipAliases)
                        .map(([name, cidrs]) => `${name}: ${cidrs.join(', ')}`)
                        .join('\n');
                    await ctx.reply(`Current IP aliases:\n${aliasList}`);
                }
                return;
            }

            if (args.length < 3) {
                await ctx.reply("Usage: /alias <add|del> <name> <CIDR>");
                return;
            }

            const [action, name, cidr] = args;

            if (!["add", "del"].includes(action)) {
                await ctx.reply("First argument must be 'add' or 'del'.\nUsage: /alias <add|del> <name> <CIDR>");
                return;
            }

            if (!name || !cidr) {
                await ctx.reply("Usage: /alias <add|del> <name> <CIDR>");
                return;
            }

            if (action === "add") {
                if (!this.ipAliases[name]) {
                    this.ipAliases[name] = [];
                }
                if (!this.ipAliases[name].includes(cidr)) {
                    this.ipAliases[name].push(cidr);
                    await ctx.reply(`Alias added: ${name} -> ${cidr}`);
                } else {
                    await ctx.reply(`Alias already exists: ${name} -> ${cidr}`);
                }
            } else if (action === "del") {
                if (this.ipAliases[name]) {
                    const idx = this.ipAliases[name].indexOf(cidr);
                    if (idx !== -1) {
                        this.ipAliases[name].splice(idx, 1);
                        // Remove alias if empty
                        if (this.ipAliases[name].length === 0) {
                            delete this.ipAliases[name];
                        }
                        await ctx.reply(`Alias removed: ${name} -> ${cidr}`);
                    } else {
                        await ctx.reply(`Alias not found: ${name} -> ${cidr}`);
                    }
                } else {
                    await ctx.reply(`Alias name not found: ${name}`);
                }
            }

            // Save to file after any change
            try {
                const aliasesPath = path.join(process.env.DATA_DIR!, 'aliases.json');
                fs.writeFileSync(aliasesPath, JSON.stringify(this.ipAliases, null, 2), 'utf-8');
            } catch (err) {
                console.error('Failed to save aliases.json:', err);
            }
        });

        this.bot.command('reportbanned', async (ctx) => {
            if (!this.isAdmin(ctx.message.chat.id)) {
                await ctx.reply("You are not an admin, this command is restricted.");
                return;
            }
            const arg = (ctx.args && ctx.args[0]) ? ctx.args[0].toLowerCase() : undefined;
            if (!arg) {
                await ctx.reply(`Show banned is currently ${this.showBanned ? 'ON' : 'OFF'}.\nUsage: /showbanned <on|off>`);
                return;
            }
            if (arg !== 'on' && arg !== 'off') {
                await ctx.reply('Usage: /showbanned <on|off>');
                return;
            }
            this.showBanned = arg === 'on';
            await ctx.reply(`Show banned is now ${this.showBanned ? 'ON' : 'OFF'}.`);
        });

        const handleGetId = async (ctx: any) => {
            await ctx.reply(`Your chat ID is: ${ctx.message.chat.id} (Admin: ${this.isAdmin(ctx.message.chat.id) ? "Yes" : "No"})`);
        };
        this.bot.command('getid', handleGetId);
        this.bot.command('whoami', handleGetId);

        this.bot.command('last', async (ctx) => {
            if (ctx.args.length === 0) {
                await ctx.replyWithMarkdownV2(
                    `Use \\/last \\<_mode_\\> \\[_how many_\\] to see the last messages\\.\nAvailable modes: *${Object.keys(this.ringBuffers).map(v2).join("*\\, *")}*`
                );
                return;
            }
            if (!this.ringBuffers[ctx.args[0].toUpperCase()]) {
                await ctx.replyWithMarkdownV2(
                    `Mode *${v2(ctx.args[0])}* not found\\.\nAvailable modes: *${Object.keys(this.ringBuffers).map(v2).join("*\\, *")}*`
                );
                return;
            }
            const mode = ctx.args[0].toUpperCase();
            const howMany = parseInt(ctx.args[1] || "10");
            const lastBuf = this.ringBuffers[mode];

            if (lastBuf.length === 0) {
                await ctx.replyWithMarkdownV2(`No messages found in mode *${v2(mode)}*\\.`);
                return;
            }

            const msgs = lastBuf.slice(-howMany).reverse();

            let reply = formatLastMessages(msgs, mode);

            // Telegram message max length is 4096 chars, split if needed
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

        this.bot.on(message('text'), async (ctx) => {
            if ('entities' in ctx.update.message && Array.isArray(ctx.update.message.entities) && ctx.update.message.entities[0]?.type === "bot_command") return;
            await ctx.telegram.sendMessage(ctx.message.chat.id, `Hello ${ctx.message.from.first_name}, your Chat ID is: ${ctx.message.chat.id} (Admin: ${this.isAdmin(ctx.message.chat.id) ? "Yes" : "No"}).\nType /help to see available commands.`);
        });
    }

    public start() {
        console.log(`Starting Telegram Bot...`);
        this.bot.launch();

        process.on("SIGINT", () => this.terminate());
        process.on("SIGTERM", () => this.terminate());
    }

    private terminate() {
        console.log("Terminating...");
        this.bot.stop('Terminating...');
        this.mqtt.end();
        process.exit();
    }
}

export default OpenWebRXBot;
