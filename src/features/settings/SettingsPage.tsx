import { useRef, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { deleteAllUserData } from '../../services/deleteDataService'
import {
  exportAllData, downloadJSON, downloadCSV,
  importFromJSON, importFromCSV, readFileAsText,
  type ExportBundle, type ImportResult,
} from '../../services/dataPortService'
import { sendCSVByEmail } from '../../services/emailExportService'
import { useQueryClient } from '@tanstack/react-query'
import { getInitials } from '../../lib/utils'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-textmut mb-2 px-1">{title}</h2>
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">{children}</div>
    </div>
  )
}

function Row({ icon, label, sub, onClick, danger = false, children }: {
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

function Spinner() {
  return <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
}

function ImportSummary({ results, onClose }: { results: ImportResult[]; onClose: () => void }) {
  const ok     = results.filter(r => !r.error && r.inserted > 0)
  const failed = results.filter(r => r.error)
  const empty  = results.filter(r => !r.error && r.inserted === 0)
  const total  = results.reduce((s, r) => s + r.inserted, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-md p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-xl shrink-0">
            {failed.length ? '⚠️' : '✅'}
          </div>
          <div>
            <h3 className="text-[15px] font-black text-[#1A1A1A]">Restore complete</h3>
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
            <p className="text-[11px] text-textmut px-3 pt-1">{empty.length} table(s) had no data to restore</p>
          )}
        </div>
        <button onClick={onClose}
          className="w-full h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all">
          Done
        </button>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, signOut } = useAuthStore()
  const queryClient       = useQueryClient()
  const fileInputRef      = useRef<HTMLInputElement>(null)

  const fullName  = user?.user_metadata?.full_name ?? user?.email ?? ''
  const email     = user?.email ?? ''
  const avatarUrl = user?.user_metadata?.avatar_url

  // ── Export modal ─────────────────────────────────────────────────────────
  const [exportOpen, setExportOpen]   = useState(false)
  const [exportFmt, setExportFmt]     = useState<'json' | 'csv'>('json')
  const [exporting, setExporting]     = useState(false)
  const [exportDone, setExportDone]   = useState(false)
  const [exportErr, setExportErr]     = useState('')

  // ── Import modal ─────────────────────────────────────────────────────────
  const [importOpen, setImportOpen]           = useState(false)
  const [pendingFile, setPendingFile]         = useState<File | null>(null)
  const [importing, setImporting]             = useState(false)
  const [importErr, setImportErr]             = useState('')
  const [importResults, setImportResults]     = useState<ImportResult[] | null>(null)

  // ── Delete modal ──────────────────────────────────────────────────────────
  // Email export state
  const [emailing,  setEmailing]  = useState(false)
  const [emailErr,  setEmailErr]  = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const handleSendEmail = async () => {
    if (!user) return
    setEmailing(true); setEmailErr(''); setEmailSent(false)
    try {
      await sendCSVByEmail(
        user.id,
        user.email ?? '',
        user.user_metadata?.full_name ?? user.email ?? '',
        user.email ?? '',
      )
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 4000)
    } catch (e: any) {
      setEmailErr(e.message ?? 'Failed to send')
    } finally {
      setEmailing(false)
    }
  }

  const [confirmOpen, setConfirm] = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [delError, setDelError]   = useState('')
  const [delDone, setDelDone]     = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!user) return
    setExporting(true); setExportErr('')
    try {
      const bundle = await exportAllData(user.id)
      if (exportFmt === 'json') downloadJSON(bundle)
      else downloadCSV(bundle)
      setExportDone(true)
      setTimeout(() => { setExportDone(false); setExportOpen(false) }, 1800)
    } catch (e: any) {
      setExportErr(e.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPendingFile(file)
    setImportErr('')
  }

  const handleImport = async () => {
    if (!pendingFile || !user) return
    setImporting(true); setImportErr('')
    try {
      const text = await readFileAsText(pendingFile)
      let results: ImportResult[]
      if (pendingFile.name.endsWith('.json')) {
        const bundle: ExportBundle = JSON.parse(text)
        results = await importFromJSON(bundle, user.id)
      } else {
        results = await importFromCSV(text, user.id)
      }
      queryClient.clear()
      setImportOpen(false)
      setPendingFile(null)
      setImportResults(results)
    } catch (e: any) {
      setImportErr(e.message ?? 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!user) return
    setDeleting(true); setDelError('')
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
          {avatarUrl
            ? <img src={avatarUrl} alt={fullName} className="w-12 h-12 rounded-full ring-2 ring-border object-cover" />
            : <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center text-sm font-bold text-chalk shadow-card">{getInitials(fullName || 'U')}</div>
          }
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

      {/* Data */}
      <Section title="Data">
        <Row icon="📤" label="Export data" sub="Download a full backup of all your portfolio data" onClick={() => { setExportDone(false); setExportErr(''); setExportOpen(true) }} />
        <Row icon="📥" label="Import & restore" sub="Restore from a previously exported JSON or CSV backup" onClick={() => { setPendingFile(null); setImportErr(''); setImportOpen(true) }} />
      </Section>

      {/* Email export */}
      <Section title="Email Backup">
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <span className="w-8 h-8 rounded-xl bg-surface2 flex items-center justify-center text-base shrink-0">✉️</span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-textprim">Send CSV to my email</div>
            <div className="text-[11px] text-textmut mt-0.5">
              Sends to <span className="font-semibold text-textprim">{email}</span> · Also auto-sends on the 1st of every month
            </div>
            {emailErr  && <p className="text-[11px] text-[#C0392B] mt-1">{emailErr}</p>}
            {emailSent && <p className="text-[11px] text-[#1A7A3C] mt-1">✓ Sent! Check your inbox.</p>}
          </div>
          <button
            onClick={handleSendEmail}
            disabled={emailing}
            className="h-9 px-4 rounded-xl bg-[#0F766E] text-white text-[12px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {emailing
              ? <><span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Sending…</>
              : emailSent ? <>✓ Sent!</> : <>📨 Send now</>
            }
          </button>
        </div>
      </Section>

      {/* About */}
      <Section title="About">
        <Row icon="📊" label="INFolio" sub="Personal portfolio tracker for India" />
        <Row icon="🏢" label="Developed by Chaz Tech Ltd." sub="© 2026 All rights reserved" />
        <Row icon="🔒" label="Privacy" sub="Auth-only cookies · No tracking · No ads" />
      </Section>

      {/* Danger */}
      <Section title="Danger Zone">
        <Row icon="🗑️" label="Delete all data" sub="Permanently removes all portfolio data. Your account is kept." danger onClick={() => setConfirm(true)}>
          <span className="text-[11px] font-bold text-[#C0392B] bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg shrink-0">Irreversible</span>
        </Row>
      </Section>

      {/* ── EXPORT MODAL ─────────────────────────────────────────────────── */}
      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => !exporting && setExportOpen(false)}>
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            {exportDone ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h3 className="text-[15px] font-black text-[#1A1A1A] mb-1">Export downloaded!</h3>
                <p className="text-[12px] text-[#767676]">Your backup file has been saved.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-xl bg-[#E6F4F1] flex items-center justify-center text-xl shrink-0">📤</div>
                  <div>
                    <h3 className="text-[15px] font-black text-[#1A1A1A]">Export data</h3>
                    <p className="text-[11px] text-[#767676] mt-0.5">Choose your preferred format</p>
                  </div>
                </div>

                {/* Format selector */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {(['json', 'csv'] as const).map(fmt => (
                    <button key={fmt} onClick={() => setExportFmt(fmt)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 transition-all ${
                        exportFmt === fmt
                          ? 'border-[#0F766E] bg-[#E6F4F1]'
                          : 'border-border bg-surface2 hover:border-[#0F766E]/40'
                      }`}>
                      <span className="text-2xl">{fmt === 'json' ? '{}' : '📄'}</span>
                      <span className={`text-[13px] font-black uppercase tracking-wide ${exportFmt === fmt ? 'text-[#0F766E]' : 'text-textprim'}`}>
                        {fmt.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-textmut text-center px-2">
                        {fmt === 'json' ? 'Structured · best for re-import' : 'Spreadsheet-friendly'}
                      </span>
                      {exportFmt === fmt && (
                        <span className="w-5 h-5 rounded-full bg-[#0F766E] flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {exportErr && <p className="text-[11px] text-[#C0392B] mb-3 px-1">{exportErr}</p>}

                <div className="flex gap-2">
                  <button onClick={() => setExportOpen(false)} disabled={exporting}
                    className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={handleExport} disabled={exporting}
                    className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                    {exporting ? <><Spinner /> Exporting…</> : `Export ${exportFmt.toUpperCase()}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── IMPORT MODAL ─────────────────────────────────────────────────── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={() => !importing && setImportOpen(false)}>
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-[#E6F4F1] flex items-center justify-center text-xl shrink-0">📥</div>
              <div>
                <h3 className="text-[15px] font-black text-[#1A1A1A]">Import & restore</h3>
                <p className="text-[11px] text-[#767676] mt-0.5">Select a .json or .csv backup file</p>
              </div>
            </div>

            {/* File picker */}
            <input ref={fileInputRef} type="file" accept=".json,.csv" className="hidden" onChange={handleFileChosen} />
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              className={`w-full rounded-xl border-2 border-dashed py-5 flex flex-col items-center gap-2 transition-all mb-4 ${
                pendingFile ? 'border-[#0F766E] bg-[#E6F4F1]' : 'border-border hover:border-[#0F766E]/50 hover:bg-surface2'
              }`}>
              <span className="text-2xl">{pendingFile ? '✅' : '📂'}</span>
              <span className="text-[13px] font-semibold text-textprim">
                {pendingFile ? pendingFile.name : 'Click to choose file'}
              </span>
              <span className="text-[11px] text-textmut">{pendingFile ? 'Click to change file' : 'Supports .json and .csv'}</span>
            </button>

            {/* Warning */}
            {pendingFile && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-3 mb-4">
                <p className="text-[11px] text-amber-800 font-semibold mb-1">⚠️ This will overwrite existing data</p>
                <p className="text-[11px] text-amber-700">Each table in the backup will be cleared and re-inserted from the file. Tables not in the backup are unaffected.</p>
              </div>
            )}

            {importErr && <p className="text-[11px] text-[#C0392B] mb-3">{importErr}</p>}

            <div className="flex gap-2">
              <button onClick={() => setImportOpen(false)} disabled={importing}
                className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing || !pendingFile}
                className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-[13px] font-bold hover:bg-[#0D4F4A] transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {importing ? <><Spinner /> Importing…</> : 'Restore data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT RESULTS MODAL ─────────────────────────────────────────── */}
      {importResults && (
        <ImportSummary results={importResults} onClose={() => { setImportResults(null); queryClient.clear() }} />
      )}

      {/* ── DELETE CONFIRM MODAL ─────────────────────────────────────────── */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
          onClick={() => !deleting && setConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}>
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
                    {['All stocks, mutual funds & gold holdings','Fixed deposits, bonds, cash & savings','Crypto & foreign stock holdings','All actual invested records','Allocation targets','All monthly snapshots & history'].map(item => (
                      <li key={item} className="flex items-center gap-1.5"><span className="text-red-400 text-[9px]">✕</span>{item}</li>
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
                  <button onClick={() => setConfirm(false)} disabled={deleting}
                    className="flex-1 h-10 rounded-xl border border-[#E0DDD6] bg-[#F5F4F0] text-[#767676] text-[13px] font-semibold hover:bg-[#EFEDE8] transition-all disabled:opacity-50">
                    Cancel
                  </button>
                  <button onClick={handleDeleteAll} disabled={deleting}
                    className="flex-1 h-10 rounded-xl bg-[#C0392B] hover:bg-[#A93226] text-white text-[13px] font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]">
                    {deleting && <Spinner />}
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
