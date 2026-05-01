import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { DeviceIdentityService } from './device-identity.service';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SyncPayload = Record<string, JsonValue>;

export interface SyncOp {
  id: string;
  type: string;
  payload: SyncPayload;
  clientId?: string;
  resource?: string;
  timestamp?: string;
}

export interface SyncBatchFailure {
  op_id?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SyncBatchConflictPayload {
  resource?: string;
  reason?: string;
  server_income?: SyncPayload;
  server_payload?: SyncPayload;
  server_updated_at?: string;
  expected_updated_at?: string;
}

export interface SyncBatchConflict {
  op_id: string;
  conflict?: SyncBatchConflictPayload;
  processed_at?: string;
}

export interface SyncBatchResponse {
  processed: string[];
  failed: SyncBatchFailure[];
  mapping: Record<string, unknown>;
  conflicts: SyncBatchConflict[];
}

@Injectable({ providedIn: 'root' })
export class RemoteSyncService {
  // Configure to your backend base URL (inject via environment or config)
  private baseUrl = '/api';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly authService = inject(AuthService);
  private readonly deviceIdentity = inject(DeviceIdentityService);

  constructor() {}

  async postBatch(ops: SyncOp[], token?: string): Promise<SyncBatchResponse> {
    const batchId = `batch-${Date.now()}`;
    // Map client-side shape to backend expected shape
    const payload = {
      ops: ops.map((o) => ({
        op_id: o.id,
        type: o.type,
        resource: o.resource,
        client_id: o.clientId,
        payload: o.payload,
      })),
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Device-ID': this.deviceIdentity.getDeviceId(),
      'Idempotency-Key': batchId,
    };

    const accessToken = token || this.getStoredAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await this.fetchWithAuthRetry(`${this.baseUrl}/finance/sync/ops/`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Sync batch failed: ${res.status} ${txt}`);
    }

    const json = await res.json();
    // Backend returns { results: [{op_id, status, result}, ...] }
    const processed: string[] = [];
    const failed: SyncBatchFailure[] = [];
    const mapping: Record<string, unknown> = {};
    const conflicts: SyncBatchConflict[] = [];

    (json.results || []).forEach((r: { op_id: string; status: string; result?: unknown; error?: string; conflict?: SyncBatchConflictPayload; processed_at?: string }) => {
      if (r.status === 'ok') {
        processed.push(r.op_id);
        if (r.result) mapping[r.op_id] = r.result;
      } else if (r.status === 'conflict') {
        processed.push(r.op_id);
        conflicts.push({ op_id: r.op_id, conflict: r.conflict, processed_at: r.processed_at });
      } else {
        failed.push({ op_id: r.op_id, error: String(r.error || r.result || 'unknown') });
      }
    });

    return { processed, failed, mapping, conflicts };
  }

  async postOp(op: SyncOp, token?: string): Promise<unknown> {
    const idempotency = op.id || `op-${Date.now()}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Device-ID': this.deviceIdentity.getDeviceId(),
      'Idempotency-Key': idempotency,
    };

    const accessToken = token || this.getStoredAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await this.fetchWithAuthRetry(`${this.baseUrl}/sync/op`, {
      method: 'POST',
      headers,
      body: JSON.stringify(op)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Sync op failed: ${res.status} ${txt}`);
    }

    return await res.json();
  }

  private getStoredAccessToken(): string | null {
    if (!isPlatformBrowser(this.platformId) || typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem('access_token');
  }

  private async fetchWithAuthRetry(url: string, init: RequestInit): Promise<Response> {
    const firstResponse = await fetch(url, init);
    if (firstResponse.status !== 401) {
      return firstResponse;
    }

    const newToken = await firstValueFrom(this.authService.refreshAccessToken());
    const retryHeaders = new Headers(init.headers || {});
    retryHeaders.set('Authorization', `Bearer ${newToken}`);

    return fetch(url, {
      ...init,
      headers: retryHeaders,
    });
  }
}
