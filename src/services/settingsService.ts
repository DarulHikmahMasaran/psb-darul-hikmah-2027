import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { getStorageData, saveStorageData } from '../lib/storage';
import { SystemSetting } from '../types/database';
import { auditService } from './auditService';

export const settingsService = {
  async getSettings(): Promise<Record<string, string>> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('system_settings').select('*');
        if (!error && data && data.length > 0) {
          const map: Record<string, string> = {};
          const localData = getStorageData();
          data.forEach((s: SystemSetting) => {
            map[s.key] = s.value;
            const ex = localData.settings.find((item) => item.key === s.key);
            if (ex) {
              ex.value = s.value;
              ex.updated_at = s.updated_at || new Date().toISOString();
            } else {
              localData.settings.push(s);
            }
          });
          saveStorageData(localData);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("psb-settings-updated"));
          }
          return map;
        }
      } catch (err) {
        console.error('Failed to fetch system_settings from Supabase', err);
      }
    }

    const data = getStorageData();
    const map: Record<string, string> = {};
    data.settings.forEach((s) => {
      map[s.key] = s.value;
    });
    return map;
  },

  async getAllSettingsList(): Promise<SystemSetting[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('system_settings').select('*');
        if (!error && data) return data as SystemSetting[];
      } catch (err) {
        console.error('Failed to fetch system_settings list from Supabase', err);
      }
    }

    const data = getStorageData();
    return data.settings;
  },

  async updateSetting(
    key: string,
    value: string,
    userId?: string,
    userEmail?: string,
    userRole?: string
  ): Promise<boolean> {
    if (userRole && userRole !== 'SUPER_ADMIN') {
      throw new Error('Akses Ditolak (403): Hanya SUPER_ADMIN yang berwenang mengubah konfigurasi sistem.');
    }
    const data = getStorageData();
    const existing = data.settings.find((s) => s.key === key);
    const oldValue = existing ? existing.value : null;

    if (existing) {
      existing.value = value;
      existing.updated_at = new Date().toISOString();
    } else {
      data.settings.push({
        id: `set-${Date.now()}`,
        key,
        value,
        updated_at: new Date().toISOString(),
      });
    }
    saveStorageData(data);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("psb-settings-updated"));
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('system_settings')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      } catch (err) {
        console.error('Failed to update system_setting in Supabase', err);
      }
    }

    await auditService.logAction({
      userId,
      userEmail,
      action: 'UPDATE_SYSTEM_SETTING',
      entityType: 'SETTING',
      entityId: key,
      oldValue: { value: oldValue },
      newValue: { value },
    });

    return true;
  },
};
