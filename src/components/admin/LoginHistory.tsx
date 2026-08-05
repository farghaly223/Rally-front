import React, { useCallback } from 'react';
import { api, type LoginHistoryRow } from '../../api/client';
import { PaginatedTable, cellClass } from './PaginatedTable';

export const LoginHistory: React.FC = () => {
  const load = useCallback(
    (page: number, pageSize: number) => api.admin.listLoginHistory({ page, pageSize }),
    [],
  );

  return (
    <PaginatedTable<LoginHistoryRow>
      title="Login History"
      description="Successful and failed sign-in attempts."
      columns={['Member', 'Phone', 'Result', 'IP', 'Device', 'When']}
      load={load}
      rowKey={(row) => row.id}
      emptyMessage="No sign-in attempts recorded."
      renderRow={(row) => (
        <>
          <td className={`${cellClass} text-white font-medium`}>{row.user?.fullName ?? '—'}</td>
          <td className={cellClass}>{row.phone ?? row.user?.phone ?? '—'}</td>
          <td
            className={`${cellClass} font-bold ${row.success ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {row.success ? 'Success' : 'Failed'}
          </td>
          <td className={cellClass}>{row.ipAddress ?? '—'}</td>
          <td className={`${cellClass} max-w-[220px] truncate`} title={row.userAgent ?? undefined}>
            {row.userAgent ?? '—'}
          </td>
          <td className={cellClass}>{new Date(row.createdAt).toLocaleString()}</td>
        </>
      )}
    />
  );
};
