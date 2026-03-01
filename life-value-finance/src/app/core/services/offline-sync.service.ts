import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RemoteSyncService, SyncOp as RemoteSyncOp } from './remote-sync.service';
import { inject as injectFunc } from '@angular/core';

const SYNC_QUEUE_KEY = 'offline_sync_queue_v1';

export interface SyncOp {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private platformId = inject(PLATFORM_ID);
  private remoteSync = injectFunc(RemoteSyncService);

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

  enqueue(op: Omit<SyncOp, 'createdAt'>) {
    const queue = this.loadQueue();
    const entry: SyncOp = { ...op, createdAt: new Date().toISOString() } as SyncOp;
    queue.push(entry);
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

  clear() {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') return;
    localStorage.removeItem(SYNC_QUEUE_KEY);
  }

  /**
   * Flush queued operations to server in small batches.
   * - baseUrl and token are optional when RemoteSyncService is configured for environment
   */
  async flush(batchSize = 10, token?: string): Promise<{ processed: string[]; failed: any[] }> {
    if (!isPlatformBrowser(this.platformId)) return { processed: [], failed: [] };

    const queue = this.loadQueue();
    if (queue.length === 0) return { processed: [], failed: [] };

    const processed: string[] = [];
    const failed: any[] = [];

    // Send in batches
    for (let i = 0; i < queue.length; i += batchSize) {
      const batch = queue.slice(i, i + batchSize);

      try {
        // adapt shape to RemoteSyncService.SyncOp
        const ops = batch.map(b => ({ id: b.id, type: b.type, payload: b.payload, timestamp: b.createdAt } as RemoteSyncOp));
        const res = await this.remoteSync.postBatch(ops, token);
        // mark processed
        (res.success || []).forEach((id: string) => processed.push(id));
        (res.failed || []).forEach((f: any) => failed.push(f));
      } catch (e) {
        // network or server error — stop processing further and return
        console.error('Flush batch failed', e);
        failed.push({ batch: batch.map(b => b.id), error: String(e) });
        break;
      }
    }

    // Remove processed ops from queue
    const remaining = queue.filter(q => !processed.includes(q.id));
    this.saveQueue(remaining);

    return { processed, failed };
  }
}
