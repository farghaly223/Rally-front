import React, { useCallback } from 'react';
import { api, type AuditLogRow } from '../../api/client';
import { PaginatedTable, cellClass } from './PaginatedTable';

export const AuditLog: React.FC = () => {
  const load = useCallback(
    (page: number, pageSize: number) => api.admin.listAuditLogs({ page, pageSize }),
    [],
  );

  return (
    <PaginatedTable<AuditLogRow>
      title="Audit Log"
      description="Every privileged action, in the order it happened."
      columns={['Action', 'Actor', 'Target', 'IP', 'When']}
      load={load}
      rowKey={(row) => row.id}
      emptyMessage="No audited actions yet."
      renderRow={(row) => (
        <>
          <td className={`${cellClass} font-label-caps text-xs font-bold text-indigo-300`}>
            {row.action}
          </td>
          <td className={cellClass}>{row.actor?.fullName ?? row.actorId ?? 'system'}</td>
          <td className={`${cellClass} max-w-[200px] truncate`} title={row.targetId ?? undefined}>
            {row.targetId ?? '—'}
          </td>
          <td className={cellClass}>{row.ipAddress ?? '—'}</td>
          <td className={cellClass}>{new Date(row.createdAt).toLocaleString()}</td>
        </>
      )}
    />
  );
};
