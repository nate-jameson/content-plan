'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';

function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return trimmed;
}

interface WriterActionsProps {
  writer: {
    id: string;
    name: string;
    email: string | null;
    driveFolderId: string;
  };
}

export function WriterActions({ writer }: WriterActionsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: (formData.get('email') as string) || undefined,
      driveFolderId: extractDriveFolderId(formData.get('driveFolderId') as string),
    };

    try {
      const res = await fetch(`/api/writers/${writer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update writer');
      }

      setIsEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/writers/${writer.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to delete writer');
      }
      setIsDeleting(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Edit modal
  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-200">Edit Writer</h3>
            <button onClick={() => { setIsEditing(false); setError(null); }} className="text-slate-400 hover:text-slate-200">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Name</label>
              <input
                name="name"
                required
                defaultValue={writer.name}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Email (optional)</label>
              <input
                name="email"
                type="email"
                defaultValue={writer.email || ''}
                placeholder="jane@example.com"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Google Drive Folder (ID or URL)</label>
              <input
                name="driveFolderId"
                required
                defaultValue={writer.driveFolderId}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            {error && <div className="text-sm text-red-300">{error}</div>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); setError(null); }}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Delete confirmation
  if (isDeleting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <h3 className="mb-2 text-base font-semibold text-slate-200">Delete Writer</h3>
          <p className="mb-4 text-sm text-slate-400">
            Are you sure you want to delete <strong className="text-slate-200">{writer.name}</strong>?
            This will also remove all their articles and scan results.
          </p>
          {error && <div className="mb-4 text-sm text-red-300">{error}</div>}
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              {loading ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => { setIsDeleting(false); setError(null); }}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => setIsEditing(true)}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-teal-400"
        title="Edit writer"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setIsDeleting(true)}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-red-400"
        title="Delete writer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
