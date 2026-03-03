import { Settings, Database, Cloud, FolderOpen, Info, CheckCircle2, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function EnvStatus({ name, configured }: { name: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-mono text-sm text-slate-300">{name}</span>
      {configured ? (
        <span className="inline-flex items-center gap-1 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          Configured
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-sm text-slate-500">
          <XCircle className="h-4 w-4" />
          Not set
        </span>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const envVars = [
    { name: 'DATABASE_URL', configured: !!process.env.DATABASE_URL },
    { name: 'COPYLEAKS_EMAIL', configured: !!process.env.COPYLEAKS_EMAIL },
    { name: 'COPYLEAKS_API_KEY', configured: !!process.env.COPYLEAKS_API_KEY },
    { name: 'GOOGLE_SERVICE_ACCOUNT_EMAIL', configured: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL },
    { name: 'GOOGLE_PRIVATE_KEY', configured: !!process.env.GOOGLE_PRIVATE_KEY },
    { name: 'NEXT_PUBLIC_APP_URL', configured: !!process.env.NEXT_PUBLIC_APP_URL },
  ];

  const dbConfigured = !!process.env.DATABASE_URL;
  const copyleaksConfigured = !!process.env.COPYLEAKS_EMAIL && !!process.env.COPYLEAKS_API_KEY;
  const driveConfigured = !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && !!process.env.GOOGLE_PRIVATE_KEY;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">
          System configuration and connection status
        </p>
      </div>

      {/* Connection Status */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Settings className="h-5 w-5 text-teal-400" />
          Connection Status
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Database className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-medium text-slate-200">Database</span>
            </div>
            <p className={`text-sm ${dbConfigured ? 'text-green-400' : 'text-slate-500'}`}>
              {dbConfigured ? '● Connected' : '○ Not configured'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-medium text-slate-200">Copyleaks API</span>
            </div>
            <p className={`text-sm ${copyleaksConfigured ? 'text-green-400' : 'text-slate-500'}`}>
              {copyleaksConfigured ? '● Connected' : '○ Not configured'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <div className="mb-2 flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-teal-400" />
              <span className="text-sm font-medium text-slate-200">Google Drive</span>
            </div>
            <p className={`text-sm ${driveConfigured ? 'text-green-400' : 'text-slate-500'}`}>
              {driveConfigured ? '● Connected' : '○ Not configured'}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Settings className="h-5 w-5 text-teal-400" />
          Configuration
        </h2>
        <div className="divide-y divide-slate-700/50">
          {envVars.map((env) => (
            <EnvStatus key={env.name} name={env.name} configured={env.configured} />
          ))}
        </div>
      </div>

      {/* About */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Info className="h-5 w-5 text-teal-400" />
          About
        </h2>
        <div className="space-y-2 text-sm text-slate-400">
          <p>
            <span className="text-slate-300">Version:</span> 1.0.0
          </p>
          <p>
            <span className="text-slate-300">Stack:</span> Next.js 15, Prisma, Aurora PostgreSQL, Copyleaks API
          </p>
          <p>
            <span className="text-slate-300">Documentation:</span>{' '}
            <a
              href="https://docs.copyleaks.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-500 hover:text-teal-400"
            >
              Copyleaks API Docs
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
