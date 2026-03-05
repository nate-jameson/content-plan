'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Plus,
  X,
  Trash2,
  Edit2,
  Globe,
  UserRound,
  Stethoscope,
  Ban,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────

interface Doctor {
  fullName: string;
  preferredFormat: string;
  role: string;
}

interface Service {
  serviceName: string;
  isOffered: boolean;
}

interface BannedPhrase {
  phrase: string;
  suggestedAlt: string;
  reason: string;
  severity: string;
}

interface StyleRule {
  rule: string;
  category: string;
}

interface Practice {
  id: string;
  name: string;
  titlePrefix: string;
  website: string | null;
  brandVoiceNotes: string | null;
  isActive: boolean;
  doctors: Doctor[];
  services: Service[];
  bannedPhrases: BannedPhrase[];
  styleRules: StyleRule[];
}

// ── Defaults ───────────────────────────────────────────────

const emptyDoctor = (): Doctor => ({ fullName: '', preferredFormat: '', role: 'Dentist' });
const emptyService = (): Service => ({ serviceName: '', isOffered: true });
const emptyBannedPhrase = (): BannedPhrase => ({ phrase: '', suggestedAlt: '', reason: '', severity: 'warning' });
const emptyStyleRule = (): StyleRule => ({ rule: '', category: 'general' });

const emptyForm = () => ({
  name: '',
  titlePrefix: '',
  website: '',
  brandVoiceNotes: '',
  doctors: [] as Doctor[],
  services: [] as Service[],
  bannedPhrases: [] as BannedPhrase[],
  styleRules: [] as StyleRule[],
});

// ── Main Page ──────────────────────────────────────────────

export default function PracticesPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchPractices = useCallback(async () => {
    try {
      const res = await fetch('/api/practices');
      if (res.ok) {
        const data = await res.json();
        setPractices(data);
      }
    } catch {
      console.error('Failed to fetch practices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPractices(); }, [fetchPractices]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setShowModal(true);
  }

  function openEdit(p: Practice) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      titlePrefix: p.titlePrefix,
      website: p.website || '',
      brandVoiceNotes: p.brandVoiceNotes || '',
      doctors: p.doctors.map((d) => ({ fullName: d.fullName, preferredFormat: d.preferredFormat, role: d.role || 'Dentist' })),
      services: p.services.map((s) => ({ serviceName: s.serviceName, isOffered: s.isOffered })),
      bannedPhrases: p.bannedPhrases.map((bp) => ({ phrase: bp.phrase, suggestedAlt: bp.suggestedAlt || '', reason: bp.reason || '', severity: bp.severity })),
      styleRules: p.styleRules.map((sr) => ({ rule: sr.rule, category: sr.category })),
    });
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.titlePrefix.trim()) {
      setError('Name and title prefix are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      ...form,
      doctors: form.doctors.filter((d) => d.fullName.trim()),
      services: form.services.filter((s) => s.serviceName.trim()),
      bannedPhrases: form.bannedPhrases.filter((bp) => bp.phrase.trim()),
      styleRules: form.styleRules.filter((sr) => sr.rule.trim()),
    };

    try {
      const url = editingId ? `/api/practices/${editingId}` : '/api/practices';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return;
      }
      setShowModal(false);
      fetchPractices();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its brand guide data? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/practices/${id}`, { method: 'DELETE' });
      if (res.ok) fetchPractices();
    } catch {
      console.error('Delete failed');
    }
  }

  // ── Dynamic list helpers ─────────────────────────────────

  function updateList<T>(key: keyof typeof form, index: number, field: keyof T, value: any) {
    setForm((prev) => {
      const list = [...(prev[key] as any[])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, [key]: list };
    });
  }

  function addToList(key: keyof typeof form, factory: () => any) {
    setForm((prev) => ({ ...prev, [key]: [...(prev[key] as any[]), factory()] }));
  }

  function removeFromList(key: keyof typeof form, index: number) {
    setForm((prev) => {
      const list = [...(prev[key] as any[])];
      list.splice(index, 1);
      return { ...prev, [key]: list };
    });
  }

  // ── Render ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-200">Practices</h1>
          <p className="text-sm text-slate-400">
            Manage dental practice brand guides — doctors, services, style rules &amp; banned phrases
          </p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Practice
        </button>
      </div>

      {/* Practice Cards */}
      {practices.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">No practices yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {practices.map((p) => {
            const isExpanded = expandedId === p.id;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-slate-700/50 bg-slate-800/60 shadow-sm"
              >
                {/* Card header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Building2 className="h-5 w-5 shrink-0 text-indigo-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-base font-semibold text-slate-200">{p.name}</span>
                        <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                          {p.titlePrefix} —
                        </span>
                      </div>
                      {p.website && (
                        <span className="text-xs text-slate-500 truncate block mt-0.5">{p.website}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge icon={UserRound} count={p.doctors.length} label="doctors" />
                    <Badge icon={Stethoscope} count={p.services.length} label="services" />
                    <Badge icon={Ban} count={p.bannedPhrases.length} label="banned" />
                    <Badge icon={BookOpen} count={p.styleRules.length} label="rules" />
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50 px-5 pb-5 pt-4 space-y-4">
                    {p.brandVoiceNotes && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Brand Voice</h4>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{p.brandVoiceNotes}</p>
                      </div>
                    )}

                    {p.doctors.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Doctors &amp; Team</h4>
                        <div className="flex flex-wrap gap-2">
                          {p.doctors.map((d, i) => (
                            <span key={i} className="rounded-md bg-slate-700/60 px-2.5 py-1 text-xs text-slate-300">
                              {d.preferredFormat}{d.role ? ` · ${d.role}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.services.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Services</h4>
                        <div className="flex flex-wrap gap-2">
                          {p.services.map((s, i) => (
                            <span
                              key={i}
                              className={`rounded-md px-2.5 py-1 text-xs ${
                                s.isOffered
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-red-500/20 text-red-300 line-through'
                              }`}
                            >
                              {s.serviceName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.bannedPhrases.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Banned Phrases</h4>
                        <div className="flex flex-wrap gap-2">
                          {p.bannedPhrases.map((bp, i) => (
                            <span
                              key={i}
                              className={`rounded-md px-2.5 py-1 text-xs ${
                                bp.severity === 'error'
                                  ? 'bg-red-500/20 text-red-300'
                                  : bp.severity === 'info'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-yellow-500/20 text-yellow-300'
                              }`}
                            >
                              &ldquo;{bp.phrase}&rdquo;{bp.suggestedAlt ? ` → "${bp.suggestedAlt}"` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.styleRules.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Style Rules</h4>
                        <ul className="list-disc list-inside space-y-0.5 text-sm text-slate-300">
                          {p.styleRules.map((sr, i) => (
                            <li key={i}>
                              {sr.rule}
                              <span className="ml-1.5 text-xs text-slate-500">({sr.category})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-10 pb-10">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-200">
                {editingId ? 'Edit Practice' : 'Add Practice'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-5 space-y-6">
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* Basic Info */}
              <Section title="Basic Info">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Practice Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Ada Smile Place" required />
                  <Input label="Title Prefix" value={form.titlePrefix} onChange={(v) => setForm((f) => ({ ...f, titlePrefix: v }))} placeholder="Ada Smile Place" required />
                </div>
                <Input label="Website URL" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} placeholder="https://adasmileplace.com" />
              </Section>

              {/* Brand Voice */}
              <Section title="Brand Voice">
                <label className="block text-xs font-medium text-slate-400 mb-1">Brand Voice Notes &amp; Guidelines</label>
                <textarea
                  value={form.brandVoiceNotes}
                  onChange={(e) => setForm((f) => ({ ...f, brandVoiceNotes: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Warm, friendly tone. Avoid clinical jargon. Emphasize patient comfort..."
                />
              </Section>

              {/* Doctors */}
              <Section
                title="Doctors & Team"
                onAdd={() => addToList('doctors', emptyDoctor)}
              >
                {form.doctors.map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                      <Input label="Full Name" value={d.fullName} onChange={(v) => updateList('doctors', i, 'fullName', v)} placeholder="Jane Smith, DDS" small />
                      <Input label="Preferred Format" value={d.preferredFormat} onChange={(v) => updateList('doctors', i, 'preferredFormat', v)} placeholder="Dr. Jane Smith, DDS" small />
                      <Select label="Role" value={d.role} onChange={(v) => updateList('doctors', i, 'role', v)} options={['Dentist', 'Hygienist', 'Office Manager', 'Other']} small />
                    </div>
                    <button onClick={() => removeFromList('doctors', i)} className="mt-5 text-slate-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </Section>

              {/* Services */}
              <Section
                title="Services"
                onAdd={() => addToList('services', emptyService)}
              >
                {form.services.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input label="Service Name" value={s.serviceName} onChange={(v) => updateList('services', i, 'serviceName', v)} placeholder="Invisalign" small />
                    </div>
                    <div className="pt-4 flex items-center gap-2">
                      <label className="text-xs text-slate-400">Offered</label>
                      <button
                        type="button"
                        onClick={() => updateList('services', i, 'isOffered', !s.isOffered)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          s.isOffered ? 'bg-green-600' : 'bg-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            s.isOffered ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    <button onClick={() => removeFromList('services', i)} className="mt-4 text-slate-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </Section>

              {/* Banned Phrases */}
              <Section
                title="Banned Phrases"
                onAdd={() => addToList('bannedPhrases', emptyBannedPhrase)}
              >
                {form.bannedPhrases.map((bp, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-4">
                      <Input label="Phrase" value={bp.phrase} onChange={(v) => updateList('bannedPhrases', i, 'phrase', v)} placeholder="cheap" small />
                      <Input label="Suggested Alternative" value={bp.suggestedAlt} onChange={(v) => updateList('bannedPhrases', i, 'suggestedAlt', v)} placeholder="affordable" small />
                      <Input label="Reason" value={bp.reason} onChange={(v) => updateList('bannedPhrases', i, 'reason', v)} placeholder="Undermines brand" small />
                      <Select label="Severity" value={bp.severity} onChange={(v) => updateList('bannedPhrases', i, 'severity', v)} options={['error', 'warning', 'info']} small />
                    </div>
                    <button onClick={() => removeFromList('bannedPhrases', i)} className="mt-5 text-slate-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </Section>

              {/* Style Rules */}
              <Section
                title="Style Rules"
                onAdd={() => addToList('styleRules', emptyStyleRule)}
              >
                {form.styleRules.map((sr, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <Input label="Rule" value={sr.rule} onChange={(v) => updateList('styleRules', i, 'rule', v)} placeholder="Always capitalize 'Invisalign'" small />
                      </div>
                      <Select label="Category" value={sr.category} onChange={(v) => updateList('styleRules', i, 'category', v)} options={['capitalization', 'terminology', 'tone', 'formatting', 'other']} small />
                    </div>
                    <button onClick={() => removeFromList('styleRules', i)} className="mt-5 text-slate-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </Section>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-700 px-6 py-4">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Update Practice' : 'Create Practice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable Components ────────────────────────────────────

function Badge({ icon: Icon, count, label }: { icon: any; count: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-700/50 px-2 py-1 text-xs text-slate-400" title={`${count} ${label}`}>
      <Icon className="h-3 w-3" />
      {count}
    </span>
  );
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  small,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <label className={`block font-medium text-slate-400 mb-1 ${small ? 'text-[11px]' : 'text-xs'}`}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-slate-700/50 bg-slate-800 px-3 text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
          small ? 'py-1.5 text-xs' : 'py-2 text-sm'
        }`}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  small,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  small?: boolean;
}) {
  return (
    <div>
      <label className={`block font-medium text-slate-400 mb-1 ${small ? 'text-[11px]' : 'text-xs'}`}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-slate-700/50 bg-slate-800 px-3 text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
          small ? 'py-1.5 text-xs' : 'py-2 text-sm'
        }`}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
