import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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
}
