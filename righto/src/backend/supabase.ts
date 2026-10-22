// Supabase client for Best of You. Dormant until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set
// (see docs/BACKEND.md); the app keeps running on its local sample data without them.
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { encryptedStorage } from '../storage';

// Project "righto" · Oceania (Sydney, ap-southeast-2). The publishable key is designed to ship inside the app.
const DEFAULT_URL = 'https://nvszkfxbduokokihsbgx.supabase.co';
const DEFAULT_KEY = 'sb_publishable_Mgkvrv01NAB2mKy-REcdTQ_cqMTGXZU';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_URL;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

export const backendConfigured = () => /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 20;

let client: SupabaseClient | null = null;

/** The shared client. Auth tokens are kept in the same encrypted store as the rest of the app (key in the Keychain / Keystore). */
export function supabase(): SupabaseClient {
  if (!backendConfigured()) throw new Error('Best of You backend is not configured on this build.');
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: {
          getItem: (k) => encryptedStorage.getItem(k) as Promise<string | null>,
          setItem: (k, v) => encryptedStorage.setItem(k, v) as Promise<void>,
          removeItem: (k) => encryptedStorage.removeItem(k) as Promise<void>,
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce', // Google sign-in: the browser hands back a one-time code, exchanged here for the session
      },
      global: { headers: { 'x-righto-client': 'expo' } },
    });
  }
  return client;
}

// ---- Typed wrappers around the SQL functions in supabase/migrations ------------------------------------

export type InvitePreview = { display_name: string; title: string; practice: string; ahpra: string; expires_at: string };
export type PsychLinkRow = { link_id: string; psych_id: string; display_name: string; title: string; practice: string; ahpra: string; linked_at: string; home_prompt: boolean };
export type ClientRow = { client_id: string; display_name: string; linked_at: string; checkins_total: number; checkins_done: number; last_checkin: string | null; next_session: string | null };

export const api = {
  /** Psychologist: a single-use invite code, valid for 48 hours. Shown once. */
  async createInvite() {
    const { data, error } = await supabase().rpc('righto_create_invite');
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string };
  },
  /** Client: who is behind this code, before linking. Null when the code is unknown, used or expired. */
  async previewInvite(code: string): Promise<InvitePreview | null> {
    const { data, error } = await supabase().rpc('righto_preview_invite', { p_code: code });
    if (error) throw error;
    return (Array.isArray(data) ? data[0] : data) ?? null;
  },
  /** Client: redeem the code and link. Returns the link id. */
  async redeemInvite(code: string): Promise<string> {
    const { data, error } = await supabase().rpc('righto_redeem_invite', { p_code: code });
    if (error) throw error;
    return data as string;
  },
  async endLink(linkId: string) {
    const { error } = await supabase().rpc('righto_end_link', { p_link: linkId });
    if (error) throw error;
  },
  async myPsychologist() {
    const { data, error } = await supabase().rpc('righto_my_psychologist');
    if (error) throw error;
    return ((Array.isArray(data) ? data[0] : data) ?? null) as PsychLinkRow | null;
  },
  async myClients(): Promise<ClientRow[]> {
    const { data, error } = await supabase().rpc('righto_my_clients');
    if (error) throw error;
    return (data ?? []) as ClientRow[];
  },
  /** Psychologist: the client's record, filtered to what they shared. Logged server-side on every call. */
  async clientRecord(clientId: string) {
    const { data, error } = await supabase().rpc('righto_client_record', { p_client: clientId });
    if (error) throw error;
    return data as Record<string, unknown>;
  },
  async logAccess(clientId: string, action: 'export_record' | 'end_link') {
    const { error } = await supabase().rpc('righto_log_access', { p_client: clientId, p_action: action });
    if (error) throw error;
  },
  async exportMe() {
    const { data, error } = await supabase().rpc('righto_export_me');
    if (error) throw error;
    return data as Record<string, unknown>;
  },
  async deleteMe() {
    const { error } = await supabase().rpc('righto_delete_me');
    if (error) throw error;
  },
};
