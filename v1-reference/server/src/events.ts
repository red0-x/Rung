import type { DialClient } from './dial.js';
import type { Store } from './store/types.js';
import type { QueueItem } from './types.js';

export interface DialEvent {
  id: string;
  type: string;
  createdAt?: string;
  relatedObject?: { id: string; type: string; url: string | null } | null;
  data?: Record<string, unknown>;
}

interface Deps {
  store: Store;
  dial: DialClient;
  now: () => number;
  log: (msg: string) => void;
}

const SLACK_MS = 60_000;

/**
 * Mid-call tool requests carry the caller's number but not the call id, so the
 * queue item can only be tied to a call afterwards: by number, and by the item
 * having been created while that call was live.
 */
async function itemForCall(
  store: Store,
  phone: string,
  windowStart: number,
  windowEnd: number,
): Promise<QueueItem | undefined> {
  const item = await store.latestQueueItemForPhone(phone);
  if (!item) return undefined;
  if (item.createdAt < windowStart - SLACK_MS || item.createdAt > windowEnd + SLACK_MS) return undefined;
  return item;
}

export async function handleDialEvent(evt: DialEvent, deps: Deps): Promise<void> {
  const { store, dial, now, log } = deps;
  const d = (evt.data ?? {}) as Record<string, unknown>;

  if (evt.type === 'call.ended') {
    const callId = typeof d.callId === 'string' ? d.callId : undefined;
    const from = typeof d.from === 'string' ? d.from : undefined;
    if (!callId || !from || d.direction === 'outbound') return;

    const endedAt = evt.createdAt ? Date.parse(evt.createdAt) || now() : now();
    const durationSec = typeof d.durationSeconds === 'number' ? d.durationSeconds : 0;
    const item = await itemForCall(store, from, endedAt - durationSec * 1000, endedAt);
    if (!item) {
      log(`call.ended ${callId}: no queue item for this caller (call ended before triage?)`);
      return;
    }
    await store.updateQueueItem(item.id, { callId, durationSeconds: durationSec });
    log(`call.ended ${callId}: linked to queue item ${item.id}`);
    return;
  }

  if (evt.type === 'call.transcribed') {
    const callId = typeof d.callId === 'string' ? d.callId : undefined;
    if (!callId) return;

    // The event only carries the call id. Everything else is on the call record.
    const call = await dial.getCall(callId);
    let item = await store.findQueueItemByCallId(callId);
    if (!item && call.from) {
      const started = call.createdAt ? Date.parse(call.createdAt) : now() - 15 * 60_000;
      item = await itemForCall(store, call.from, started, now());
    }
    if (!item) {
      log(`call.transcribed ${callId}: no matching queue item`);
      return;
    }

    const patch: Partial<QueueItem> = { callId };
    if (call.transcript) patch.transcript = call.transcript;
    if (call.transcriptTurns) patch.transcriptTurns = call.transcriptTurns;
    if (typeof call.duration === 'number') patch.durationSeconds = call.duration;
    await store.updateQueueItem(item.id, patch);
    log(`call.transcribed ${callId}: transcript attached to ${item.id}`);
    return;
  }

  // call.status_changed, message.received, webhook.ping, etc.: nothing to do yet.
}
