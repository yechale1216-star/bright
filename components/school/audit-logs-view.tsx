'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { History, Search, RefreshCw, Shield, Clock, User, Filter, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/utils';

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  user_name?: string;
  user_role?: string;
  details?: any;
  created_at: string;
}

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('ALL');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/attendance/audit-logs');
      if (res.ok) {
        const json = await res.json();
        setLogs(Array.isArray(json.data) ? json.data : []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !search ||
        (log.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.action || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.entity_type || '').toLowerCase().includes(search.toLowerCase()) ||
        (log.user_role || '').toLowerCase().includes(search.toLowerCase());

      const matchesEntity =
        selectedEntity === 'ALL' ||
        log.entity_type?.toUpperCase() === selectedEntity.toUpperCase();

      return matchesSearch && matchesEntity;
    });
  }, [logs, search, selectedEntity]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              System Audit Logs
            </h1>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">
              Immutable forensic trail of administrative and teacher operations, approvals, and record modifications.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          className="rounded-xl gap-2 font-bold text-xs h-9"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
          Refresh Logs
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, role, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl bg-card text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'ATTENDANCE', 'ATTENDANCE_EDIT_REQUEST'].map((type) => (
            <Button
              key={type}
              size="sm"
              variant={selectedEntity === type ? 'default' : 'outline'}
              onClick={() => setSelectedEntity(type)}
              className="rounded-xl text-xs font-bold h-9 shrink-0"
            >
              {type === 'ALL' ? 'All Records' : type.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <Card className="rounded-2xl border-border">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              Loading forensic audit trail...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground">
              <Shield className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              No audit logs recorded for the selected filter.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-black tracking-wider">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Context Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-foreground">{log.user_name || 'System User'}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{log.user_role || 'staff'}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge
                        className={cn(
                          'text-[10px] font-black uppercase tracking-wider',
                          log.action?.includes('APPROVE')
                            ? 'bg-emerald-600 text-white'
                            : log.action?.includes('REJECT')
                            ? 'bg-rose-600 text-white'
                            : log.action?.includes('DELETE')
                            ? 'bg-amber-600 text-white'
                            : 'bg-primary/20 text-primary border border-primary/30'
                        )}
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium text-foreground">
                      {log.entity_type}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-md truncate font-mono text-[11px]">
                      {log.details ? JSON.stringify(log.details) : `ID: ${log.entity_id}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
