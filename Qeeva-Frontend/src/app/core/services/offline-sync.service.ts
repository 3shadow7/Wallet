import { Injectable, inject } from '@angular/core';
import { RemoteSyncService, SyncOp as RemoteSyncOp } from './remote-sync.service';
import { inject as injectFunc } from '@angular/core';
import { StorageEngineService } from '@core/storage/engine/storage-engine.service';
import { STORAGE_KEYS } from '@core/storage/engine/storage-keys';

export interface SyncOp {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface SyncFailure {
  id?: string;
  error?: string;
  [key: string]: unknown;
}

interface SyncBatchResult {
  success?: string[];
  failed?: SyncFailure[];
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private remoteSync = injectFunc(RemoteSyncService);
  private storage = inject(StorageEngineService);

  private loadQueue(): SyncOp[] {
    const queue = this.storage.readJson<SyncOp[]>(STORAGE_KEYS.syncQueue);
    return Array.isArray(queue) ? queue : [];
  }

  private saveQueue(queue: SyncOp[]) {
    this.storage.writeJson(STORAGE_KEYS.syncQueue, queue);
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
    this.storage.removeItem(STORAGE_KEYS.syncQueue);
  }

  /**
   * Flush queued operations to server in small batches.
   * - baseUrl and token are optional when RemoteSyncService is configured for environment
   */
  async flush(batchSize = 10, token?: string): Promise<{ processed: string[]; failed: SyncFailure[] }> {
    const queue = this.loadQueue();
    if (queue.length === 0) return { processed: [], failed: [] };

    const processed: string[] = [];
    const failed: SyncFailure[] = [];

    // Send in batches
    for (let i = 0; i < queue.length; i += batchSize) {
      const batch = queue.slice(i, i + batchSize);

      try {
        // adapt shape to RemoteSyncService.SyncOp
        const ops = batch.map(b => ({ id: b.id, type: b.type, payload: b.payload, timestamp: b.createdAt } as RemoteSyncOp));
        const res: SyncBatchResult = await this.remoteSync.postBatch(ops, token);
        // mark processed
        (res.success || []).forEach((id: string) => processed.push(id));
        (res.failed || []).forEach((f: SyncFailure) => failed.push(f));
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
