'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus } from 'lucide-react';

function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  // Match: https://drive.google.com/drive/folders/FOLDER_ID
  // Match: https://drive.google.com/drive/u/0/folders/FOLDER_ID
  // Match: https://drive.google.com/drive/folders/FOLDER_ID?...
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // If no URL pattern, assume it's already an ID
  return trimmed;
}

export function AddWriterForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string || undefined,
      driveFolderId: extractDriveFolderId(formData.get('driveFolderId') as string),
    };

    try {
      const res = await fetch('/api/writers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to add writer');
      }

      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-500"
      >
        <Plus className="h-4 w-4" />
        Add Writer
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
      <h3 className="mb-4 text-base font-semibold text-slate-200">Add New Writer</h3>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Name
          </label>
          <input
            name="name"
            required
            placeholder="Jane Smith"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Email (optional)
          </label>
          <input
            name="email"
            type="email"
            placeholder="jane@example.com"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Google Drive Folder (ID or URL)
          </label>
          <input
            name="driveFolderId"
            required
            placeholder="Paste folder URL or ID"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        {error && (
          <div className="col-span-full text-sm text-red-300">{error}</div>
        )}

        <div className="col-span-full flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
          >
            {loading ? 'Adding…' : 'Add Writer'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
