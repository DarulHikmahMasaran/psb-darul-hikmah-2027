import { createClient } from '@supabase/supabase-js';

const CUSTOM_URL_KEY = 'psb_custom_supabase_url';
const CUSTOM_ANON_KEY = 'psb_custom_supabase_anon_key';
const CUSTOM_GAS_URL_KEY = 'psb_custom_gas_webhook_url';

function safeGetLocal(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSetLocal(key: string, val: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (val) window.localStorage.setItem(key, val);
    else window.localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
}

const envUrl = '';
const envKey = '';

export const getSupabaseUrl = (): string => safeGetLocal(CUSTOM_URL_KEY) || envUrl;
export const getSupabaseAnonKey = (): string => safeGetLocal(CUSTOM_ANON_KEY) || envKey;
export const getGasWebhookUrl = (): string => safeGetLocal(CUSTOM_GAS_URL_KEY);

export const SUPABASE_URL = getSupabaseUrl();
export const SUPABASE_ANON_KEY = getSupabaseAnonKey();

export const saveRuntimeSupabaseConfig = (url: string, anonKey: string): void => {
  safeSetLocal(CUSTOM_URL_KEY, url.trim());
  safeSetLocal(CUSTOM_ANON_KEY, anonKey.trim());
};

export const clearRuntimeSupabaseConfig = (): void => {
  safeSetLocal(CUSTOM_URL_KEY, '');
  safeSetLocal(CUSTOM_ANON_KEY, '');
};

export const saveGasWebhookUrl = (url: string): void => {
  safeSetLocal(CUSTOM_GAS_URL_KEY, url.trim());
};

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(
    url &&
    url.startsWith('https://') &&
    !url.includes('your-project') &&
    key &&
    key.length > 20 &&
    !key.includes('your-anon-public-key')
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isDemoSessionActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem('psb_active_session_user');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.isDemoMode);
  } catch {
    return false;
  }
};
