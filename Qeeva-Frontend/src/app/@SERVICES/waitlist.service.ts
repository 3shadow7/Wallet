import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';

export type WaitlistResult =
  | { ok: true }
  | { ok: false; reason: 'email_taken' | 'username_taken' | 'unknown' };

export interface WaitlistInput {
  username: string;
  email: string;
  source?: string | null;
}

@Injectable({ providedIn: 'root' })
export class WaitlistService {
  private client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    // No session storage: this page only inserts, and it must also work during prerender.
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  async join(input: WaitlistInput): Promise<WaitlistResult> {
    // No .select() on purpose: the public is allowed to insert but not read.
    const { error } = await this.client.from('waitlist').insert({
      username: input.username.trim(),
      email: input.email.trim().toLowerCase(),
      source: input.source ?? null,
    });

    if (!error) return { ok: true };

    if (error.code === '23505') {
      const msg = `${error.message} ${error.details ?? ''}`;
      if (msg.includes('waitlist_username_lower_idx')) return { ok: false, reason: 'username_taken' };
      if (msg.includes('waitlist_email_lower_idx')) return { ok: false, reason: 'email_taken' };
    }
    return { ok: false, reason: 'unknown' };
  }
}
