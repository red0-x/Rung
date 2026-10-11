/** Plain ASCII only: non-GSM characters (em dashes, curly quotes, accents) cut carrier length limits. */
export function smsText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
}

/** "about 12 minutes", "about 2 hours". */
export function etaPhrase(minutes: number): string {
  if (minutes < 90) return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const h = Math.round(minutes / 6) / 10; // one decimal hour
  return `about ${h} hours`;
}

/** "3:42 PM PDT" in the org's timezone. Falls back to UTC for a bad zone name. */
export function clockTime(at: number, timeZone: string): string {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz }).format(at);
  try {
    return fmt(timeZone);
  } catch {
    return fmt('UTC');
  }
}

export interface ConfirmationInput {
  orgName: string;
  firstName?: string | null;
  etaMinutes: number;
  etaAt: number;
  position: number;
  timeZone: string;
}

/**
 * The confirmation text sent right after a call is queued. No account details or amounts:
 * a text sits on a lock screen. Says who, what happens, how long, and by what clock time.
 */
export function confirmationSms(i: ConfirmationInput): string {
  const hi = i.firstName ? `Hi ${i.firstName}, ` : '';
  return smsText(
    `${i.orgName}: ${hi}we have your request. A specialist will call you back on this number ` +
      `${etaPhrase(i.etaMinutes)} from now, around ${clockTime(i.etaAt, i.timeZone)}. ` +
      `You are #${i.position} in line. The time can shift if more urgent calls come in. Reply STOP to opt out.`,
  );
}
