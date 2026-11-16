import { useRef, useState } from 'react'
import { useApp } from '../ctx'
import { Avatar, Icon } from './Icon'
import { errMsg } from '../util'

/** Klippir mynd í ferning (miðja) og minnkar í 480×480 JPEG */
async function toSquareJpeg(file: File, size = 480): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('Gat ekki lesið myndina')); i.src = url })
    const s = Math.min(img.naturalWidth, img.naturalHeight)
    const c = document.createElement('canvas'); c.width = size; c.height = size
    const g = c.getContext('2d')!
    g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size)
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('Gat ekki unnið myndina'))), 'image/jpeg', 0.85))
  } finally { URL.revokeObjectURL(url) }
}

/** Prófílmynd sem hægt er að smella á til að skipta um */
export default function AvatarUpload({ profileId, src, name, size = 112 }: { profileId: string; src: string | null | undefined; name: string; size?: number }) {
  const { api, me, toast, refresh, reloadMe } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  async function pick(f?: File) {
    if (!f) return
    if (!f.type.startsWith('image/')) { toast('Veldu mynd'); return }
    setBusy(true)
    try {
      const jpeg = await toSquareJpeg(f)
      setPreview(URL.createObjectURL(jpeg))
      await api.uploadAvatar(profileId, jpeg)
      toast('Mynd vistuð'); refresh(); if (profileId === me.id) reloadMe?.()
    } catch (e) { setPreview(null); toast(errMsg(e)) } finally { setBusy(false); if (input.current) input.current.value = '' }
  }

  return (
    <button type="button" className="av-up" style={{ width: size, height: size }} onClick={() => input.current?.click()} disabled={busy} aria-label="Skipta um mynd">
      <Avatar src={preview ?? src} name={name || '?'} size={size} />
      <span className="av-cam">{busy ? <span className="spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} /> : <Icon name="edit" size={16} />}</span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </button>
  )
}
