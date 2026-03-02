'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function WriterToggle({
  writerId,
  isActive,
}: {
  writerId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/writers/${writerId}/toggle`, { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
        isActive ? 'bg-teal-600' : 'bg-slate-600'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
          isActive ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
