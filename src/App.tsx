import { useCallback, useEffect, useState } from 'react'
import { Library } from './components/Library'
import { SongInput, type NewSongData } from './components/SongInput'
import { SongView } from './components/SongView'
import { bestTranspose } from './music/transpose'
import type { Song } from './music/types'
import { deleteSong, listSongs, saveSong } from './storage/db'

type View = { name: 'library' } | { name: 'new' } | { name: 'song'; song: Song; saved: boolean }

export function App() {
  const [view, setView] = useState<View>({ name: 'library' })
  const [songs, setSongs] = useState<Song[]>([])

  const refresh = useCallback(() => listSongs().then(setSongs), [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  function create(data: NewSongData) {
    const now = Date.now()
    const song: Song = {
      id: crypto.randomUUID(),
      title: data.title,
      source: data.source,
      items: data.items,
      transpose: bestTranspose(data.items),
      bpm: data.bpm ?? 100,
      createdAt: now,
      updatedAt: now,
    }
    setView({ name: 'song', song, saved: false })
  }

  async function save(song: Song) {
    await saveSong(song)
    await refresh()
    setView((v) => (v.name === 'song' && v.song.id === song.id && !v.saved ? { ...v, song, saved: true } : v))
  }

  return (
    <div className="app">
      {view.name === 'library' && (
        <Library
          songs={songs}
          onNew={() => setView({ name: 'new' })}
          onOpen={(song) => setView({ name: 'song', song, saved: true })}
          onDelete={async (s) => {
            await deleteSong(s.id)
            await refresh()
          }}
          onImported={refresh}
        />
      )}
      {view.name === 'new' && <SongInput onCreate={create} onCancel={() => setView({ name: 'library' })} />}
      {view.name === 'song' && (
        <SongView
          key={view.song.id}
          song={view.song}
          saved={view.saved}
          onBack={() => setView({ name: 'library' })}
          onSave={save}
        />
      )}
    </div>
  )
}
