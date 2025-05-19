import { v2 } from './utils';
import geoip from 'geoip-lite';

/**
 * Formats a CLIENT topic message for Telegram MarkdownV2.
 * @param data The client message data object
 * @returns Formatted string for Telegram
 */
export function formatClientMessage(data: any): string {
    let msg = '';
    const ip = data?.ip?.replace("::ffff:", "");
    const geo = ip ? geoip.lookup(ip) : undefined;

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
        if (geo.city) msg += `, ${v2(geo.city)}`;
        if (geo.country) msg += `, ${v2(geo.country)}`;
        if (geo.eu) msg += ` \\(EU\\)`;
    } else if (ip) {
        msg += `\n${v2(ip)}`;
    }

    return msg;
}