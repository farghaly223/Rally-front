import React, { useCallback, useEffect, useState } from 'react';
import {
  APIError,
  api,
  type AdminUserRow,
  type CreatableAdminRole,
} from '../../api/client';
import type { ApprovalStatus, Role } from '../../types';
import type { ToastKind } from '../ui/Toast';

interface AdminManagerProps {
  notify: (kind: ToastKind, text: string) => void;
}

const PAGE_SIZE = 20;

/**
 * The two roles this form may create.
 *
 * `SUPER_ADMIN` is absent on purpose and must stay absent: the API rejects it,
 * because "exactly one account, ever" cannot be guaranteed by an endpoint that
 * can mint more. The first one is seeded directly against the database.
 */
const CREATABLE_ROLES: { value: CreatableAdminRole; label: string; blurb: string }[] = [
  {
    value: 'EVENTS_ADMIN',
    label: 'Events Admin',
    blurb: 'Creates and edits screenings. Cannot see member applications.',
  },
  {
    value: 'VERIFICATION_ADMIN',
    label: 'Verification Admin',
    blurb: 'Approves and rejects members. Cannot touch screenings.',
  },
];

const ROLE_LABEL: Record<Role, string> = {
  USER: 'Member',
  EVENTS_ADMIN: 'Events Admin',
  VERIFICATION_ADMIN: 'Verification Admin',
  SUPER_ADMIN: 'Super Admin',
};

const statusColor: Record<ApprovalStatus, string> = {
  APPROVED: 'text-emerald-400',
  PENDING: 'text-amber-400',
  REJECTED: 'text-red-400',
  SUSPENDED: 'text-red-400',
  DELETED: 'text-zinc-500',
};

const inputClass = 'input-glass rounded-2xl px-4 py-3.5 w-full font-body-md text-sm';
const labelClass = 'font-label-caps text-xs font-bold uppercase tracking-wider text-zinc-400';
const cellClass = 'py-3 pr-4 font-body-md text-sm text-zinc-300 align-middle';

/**
 * Admin account management — the highest-privilege surface in the product.
 *
 * Two rules shape everything here:
 *
 *  - **Nothing is optimistic.** A row leaves the list only after the server says
 *    it did. Guessing would be worst exactly where it matters most: a refused
 *    revoke that had already blanked the row would read as success.
 *  - **The server's refusal is the message.** When a write would strand the
 *    system with no super admin the API answers 409 `LAST_SUPER_ADMIN`, and that
 *    text is shown verbatim rather than replaced with a generic failure — the
 *    admin needs to understand *why*, or they will simply try again.
 */
export const AdminManager: React.FC<AdminManagerProps> = ({ notify }) => {
  const [admins, setAdmins] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CreatableAdminRole>('EVENTS_ADMIN');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.admins.list({ page, pageSize: PAGE_SIZE });
      setAdmins(data.items);
      setTotal(data.total);
    } catch (err) {
      setAdmins([]);
      setTotal(0);
      setError(err instanceof APIError ? err.message : 'Failed to load admin accounts.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCreating(true);
      try {
        const created = await api.admin.admins.create({
          phone: phone.trim(),
          fullName: fullName.trim(),
          role,
        });
        setAdmins((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        setPhone('');
        setFullName('');
        notify('success', `${created.fullName} added as ${ROLE_LABEL[created.role]}.`);
      } catch (err) {
        const message = err instanceof APIError ? err.message : 'Could not create the admin.';
        setFormError(message);
        notify('error', message);
      } finally {
        setCreating(false);
      }
    },
    [fullName, notify, phone, role],
  );

  /** Replaces the row with whatever the server returned — never a local guess. */
  const applyServerRow = useCallback((saved: AdminUserRow) => {
    setAdmins((prev) => prev.map((row) => (row.id === saved.id ? saved : row)));
  }, []);

  const handleRoleChange = useCallback(
    async (admin: AdminUserRow, nextRole: CreatableAdminRole) => {
      setBusyId(admin.id);
      try {
        applyServerRow(await api.admin.admins.update(admin.id, { role: nextRole }));
        notify('success', `${admin.fullName} is now ${ROLE_LABEL[nextRole]}.`);
      } catch (err) {
        notify(
          'error',
          err instanceof APIError ? err.message : `Could not change ${admin.fullName}'s role.`,
        );
      } finally {
        setBusyId(null);
      }
    },
    [applyServerRow, notify],
  );

  const handleSuspendToggle = useCallback(
    async (admin: AdminUserRow) => {
      const next = admin.approvalStatus === 'SUSPENDED' ? 'APPROVED' : 'SUSPENDED';
      setBusyId(admin.id);
      try {
        applyServerRow(await api.admin.admins.update(admin.id, { approvalStatus: next }));
        notify(
          'success',
          `${admin.fullName} ${next === 'SUSPENDED' ? 'suspended' : 'reinstated'}.`,
        );
      } catch (err) {
        notify(
          'error',
          err instanceof APIError ? err.message : `Could not update ${admin.fullName}.`,
        );
      } finally {
        setBusyId(null);
      }
    },
    [applyServerRow, notify],
  );

  const handleRevoke = useCallback(
    async (admin: AdminUserRow) => {
      setBusyId(admin.id);
      try {
        applyServerRow(await api.admin.admins.revoke(admin.id));
        notify('success', `${admin.fullName} revoked.`);
      } catch (err) {
        notify(
          'error',
          err instanceof APIError ? err.message : `Could not revoke ${admin.fullName}.`,
        );
      } finally {
        setBusyId(null);
      }
    },
    [applyServerRow, notify],
  );

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <section className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <div className="mb-6 border-b border-zinc-800/80 pb-4">
          <h2 className="font-headline-md text-xl text-white">Appoint an Admin</h2>
          <p className="font-body-md mt-1 text-sm text-zinc-400">
            The account must already exist. Super Admin cannot be granted here — the API
            refuses it, so there is exactly one, seeded directly.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="font-body-md mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
          >
            {formError}
          </div>
        )}

        <form
          onSubmit={(e) => {
            void handleCreate(e);
          }}
          className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1fr_240px_auto] md:items-end"
        >
          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="am-name">
              Full Name
            </label>
            <input
              id="am-name"
              className={inputClass}
              type="text"
              required
              placeholder="Nour Hassan"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="am-phone">
              Phone
            </label>
            <input
              id="am-phone"
              className={inputClass}
              type="tel"
              required
              placeholder="+201234567890"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="am-role">
              Role
            </label>
            <select
              id="am-role"
              className={`${inputClass} cursor-pointer appearance-none`}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as CreatableAdminRole);
              }}
            >
              {CREATABLE_ROLES.map((option) => (
                <option key={option.value} className="bg-zinc-900" value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="btn-primary font-headline-md flex cursor-pointer items-center justify-center gap-2 rounded-full px-8 py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {creating ? 'Adding…' : 'Add Admin'}
            <span className="material-symbols-outlined text-base">person_add</span>
          </button>
        </form>

        <p className="font-body-md mt-4 text-xs text-zinc-500">
          {CREATABLE_ROLES.find((option) => option.value === role)?.blurb}
        </p>
      </section>

      <section className="bento-card rounded-[32px] border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
        <div className="mb-6 border-b border-zinc-800/80 pb-4">
          <h2 className="font-headline-md text-xl text-white">Admin Accounts</h2>
          <p className="font-body-md mt-1 text-sm text-zinc-400">
            The last Super Admin cannot be demoted, suspended, or revoked.
          </p>
        </div>

        {error && (
          <div className="font-body-md mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="font-body-md text-sm text-zinc-400">Loading admin accounts…</p>
        ) : admins.length === 0 ? (
          <p className="font-body-md text-sm text-zinc-400">No admin accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Name', 'Phone', 'Role', 'Status', 'Since', ''].map((column, i) => (
                    <th
                      key={column || `actions-${String(i)}`}
                      className="font-label-caps pb-3 pr-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isSuper = admin.role === 'SUPER_ADMIN';
                  const busy = busyId === admin.id;

                  return (
                    <tr key={admin.id} className="border-b border-zinc-800/60 last:border-0">
                      <td className={`${cellClass} font-medium text-white`}>
                        {admin.fullName}
                      </td>
                      <td className={cellClass}>{admin.phone}</td>
                      <td className={cellClass}>
                        {/* A super admin's role is fixed: there is no target role
                            the API would accept, so no control is offered. */}
                        {isSuper ? (
                          <span className="font-label-caps text-xs font-bold text-indigo-300">
                            {ROLE_LABEL.SUPER_ADMIN}
                          </span>
                        ) : (
                          <select
                            aria-label={`Role for ${admin.fullName}`}
                            value={admin.role}
                            disabled={busy}
                            onChange={(e) => {
                              void handleRoleChange(
                                admin,
                                e.target.value as CreatableAdminRole,
                              );
                            }}
                            className="cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500 disabled:opacity-40"
                          >
                            {CREATABLE_ROLES.map((option) => (
                              <option
                                key={option.value}
                                className="bg-zinc-900"
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td
                        className={`${cellClass} font-label-caps text-xs font-bold ${statusColor[admin.approvalStatus]}`}
                      >
                        {admin.approvalStatus}
                      </td>
                      <td className={cellClass}>
                        {new Date(admin.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 align-middle">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSuspendToggle(admin)}
                            disabled={busy}
                            className="font-label-caps cursor-pointer rounded-full border border-zinc-700 bg-zinc-900/80 px-3.5 py-2 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {admin.approvalStatus === 'SUSPENDED' ? 'Reinstate' : 'Suspend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(admin)}
                            disabled={busy || admin.approvalStatus === 'DELETED'}
                            className="font-label-caps cursor-pointer rounded-full border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-300 transition-all hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <span className="font-label-caps text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            {total} account{total === 1 ? '' : 's'} · page {page} of {lastPage}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
              }}
              disabled={page <= 1 || loading}
              className="font-label-caps cursor-pointer rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                setPage((p) => p + 1);
              }}
              disabled={page >= lastPage || loading}
              className="font-label-caps cursor-pointer rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
