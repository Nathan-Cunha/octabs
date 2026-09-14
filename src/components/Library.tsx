import { useRef } from 'react'
import { exportSongs, importSongs } from '../storage/db'
import type { Song } from '../music/types'

interface Props {
  songs: Song[]
  onOpen(song: Song): void
  onNew(): void
  onDelete(song: Song): void
  onImported(): void
}

export function Library({ songs, onOpen, onNew, onDelete, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    const blob = new Blob([await exportSongs()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `octabs-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function handleImport(file: File) {
    try {
      const n = await importSongs(await file.text())
      alert(`${n} música(s) importada(s).`)
      onImported()
    } catch (e) {
      alert(`Não foi possível importar: ${(e as Error).message}`)
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1>🎵 OcTabs</h1>
        <button className="btn primary" onClick={onNew}>
          + Nova
        </button>
      </div>

      <div className="card">
        {songs.length === 0 ? (
          <p className="empty">
            Nenhuma música salva ainda.
            <br />
            Toque em <strong>+ Nova</strong> para começar.
          </p>
        ) : (
          <ul className="song-list">
            {songs.map((s) => (
              <li key={s.id}>
                <button className="title" onClick={() => onOpen(s)}>
                  {s.title}
                  <span className="meta">
                    {s.items.filter((i) => i.kind === 'note' && i.midi !== null).length} notas
                    {s.transpose !== 0 && ` · transposta ${s.transpose > 0 ? '+' : ''}${s.transpose}`}
                  </span>
                </button>
                <button
                  className="btn danger"
                  aria-label={`Apagar ${s.title}`}
                  onClick={() => confirm(`Apagar "${s.title}"?`) && onDelete(s)}
                >
                  🗑
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="row">
        <button className="btn" onClick={handleExport} disabled={songs.length === 0}>
          Exportar backup
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Importar backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImport(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
