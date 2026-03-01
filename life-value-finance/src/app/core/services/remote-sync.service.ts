import { Injectable } from '@angular/core';

export interface SyncOp {
  id: string;
  type: string;
  payload: any;
  clientId?: string;
  timestamp?: string;
}

@Injectable({ providedIn: 'root' })
export class RemoteSyncService {
  // Configure to your backend base URL (inject via environment or config)
  private baseUrl = '/api';

  constructor() {}

  async postBatch(ops: SyncOp[], token?: string): Promise<{ success: string[]; failed: any[] }> {
    const batchId = `batch-${Date.now()}`;
    const res = await fetch(`${this.baseUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Idempotency-Key': batchId
      },
      body: JSON.stringify({ operations: ops })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Sync batch failed: ${res.status} ${txt}`);
    }

    const json = await res.json();
    // Expected { processed: ['op-id', ...], failed: [{id, reason}] }
    return { success: json.processed || [], failed: json.failed || [] };
  }

  async postOp(op: SyncOp, token?: string): Promise<any> {
    const idempotency = op.id || `op-${Date.now()}`;
    const res = await fetch(`${this.baseUrl}/sync/op`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Idempotency-Key': idempotency
      },
      body: JSON.stringify(op)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Sync op failed: ${res.status} ${txt}`);
    }

    return await res.json();
  }
}
