import { escapers } from "@telegraf/entity";

/**
 * Escapes a string for Telegram MarkdownV2 formatting.
 */
export function v2(x: string | undefined | null): string {
    return x && x.length ? (escapers as any).MarkdownV2(x) : "";
}

/**
 * Converts a timestamp to a formatted string (YY-MM-DD HH:mm:ss).
 */
export function timeStampToString(ts: number): string {
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

/**
 * Converts feet to kilometers.
 * @param alt Altitude in feet or string
 * @returns Altitude in kilometers
 */
export function footToKilometer(alt: number | string): number {
    const numAlt = typeof alt === "string" ? parseFloat(alt) : alt;
    return numAlt * 0.0003048;
}

/**
 * Converts knots to kilometers per hour.
 * @param speed Speed in knots or string
 * @returns Speed in km/h
 */
export function knotsToKmh(speed: number | string): number {
    const numSpeed = typeof speed === "string" ? parseFloat(speed) : speed;
    return numSpeed * 1.852;
}

/**
 * Converts degrees to compass direction.
 * @param degrees Angle in degrees or string
 * @returns Compass direction as string
 */
export function degreesToCompass(degrees: number | string): string {
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
