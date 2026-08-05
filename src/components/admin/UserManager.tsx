import React, { useCallback } from 'react';
import { api, type AdminUserRow } from '../../api/client';
import { PaginatedTable, cellClass } from './PaginatedTable';

const statusColor: Record<string, string> = {
  APPROVED: 'text-emerald-400',
  PENDING: 'text-amber-400',
  REJECTED: 'text-red-400',
  SUSPENDED: 'text-red-400',
  DELETED: 'text-zinc-500',
};

export const UserManager: React.FC = () => {
  const load = useCallback(
    (page: number, pageSize: number) => api.admin.listUsers({ page, pageSize }),
    [],
  );

  return (
    <PaginatedTable<AdminUserRow>
      title="Members"
      description="Every registered account, newest first."
      columns={['Name', 'Phone', 'Gender', 'Role', 'Status', 'Joined']}
      load={load}
      rowKey={(row) => row.id}
      emptyMessage="No members yet."
      renderRow={(row) => (
        <>
          <td className={`${cellClass} text-white font-medium`}>{row.fullName}</td>
          <td className={cellClass}>{row.phone}</td>
          <td className={cellClass}>{row.gender}</td>
          <td className={cellClass}>{row.role}</td>
          <td className={`${cellClass} font-bold ${statusColor[row.approvalStatus] ?? ''}`}>
            {row.approvalStatus}
          </td>
          <td className={cellClass}>{new Date(row.createdAt).toLocaleDateString()}</td>
        </>
      )}
    />
  );
};
