import React, { useCallback } from 'react';
import { api, type RegistrationRow } from '../../api/client';
import { PaginatedTable, cellClass } from './PaginatedTable';
import { formatEventDateTime } from '../../types';

export const RegistrationManager: React.FC = () => {
  const load = useCallback(
    (page: number, pageSize: number) => api.admin.listRegistrations({ page, pageSize }),
    [],
  );

  return (
    <PaginatedTable<RegistrationRow>
      title="Registrations"
      description="Who signed up for which screening."
      columns={['Member', 'Phone', 'Screening', 'Starts', 'Registered']}
      load={load}
      rowKey={(row) => row.id}
      emptyMessage="No registrations yet."
      renderRow={(row) => (
        <>
          <td className={`${cellClass} text-white font-medium`}>{row.user?.fullName ?? '—'}</td>
          <td className={cellClass}>{row.user?.phone ?? '—'}</td>
          <td className={cellClass}>{row.event?.movieName ?? row.eventId}</td>
          <td className={cellClass}>
            {row.event?.startsAt ? formatEventDateTime(row.event.startsAt) : '—'}
          </td>
          <td className={cellClass}>{new Date(row.createdAt).toLocaleString()}</td>
        </>
      )}
    />
  );
};
