import { createStore, del, entries, get, set } from 'idb-keyval'
import type { Song } from '../music/types'

// Músicas ficam só no aparelho (IndexedDB).
const songStore = createStore('octabs', 'songs')

export async function listSongs(): Promise<Song[]> {
  const all = await entries<string, Song>(songStore)
  return all.map(([, s]) => s).sort((a, b) => b.updatedAt - a.updatedAt)
}

export const getSong = (id: string) => get<Song>(id, songStore)

export const saveSong = (song: Song) => set(song.id, { ...song, updatedAt: Date.now() }, songStore)

export const deleteSong = (id: string) => del(id, songStore)

/** Backup: JSON com todas as músicas. */
export async function exportSongs(): Promise<string> {
  return JSON.stringify({ app: 'octabs', version: 1, songs: await listSongs() }, null, 2)
}

export async function importSongs(json: string): Promise<number> {
  const data = JSON.parse(json)
  const songs: Song[] = Array.isArray(data) ? data : data.songs
  if (!Array.isArray(songs)) throw new Error('Arquivo de backup inválido')
  for (const s of songs) {
    if (typeof s?.id === 'string' && Array.isArray(s.items)) await set(s.id, s, songStore)
  }
  return songs.length
}
