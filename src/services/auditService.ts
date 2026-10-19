import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { getStorageData, saveStorageData } from '../lib/storage';
import { AuditLog } from '../types/database';

export const auditService = {
  async logAction(params: {
    userId?: string;
    userEmail?: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: any;
    newValue?: any;
  }): Promise<void> {
    const logEntry: AuditLog = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
      user_id: params.userId,
      user_email: params.userEmail,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
      ip_address: 'Client / Applet',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      created_at: new Date().toISOString(),
    };

    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: params.userId,
          action: params.action,
          entity_type: params.entityType,
          entity_id: params.entityId,
          old_value: params.oldValue,
          new_value: params.newValue,
          user_agent: logEntry.user_agent,
        });
      } catch (err) {
        console.error('Failed to log to Supabase audit_logs', err);
      }
    }

    // Always keep in persistent storage for local verification and offline mode
    const data = getStorageData();
    data.auditLogs = [logEntry, ...data.auditLogs];
    saveStorageData(data);
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    if (!isDemoSessionActive() && isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data as AuditLog[];
        }
      } catch (err) {
        console.error('Failed to fetch audit logs from Supabase', err);
      }
    }

    const data = getStorageData();
    return data.auditLogs;
  },
};
