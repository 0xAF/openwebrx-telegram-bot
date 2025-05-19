import { timeStampToString, footToKilometer, knotsToKmh, degreesToCompass, v2 } from './utils';

/**
 * Returns a MarkdownV2 string with the last messages for the given mode.
 * @param msgs Array of decoder messages (already sliced/reversed)
 * @param mode Decoder mode (e.g. FT8, FT4, ADSB, AIS, APRS, VDL2, etc.)
 */
export function formatLastMessages(
    msgs: any[],
    mode: string
): string {
    let reply = `Last messages in mode *${v2(mode)}*\\:\n`;

    for (const msg of msgs) {
        reply += '\n▶ ';
        switch (mode) {
            case "FT8":
            case "FT4":
                reply += `__${v2(timeStampToString(msg?.timestamp))}__ ` +
                    `\\(${v2((msg?.freq / 1000 / 1000).toFixed(3))} _MHz_\\) ` +
                    `*[${v2(msg?.callsign)}](https://qrz.com/db/${msg?.callsign})* ` +
                    `\\[_QTH_\\: ${v2(msg?.locator)}, ${v2(msg?.country)}\\]\\: ${v2(msg?.msg)}`;
                break;
            case "ADSB":
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
                break;
            case "AIS":
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
                break;
            case "APRS":
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
                break;
            case "VDL2":
                const vdl2 = msg?.data?.vdl2;
                if (vdl2) {
                    const freqMHz = vdl2.freq ? (vdl2.freq / 1e6).toFixed(3) : undefined;
                    reply += `__${v2(timeStampToString(msg?.timestamp))}__`;
                    if (freqMHz) reply += ` \\(${v2(freqMHz)} _MHz_\\)`;
                    if (msg?.icao) reply += ` *[${v2(msg.icao)}](https://www.planespotters.net/hex/${msg.icao})*`;
                    if (msg?.country) reply += ` \\[${v2(msg.country)}\\]`;
                    if (msg?.type) reply += ` \\(${v2(msg.type)}\\)`;
                    if (vdl2.avlc) {
                        const avlc = vdl2.avlc;
                        if (avlc.src?.addr) reply += ` SRC: *[${v2(avlc.src.addr)}](https://www.planespotters.net/hex/${avlc.src.addr})*`;
                        if (avlc.src?.type) reply += ` \\(${v2(avlc.src.type)}\\)`;
                        if (avlc.dst?.addr) reply += ` → DST: *[${v2(avlc.dst.addr)}](https://www.planespotters.net/hex/${avlc.dst.addr})*`;
                        if (avlc.dst?.type) reply += ` \\(${v2(avlc.dst.type)}\\)`;
                        if (avlc.x25?.pkt_type_name) reply += ` \\[${v2(avlc.x25.pkt_type_name)}\\]`;
                        if (avlc.x25?.clnp?.pdu_id !== undefined) reply += ` PDU: ${v2(avlc.x25.clnp.pdu_id)}`;
                    }
                    if (msg?.lat && msg?.lon) {
                        reply += `[Map](https://www.openstreetmap.org/?mlat=${msg.lat}&mlon=${msg.lon}) `;
                    }
                } else {
                    reply += v2(JSON.stringify(msg));
                }
                break;
            default:
                if (msg?.timestamp) reply += `__${v2(timeStampToString(msg?.timestamp))}__\\: `;
                if (msg?.freq) reply += `Freq: *${v2((msg.freq / 1e6).toFixed(3))}* _MHz_`;
                for (const [key, value] of Object.entries(msg)) {
                    if (key === "timestamp" || key === 'freq') continue;
                    reply += `, *${v2(key)}*: ${v2(typeof value === "object" ? JSON.stringify(value) : String(value))}`;
                }
        }
    }

    return reply;
}