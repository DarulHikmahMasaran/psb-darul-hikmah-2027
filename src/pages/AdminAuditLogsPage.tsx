import React, { useEffect, useState } from 'react';
import { auditService } from '../services/auditService';
import { AuditLog } from '../types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/Table';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/Loading';
import { EmptyState } from '../components/EmptyState';
import { formatDateTimeIndonesian } from '../utils/formatters';
import { Shield, Search, RefreshCw, Activity, Terminal } from 'lucide-react';

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadLogs = async () => {
    setIsLoading(true);
    const data = await auditService.getAuditLogs();
    setLogs(data);
    setFilteredLogs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredLogs(logs);
      return;
    }
    const q = search.toLowerCase();
    const result = logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        (l.user_email || '').toLowerCase().includes(q) ||
        l.entity_type.toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q)
    );
    setFilteredLogs(result);
  }, [search, logs]);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('REGISTER') || action.includes('INITIAL')) return 'success';
    if (action.includes('STATUS')) return 'purple';
    if (action.includes('UPDATE')) return 'warning';
    if (action.includes('LOGIN')) return 'info';
    return 'default';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-700" />
            Catatan Aktivitas Sistem (Audit Logs)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rekam jejak setiap perubahan penting, verifikasi status, pendaftaran, dan mutasi data santri
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={loadLogs}
        >
          Muat Ulang Log
        </Button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs max-w-md">
        <Input
          placeholder="Cari aksi, email pengguna, entitas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingSpinner text="Memuat riwayat audit logs..." />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="Tidak Ada Catatan Log"
            description="Belum ada aktivitas yang terekam atau cocok dengan pencarian."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Waktu (WIB)</TableHead>
                <TableHead>Aktivitas (Action)</TableHead>
                <TableHead>Pengguna / Operator</TableHead>
                <TableHead>Target Entitas</TableHead>
                <TableHead>Rincian Nilai / Mutasi (JSON)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <span className="text-xs font-mono text-slate-600">
                      {formatDateTimeIndonesian(log.created_at)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action)} size="sm">
                      {log.action}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs">
                      <div className="font-semibold text-slate-800">
                        {log.user_email || 'System / Auto'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.user_id ? log.user_id.slice(0, 14) + '...' : '-'}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="text-xs">
                      <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {log.entity_type}
                      </span>
                      {log.entity_id && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          ID: {log.entity_id}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="max-w-xs overflow-hidden">
                      <pre className="text-[10px] bg-slate-50 p-1.5 rounded border border-slate-200 font-mono text-slate-700 truncate max-h-16 overflow-y-auto">
                        {JSON.stringify(
                          {
                            old: log.old_value,
                            new: log.new_value,
                          },
                          null,
                          1
                        )}
                      </pre>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
