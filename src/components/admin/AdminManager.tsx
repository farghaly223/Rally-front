import React, { useCallback, useEffect, useState } from 'react';
import {
  APIError,
  api,
  type AdminUserRow,
  type CreatableAdminRole,
} from '../../api/client';
import type { ApprovalStatus, Gender, Role } from '../../types';
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

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  /**
   * The initial password for the new account.
   *
   * Lives in component state for the lifetime of the form and nowhere else: it
   * is cleared on success, never persisted, and never passed to `notify` — a
   * toast is rendered into the DOM and would be trivially screenshot-able over
   * someone's shoulder.
   */
  const [password, setPassword] = useState('');
  /** Local only. Prevents a typo becoming an account nobody can sign in to. */
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  /**
   * Deliberately starts empty rather than defaulting to a gender.
   *
   * Gender decides which events an account can see, so a default would silently
   * assign one to whoever forgot to touch this field. `required` on the control
   * makes the omission visible instead.
   */
  const [gender, setGender] = useState<Gender | ''>('');
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

      // The `required` attribute covers this in a browser; the guard is here
      // because an empty string is not a `Gender` and the API would reject it
      // with a less useful message.
      if (gender === '') {
        setFormError('Select a gender for the new admin.');
        return;
      }

      /*
       * Both password checks are convenience, not security.
       *
       * The server enforces the same 12-character minimum in
       * `createAdminSchema` and is the only thing that decides whether an
       * account is created. These run first so a typo is caught before a round
       * trip, and so the mismatch case — which the server cannot detect, since
       * it never sees the confirmation — is caught at all.
       */
      if (password !== confirmPassword) {
        setFormError('The two passwords do not match.');
        return;
      }

      if (password.length < 12) {
        setFormError('Password must be at least 12 characters.');
        return;
      }

      setCreating(true);
      try {
        const created = await api.admin.admins.create({
          email: email.trim().toLowerCase(),
          // Not trimmed. Leading and trailing spaces are legitimate password
          // characters, and silently stripping them here would produce a
          // credential that does not match what the person typed and was told.
          password,
          phone: phone.trim(),
          fullName: fullName.trim(),
          gender,
          role,
        });
        setAdmins((prev) => [created, ...prev]);
        setTotal((t) => t + 1);
        setEmail('');
        setPhone('');
        setFullName('');
        setGender('');
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        // The message names the admin and the role, never the password.
        notify('success', `${created.fullName} added as ${ROLE_LABEL[created.role]}.`);
      } catch (err) {
        const message = err instanceof APIError ? err.message : 'Could not create the admin.';
        setFormError(message);
        notify('error', message);
      } finally {
        setCreating(false);
      }
    },
    [confirmPassword, email, fullName, gender, notify, password, phone, role],
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
            This creates the account. The email and the password you set below are the
            credentials they sign in with — give them to the new admin directly, and have
            them change the password once they are in. Super Admin cannot be granted: the API
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
          className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
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
            <label className={labelClass} htmlFor="am-email">
              Email
            </label>
            <input
              id="am-email"
              className={inputClass}
              type="email"
              required
              autoComplete="off"
              placeholder="nour@rally.example"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
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

          {/*
            `autoComplete="new-password"` on both, so a browser offers to
            generate one rather than autofilling the *signed-in super admin's*
            own saved credential into the field that creates someone else's
            account — which is what `current-password` or an omitted attribute
            invites.
          */}
          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="am-password">
              Password
            </label>
            <div className="relative">
              <input
                id="am-password"
                className={`${inputClass} pr-12`}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={12}
                autoComplete="new-password"
                placeholder="At least 12 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setShowPassword((v) => !v);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <p className="font-body-md text-xs text-zinc-500">
              Share this with the new admin directly. Rally does not email it.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="am-password-confirm">
              Confirm Password
            </label>
            <input
              id="am-password-confirm"
              className={inputClass}
              type={showPassword ? 'text' : 'password'}
              required
              minLength={12}
              autoComplete="new-password"
              placeholder="Re-enter the password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
              }}
            />
            {confirmPassword.length > 0 && confirmPassword !== password && (
              <p className="font-body-md text-xs text-red-400">Passwords do not match.</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass} htmlFor="am-gender">
              Gender
            </label>
            <select
              id="am-gender"
              className={`${inputClass} cursor-pointer appearance-none`}
              required
              value={gender}
              onChange={(e) => {
                setGender(e.target.value as Gender | '');
              }}
            >
              <option className="bg-zinc-900" value="" disabled>
                Select…
              </option>
              <option className="bg-zinc-900" value="FEMALE">
                Female
              </option>
              <option className="bg-zinc-900" value="MALE">
                Male
              </option>
            </select>
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

          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="btn-primary font-headline-md flex w-full cursor-pointer items-center justify-center gap-2 rounded-full px-8 py-3.5 text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add Admin'}
              <span className="material-symbols-outlined text-base">person_add</span>
            </button>
          </div>
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
