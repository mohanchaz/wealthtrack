import { useRef, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { deleteAllUserData } from '../../services/deleteDataService'
import {
  exportAllData, downloadJSON, downloadCSV,
  importFromJSON, importFromCSV, readFileAsText,
  type ExportBundle, type ImportResult,
} from '../../services/dataPortService'
import { useQueryClient } from '@tanstack/react-query'
import { getInitials } from '../../lib/utils'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-textmut mb-2 px-1">{title}</h2>
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  )
}

function Row({
  icon, label, sub, onClick, danger = false, children,
}: {
  icon: string; label: string; sub?: string; onClick?: () => void
  danger?: boolean; children?: React.ReactNode
}) {
  const base  = "flex items-center gap-3.5 px-4 py-3.5 transition-colors border-b border-border last:border-0"
  const hover = danger ? "hover:bg-red-50 cursor-pointer" : onClick ? "hover:bg-surface2 cursor-pointer" : ""
  return (
    <div className={`${base} ${hover}`} onClick={onClick}>
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 ${danger ? 'bg-red-50' : 'bg-surface2'}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] font-semibold ${danger ? 'text-[#C0392B]' : 'text-textprim'}`}>{label}</div>
        {sub && <div className="text-[11px] text-textmut mt-0.5">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Import results summary ───────────────────────────────────────────────────
function ImportSummary({ results, onClose }: { results: ImportResult[]; onClose: () => void }) {
  const ok      = results.filter(r => !r.error && r.inserted > 0)
  const empty   = results.filter(r => !r.error && r.inserted === 0)
  const failed  = results.filter(r => r.error)
  const total   = results.reduce((s, r) => s + r.inserted, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-md p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-xl shrink-0">
            {failed.length ? '⚠️' : '✅'}
          </div>
          <div>
            <h3 className="text-[15px] font-black text-[#1A1A1A]">Import complete</h3>
            <p className="text-[11px] text-[#767676] mt-0.5">{total} rows restored across {ok.length} tables</p>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 space-y-1 mb-4 pr-1">
          {ok.map(r => (
            <div key={r.table} className="flex items-center justify-between text-[12px] px-3 py-1.5 rounded-lg bg-green-50">
              <span className="text-[#1A7A3C] font-semibold">{r.label}</span>
              <span className="text-[#1A7A3C]">+{r.inserted} rows</span>
            </div>
          ))}
          {failed.map(r => (
            <div key={r.table} className="text-[12px] px-3 py-1.5 rounded-lg bg-red-50">
              <div className="flex items-center justify-between">
                <span className="text-[#C0392B] font-semibold">{r.label}</span>
                <span className="text-red-400">failed</span>
              </div>
              <div className="text-[10px] text-[#C0392B] mt-0.5 truncate">{r.error}</div>
            </div>
          ))}
          {empty.length > 0 && (
            <div className="text-[11px] text-textmut px-3 pt-1">
              {empty.length} table(s) had no data to restore
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, signOut } = useAuthStore()
  const queryClient       = useQueryClient()
  const fileInputRef      = useRef<HTMLInputElement>(null)

  const fullName  = user?.user_metadata?.full_name ?? user?.email ?? ''
  const email     = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportErr, setExportErr] = useState('')

  // Import state
  const [importing, setImporting]         = useState(false)
  const [importErr, setImportErr]         = useState('')
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null)
  const [importConfirm, setImportConfirm] = useState<{ file: File } | null>(null)

  // Delete state
  const [confirmOpen, setConfirm] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [delError, setDelError]   = useState('')
  const [delDone, setDelDone]     = useState(false)

  // ── Export handlers ────────────────────────────────────────────────────────
  const handleExport = async (format: 'json' | 'csv') => {
    if (!user) return
    setExporting(true)
    setExportErr('')
    try {
      const bundle = await exportAllData(user.id)
      if (format === 'json') downloadJSON(bundle)
      else downloadCSV(bundle)
    } catch (e: any) {
      setExportErr(e.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Import handlers ────────────────────────────────────────────────────────
  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // reset so same file can be re-chosen
    setImportConfirm({ file })
  }

  const handleImportConfirmed = async () => {
    if (!importConfirm || !user) return
    const { file } = importConfirm
    setImportConfirm(null)
    setImporting(true)
    setImportErr('')
    try {
      const text = await readFileAsText(file)
      let results: ImportResult[]
      if (file.name.endsWith('.json')) {
        const bundle: ExportBundle = JSON.parse(text)
        results = await importFromJSON(bundle, user.id)
      } else {
        results = await importFromCSV(text, user.id)
      }
      queryClient.clear()
      setImportResults(results)
    } catch (e: any) {
      setImportErr(e.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (!user) return
    setDeleting(true)
    setDelError('')
    try {
      await deleteAllUserData(user.id)
      queryClient.clear()
      setDelDone(true)
      setTimeout(() => { setDelDone(false); setConfirm(false) }, 2000)
    } catch (e: any) {
      setDelError(e.message ?? 'Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-2 py-4 sm:px-4" style={{ fontFamily: 'Mulish, system-ui, sans-serif' }}>

      <div className="mb-6">
        <h1 className="text-[22px] font-black text-textprim tracking-tight">Settings</h1>
        <p className="text-[13px] text-textmut mt-0.5">Manage your account and data</p>
      </div>

      {/* Account */}
      <Section title="Account">
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-12 h-12 rounded-full ring-2 ring-border object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center text-sm font-bold text-chalk shadow-card">
              {getInitials(fullName || 'U')}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[15px] font-black text-textprim truncate">{fullName || 'User'}</div>
            <div className="text-[12px] text-textmut truncate">{email}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-dot" />
              <span className="text-[10px] font-semibold text-textsec">Signed in with Google</span>
            </div>
          </div>
        </div>
        <Row icon="👋" label="Sign out" sub="You'll be redirected to the login page" onClick={signOut} />
      </Section>

      {/* Data — Export */}
      <Section title="Data">
        <div className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-3.5">
            <span className="w-8 h-8 rounded-xl bg-surface2 flex items-center justify-center text-base shrink-0">📤</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-textprim">Export data</div>
              <div className="text-[11px] text-textmut mt-0.5">Download a full backup of all your portfolio data</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3 ml-11">
            <button
              onClick={() => handleExport('json')}
              disabled={exporting}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#0F766E] text-white text-[12px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-50"
            >
              {exporting ? <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : '{}'}
              JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border bg-surface2 text-textprim text-[12px] font-bold hover:bg-border transition-all disabled:opacity-50"
            >
              📄 CSV
            </button>
          </div>
          {exportErr && <p className="text-[11px] text-[#C0392B] mt-2 ml-11">{exportErr}</p>}
        </div>

        {/* Import */}
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-3.5">
            <span className="w-8 h-8 rounded-xl bg-surface2 flex items-center justify-center text-base shrink-0">📥</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-textprim">Import &amp; restore</div>
              <div className="text-[11px] text-textmut mt-0.5">Restore from a previously exported JSON or CSV backup</div>
            </div>
          </div>
          <div className="ml-11 mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleFileChosen}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border bg-surface2 text-textprim text-[12px] font-bold hover:bg-border transition-all disabled:opacity-50"
            >
              {importing
                ? <><span className="w-3 h-3 rounded-full border-2 border-textmut/30 border-t-textmut animate-spin" /> Importing…</>
                : <>📂 Choose file (.json / .csv)</>
              }
            </button>
          </div>
          {importErr && <p className="text-[11px] text-[#C0392B] mt-2 ml-11">{importErr}</p>}
        </div>
      </Section>

      {/* About */}
      <Section title="About">
        <Row icon="📊" label="INFolio" sub="Personal portfolio tracker for India" />
        <Row icon="🏢" label="Developed by Chaz Tech Ltd." sub="© 2026 All rights reserved" />
        <Row icon="🔒" label="Privacy" sub="Auth-only cookies · No tracking · No ads" />
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone">
        <Row
          icon="🗑️"
          label="Delete all data"
          sub="Permanently removes all portfolio data. Your account is kept."
          danger
          onClick={() => setConfirm(true)}
        >
          <span className="text-[11px] font-bold text-[#C0392B] bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg shrink-0">
            Irreversible
          </span>
        </Row>
      </Section>

      {/* ── Import confirm modal ──────────────────────────────────────────── */}
      {importConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => setImportConfirm(null)}
        >
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-xl shrink-0">⚠️</div>
              <div>
                <h3 className="text-[15px] font-black text-[#1A1A1A]">Restore from backup?</h3>
                <p className="text-[11px] text-[#767676] mt-0.5 truncate max-w-[220px]">{importConfirm.file.name}</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3 mb-4">
              <p className="text-[12px] text-amber-800 font-semibold mb-1">This will:</p>
              <ul className="text-[11px] text-amber-700 space-y-0.5">
                <li className="flex items-center gap-1.5"><span className="text-[9px]">•</span>Delete your current data for each table in the backup</li>
                <li className="flex items-center gap-1.5"><span className="text-[9px]">•</span>Re-insert all rows from the backup file</li>
                <li className="flex items-center gap-1.5"><span className="text-[9px]">•</span>Tables not in the backup are left untouched</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setImportConfirm(null)}
                className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all"
              >Cancel</button>
              <button
                onClick={handleImportConfirmed}
                className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all"
              >Yes, restore</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import results modal ──────────────────────────────────────────── */}
      {importResults && (
        <ImportSummary
          results={importResults}
          onClose={() => { setImportResults(null); queryClient.clear() }}
        />
      )}

      {/* ── Delete confirm modal ──────────────────────────────────────────── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => !deleting && setConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            {delDone ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-[15px] font-black text-[#1A1A1A] mb-1">All data cleared</h3>
                <p className="text-[12px] text-[#767676]">Your account is intact. Start fresh anytime.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-xl shrink-0">🗑️</div>
                  <div>
                    <h3 className="text-[15px] font-black text-[#1A1A1A]">Delete all data?</h3>
                    <p className="text-[11px] text-[#767676] mt-0.5">This cannot be undone</p>
                  </div>
                </div>
                <div className="bg-[#FFF5F5] border border-red-100 rounded-xl px-3.5 py-3 mb-4">
                  <p className="text-[12px] text-[#C0392B] font-semibold mb-1.5">This will permanently delete:</p>
                  <ul className="text-[11px] text-[#767676] space-y-0.5">
                    {[
                      'All stocks, mutual funds & gold holdings',
                      'Fixed deposits, bonds, cash & savings',
                      'Crypto & foreign stock holdings',
                      'All actual invested records',
                      'Allocation targets',
                      'All monthly snapshots & history',
                    ].map(item => (
                      <li key={item} className="flex items-center gap-1.5">
                        <span className="text-red-400 text-[9px]">✕</span>{item}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-[#767676] mt-2 pt-2 border-t border-red-100">
                    <span className="font-semibold text-[#1A1A1A]">Your account is kept</span> — sign back in and start fresh.
                  </p>
                </div>
                {delError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">
                    <span className="text-red-500 text-xs">⚠</span>
                    <p className="text-[11px] text-[#C0392B]">{delError}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirm(false)}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all disabled:opacity-50"
                  >Cancel</button>
                  <button
                    onClick={handleDeleteAll}
                    disabled={deleting}
                    className="flex-1 h-10 rounded-xl bg-[#C0392B] hover:bg-[#A93226] text-white text-[13px] font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {deleting && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                    {deleting ? 'Deleting…' : 'Yes, delete all'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
