import { v2 } from './utils';

/**
 * Formats an RX topic message for Telegram MarkdownV2.
 * @param data The RX message data object
 * @returns Formatted string for Telegram
 */
export function formatRxMessage(data: any): string {
    let msg = '';
    if (data?.state) {
        msg += `Device *${v2(data?.source)}* _${v2(data?.state)}_`;
    } else {
        msg += `_Profile on_ *${v2(data?.source)}*  ⇾  *${v2(data?.profile)}* \\(${v2((data?.freq / 1000 / 1000).toFixed(3))} MHz\\)`;
    }
    return msg;
}