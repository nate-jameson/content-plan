'use client';

import { useState, useEffect } from 'react';
import { Settings, Database, Cloud, FolderOpen, Info, CheckCircle2, XCircle, UserPlus, Trash2, Users, Mail, Loader2 } from 'lucide-react';

interface AllowedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  addedAt: string;
}

interface ConnectionStatus {
  database: boolean;
  copyleaks: boolean;
  googleDrive: boolean;
  ses: boolean;
  missing?: {
    googleDrive?: string[];
    copyleaks?: string[];
  };
}

export default function SettingsPage() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchStatus();
  }, []);

  async function fetchUsers() {
    const res = await fetch('/api/allowed-users');
    if (res.ok) {
      setUsers(await res.json());
    }
    setLoading(false);
  }

  async function fetchStatus() {
    const res = await fetch('/api/settings/status');
    if (res.ok) {
      setStatus(await res.json());
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError('');

    const res = await fetch('/api/allowed-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName || null, role: newRole }),
    });

    if (res.ok) {
      setNewEmail('');
      setNewName('');
      setNewRole('editor');
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to add user');
    }
    setAdding(false);
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this user from the allowed list? They will lose access immediately.')) return;
    setRemovingId(id);

    const res = await fetch(`/api/allowed-users?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to remove user');
    }
    setRemovingId(null);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">System configuration, team access, and connection status</p>
      </div>

      {/* Team Access */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Users className="h-5 w-5 text-teal-400" />
          Team Access
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Only these email addresses can sign in via Magic Link.
        </p>

        {/* User list */}
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : users.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">No users added yet.</p>
        ) : (
          <div className="mb-6 overflow-hidden rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">Added</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-200">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-500" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{user.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user.role === 'admin'
                          ? 'bg-teal-500/10 text-teal-400'
                          : 'bg-slate-700 text-slate-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(user.addedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemove(user.id)}
                        disabled={removingId === user.id}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Remove access"
                      >
                        {removingId === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add user form */}
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="editor@jmsn.com"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="block text-xs font-medium text-slate-400 mb-1">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500"
            >
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !newEmail}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add User
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>

      {/* Connection Status */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Settings className="h-5 w-5 text-teal-400" />
          Connection Status
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard icon={Database} label="Database" connected={status?.database} />
          <StatusCard icon={Cloud} label="Copyleaks API" connected={status?.copyleaks} missing={status?.missing?.copyleaks} />
          <StatusCard icon={FolderOpen} label="Google Drive" connected={status?.googleDrive} missing={status?.missing?.googleDrive} />
          <StatusCard icon={Mail} label="AWS SES (Email)" connected={status?.ses} />
        </div>
      </div>

      {/* About */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Info className="h-5 w-5 text-teal-400" />
          About
        </h2>
        <div className="space-y-2 text-sm text-slate-400">
          <p><span className="text-slate-300">Version:</span> 1.1.0</p>
          <p><span className="text-slate-300">Stack:</span> Next.js 15, NextAuth, Prisma, Aurora PostgreSQL, AWS SES</p>
          <p><span className="text-slate-300">Auth:</span> Magic Link via AWS SES</p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, connected, missing }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  connected?: boolean;
  missing?: string[];
}) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-teal-400" />
        <span className="text-sm font-medium text-slate-200">{label}</span>
      </div>
      {connected === undefined ? (
        <p className="text-sm text-slate-500">Checking...</p>
      ) : connected ? (
        <p className="flex items-center gap-1 text-sm text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> Connected
        </p>
      ) : (
        <div>
          <p className="flex items-center gap-1 text-sm text-amber-400">
            <XCircle className="h-3.5 w-3.5" /> Not configured
          </p>
          {missing && missing.length > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              <p className="mb-1 text-slate-400">Missing env vars:</p>
              {missing.map((v) => (
                <code key={v} className="mr-1 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-amber-300/70">
                  {v}
                </code>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
