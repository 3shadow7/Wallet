import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  RemoteSyncService,
  SyncBatchConflict,
  SyncBatchFailure,
  SyncBatchResponse,
  SyncOp as RemoteSyncOp,
  SyncPayload,
} from './remote-sync.service';

const SYNC_QUEUE_KEY = 'offline_sync_queue_v1';
const SYNC_CONFLICTS_KEY = 'offline_sync_conflicts_v1';

type QueuePayload = SyncPayload & {
  client_id?: string;
  clientId?: string;
  expected_updated_at?: string;
  force?: boolean;
  id?: string | number;
  updated_at?: string;
};

export interface SyncOp {
  id: string;
  type: string;
  payload: QueuePayload;
  createdAt: string;
  resource?: string;
  clientId?: string;
}

export interface SyncConflict {
  opId: string;
  resource: string;
  type: string;
  reason: string;
  clientPayload: QueuePayload;
  serverPayload: Record<string, unknown> | QueuePayload;
  serverUpdatedAt?: string;
  expectedUpdatedAt?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private platformId = inject(PLATFORM_ID);
  private remoteSync = inject(RemoteSyncService);

  private loadQueue(): SyncOp[] {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load sync queue', e);
      return [];
    }
  }

  private saveQueue(queue: SyncOp[]) {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to persist sync queue', e);
    }
  }

  private loadConflicts(): SyncConflict[] {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(SYNC_CONFLICTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load sync conflicts', e);
      return [];
    }
  }

  private saveConflicts(conflicts: SyncConflict[]) {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(SYNC_CONFLICTS_KEY, JSON.stringify(conflicts));
    } catch (e) {
      console.error('Failed to persist sync conflicts', e);
    }
  }

  enqueue(op: Omit<SyncOp, 'createdAt'>) {
    const queue = this.loadQueue();
    const entry: SyncOp = { ...op, createdAt: new Date().toISOString() } as SyncOp;
    queue.push(entry);
    this.saveQueue(queue);
    return entry.id;
  }

  upsert(op: Omit<SyncOp, 'createdAt'>) {
    const queue = this.loadQueue();
    const entry: SyncOp = { ...op, createdAt: new Date().toISOString() } as SyncOp;
    const index = queue.findIndex((item) => this.isSameQueuedResource(item, entry));

    if (index >= 0) {
      queue[index] = entry;
    } else {
      queue.push(entry);
    }

    this.saveQueue(queue);
    return entry.id;
  }

  peek(): SyncOp | null {
    const queue = this.loadQueue();
    return queue.length > 0 ? queue[0] : null;
  }

  dequeue(): SyncOp | null {
    const queue = this.loadQueue();
    if (queue.length === 0) return null;
    const op = queue.shift() as SyncOp;
    this.saveQueue(queue);
    return op;
  }

  list(): SyncOp[] {
    return this.loadQueue();
  }

  listConflicts(): SyncConflict[] {
    return this.loadConflicts();
  }

  recordConflicts(conflicts: SyncConflict[]) {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    const existing = this.loadConflicts();
    const byId = new Map(existing.map(c => [c.opId, c]));
    for (const conflict of conflicts) {
      byId.set(conflict.opId, conflict);
    }
    this.saveConflicts(Array.from(byId.values()));
  }

  clearConflict(opId: string) {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    const remaining = this.loadConflicts().filter(c => c.opId !== opId);
    this.saveConflicts(remaining);
  }

  clear() {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    localStorage.removeItem(SYNC_QUEUE_KEY);
  }

  removeByClientId(clientId: string) {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    try {
      const queue = this.loadQueue();
      const filtered = queue.filter(q => {
        const payload = q.payload || {};
        return !(payload.client_id === clientId || payload.clientId === clientId || q.clientId === clientId);
      });
      this.saveQueue(filtered);
    } catch (e) {
      console.warn('Failed to remove queued ops for client id', clientId, e);
    }
  }

  replaceQueuedExpenseClientId(clientId: string, replacementId: string) {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;

    try {
      const queue = this.loadQueue();
      const updated = queue.map((item) => {
        const payload = item.payload || {};
        const matchesClientId = payload.client_id === clientId || payload.clientId === clientId || item.clientId === clientId;
        if (!matchesClientId) {
          return item;
        }

        return {
          ...item,
          clientId: replacementId,
          payload: {
            ...payload,
            client_id: replacementId,
            clientId: replacementId,
          },
        };
      });

      this.saveQueue(updated);
    } catch (e) {
      console.warn('Failed to remap queued client id', clientId, e);
    }
  }

  /**
   * Flush queued operations to server in small batches.
   * - baseUrl and token are optional when RemoteSyncService is configured for environment
   */
  async flush(batchSize = 10, token?: string): Promise<{ processed: string[]; failed: SyncBatchFailure[]; conflicts: SyncConflict[]; mapping: Record<string, unknown> }> {
    if (!isPlatformBrowser(this.platformId)) return { processed: [], failed: [], conflicts: [], mapping: {} };

    const queue = this.loadQueue();
    if (queue.length === 0) return { processed: [], failed: [], conflicts: [], mapping: {} };

    const processed: string[] = [];
    const failed: SyncBatchFailure[] = [];
    const conflicts: SyncConflict[] = [];
    const mapping: Record<string, unknown> = {};

    // Send in batches
    for (let i = 0; i < queue.length; i += batchSize) {
      const batch = queue.slice(i, i + batchSize);

      try {
        // adapt shape to RemoteSyncService.SyncOp (include resource/clientId if present)
        const ops: RemoteSyncOp[] = batch.map((b) => ({
          id: b.id,
          type: b.type,
          payload: b.payload,
          clientId: b.clientId,
          resource: b.resource,
          timestamp: b.createdAt,
        }));
        const res: SyncBatchResponse = await this.remoteSync.postBatch(ops, token);
        // mark processed
        (res.processed || []).forEach((id) => processed.push(id));
        (res.failed || []).forEach((failure) => failed.push(failure));
        Object.assign(mapping, res.mapping || {});

        // record conflicts so the UI can prompt for resolution
        (res.conflicts || []).forEach((c: SyncBatchConflict) => {
          const op = batch.find(b => b.id === c.op_id);
          const conflict: SyncConflict = {
            opId: c.op_id,
            resource: op?.resource || c.conflict?.resource || 'unknown',
            type: op?.type || 'update',
            reason: c.conflict?.reason || 'conflict',
            clientPayload: op?.payload ?? ({} as QueuePayload),
            serverPayload: c.conflict?.server_income || c.conflict?.server_payload || {},
            serverUpdatedAt: c.conflict?.server_updated_at,
            expectedUpdatedAt: c.conflict?.expected_updated_at,
            createdAt: new Date().toISOString()
          };
          conflicts.push(conflict);
        });

      } catch (e) {
        // network or server error — stop processing further and return
        console.error('Flush batch failed', e);
        failed.push({ batch: batch.map(b => b.id), error: String(e) });
        break;
      }
    }

    // Remove processed ops from queue
    if (conflicts.length > 0) {
      this.recordConflicts(conflicts);
    }
    const processedIds = new Set(processed.concat(conflicts.map(c => c.opId)));
    const remaining = queue.filter(q => !processedIds.has(q.id));
    this.saveQueue(remaining);

    return { processed, failed, conflicts, mapping };
  }

  private isSameQueuedResource(existing: SyncOp, candidate: SyncOp): boolean {
    if (existing.resource !== candidate.resource || existing.type !== candidate.type) {
      return false;
    }

    const existingPayload = existing.payload || {};
    const candidatePayload = candidate.payload || {};
    const existingClientId = existing.clientId || existingPayload.client_id || existingPayload.clientId || null;
    const candidateClientId = candidate.clientId || candidatePayload.client_id || candidatePayload.clientId || null;

    if (existingClientId && candidateClientId) {
      return existingClientId === candidateClientId;
    }

    return false;
  }
}
