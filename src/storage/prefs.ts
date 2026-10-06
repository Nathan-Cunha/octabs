// Preferências do aparelho (localStorage). Sem armazenamento, usa o padrão.

export function loadPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`octabs:${key}`)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

export function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(`octabs:${key}`, JSON.stringify(value))
  } catch {
    /* sem armazenamento: ignora */
  }
}
