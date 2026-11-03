"use client"

import * as React from "react"
import { Download, Eye, ImagePlus, Plus, Sparkles, X } from "lucide-react"
import NextImage from "next/image"
import { Button } from "@/components/ui/button"
import { Paper } from "@/components/ui/paper"
import { createSketch } from "@/lib/opencv"

type Sketch = { id: string; name: string; original: string; sketch: string; createdAt: number }
type Preview = { src: string; name: string; label: "Original" | "Sketch" }
const CACHE_KEY = "looseleaf-sketches-v1"
const CACHE_EVENT = "looseleaf-sketches-updated"
const EMPTY_SKETCHES: Sketch[] = []
let cachedValue = ""
let cachedSketches: Sketch[] = EMPTY_SKETCHES

function readSketchCache() {
  if (typeof window === "undefined") return EMPTY_SKETCHES
  const value = localStorage.getItem(CACHE_KEY) ?? "[]"
  if (value === cachedValue) return cachedSketches
  try { cachedSketches = JSON.parse(value) as Sketch[]; cachedValue = value } catch { cachedSketches = EMPTY_SKETCHES; cachedValue = "[]" }
  return cachedSketches
}

function subscribeToSketchCache(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CACHE_EVENT, onChange)
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(CACHE_EVENT, onChange) }
}

function saveSketchCache(sketches: Sketch[]) {
  const value = JSON.stringify(sketches)
  cachedValue = value; cachedSketches = sketches
  localStorage.setItem(CACHE_KEY, value)
  window.dispatchEvent(new Event(CACHE_EVENT))
}

function canvasDataUrl(source: CanvasImageSource, width: number, height: number, type = "image/jpeg") {
  const canvas = document.createElement("canvas")
  canvas.width = width; canvas.height = height
  const context = canvas.getContext("2d")!
  context.fillStyle = "#f8f5ee"; context.fillRect(0, 0, width, height); context.drawImage(source, 0, 0, width, height)
  return canvas.toDataURL(type, type === "image/jpeg" ? 0.78 : undefined)
}

async function makeSketch(file: File) {
  const url = URL.createObjectURL(file), image = new window.Image()
  image.src = url; await image.decode()
  const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.round(image.naturalWidth * scale), height = Math.round(image.naturalHeight * scale)
  const original = canvasDataUrl(image, width, height)
  const input = document.createElement("canvas")
  input.width = width; input.height = height
  input.getContext("2d")!.drawImage(image, 0, 0, width, height)
  const result = await createSketch(input.getContext("2d")!.getImageData(0, 0, width, height))
  const output = document.createElement("canvas")
  output.width = result.width; output.height = result.height; output.getContext("2d")!.putImageData(result, 0, 0)
  URL.revokeObjectURL(url)
  return { original, sketch: output.toDataURL("image/png") }
}

function download(item: Sketch) {
  const link = document.createElement("a")
  link.href = item.sketch; link.download = `${item.name.replace(/\.[^.]+$/, "")}-sketch.png`; link.click()
}

export default function Home() {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const sketches = React.useSyncExternalStore(subscribeToSketchCache, readSketchCache, () => EMPTY_SKETCHES)
  const [file, setFile] = React.useState<File | null>(null)
  const [processing, setProcessing] = React.useState(false)
  const [status, setStatus] = React.useState("Attach a photo to begin.")
  const [preview, setPreview] = React.useState<Preview | null>(null)

  const selectFile = (selected?: File) => {
    if (!selected) return
    if (!selected.type.startsWith("image/")) { setStatus("Please choose an image file."); return }
    setFile(selected); setStatus(`${selected.name} is ready to sketch.`)
  }
  const process = async () => {
    if (!file || processing) return
    setProcessing(true); setStatus("Removing the background, smoothing, and finding contours…")
    try {
      const images = await makeSketch(file)
      const next = { id: crypto.randomUUID(), name: file.name, createdAt: Date.now(), ...images }
      saveSketchCache([next, ...sketches].slice(0, 3)); setFile(null); setStatus("Sketch pinned to your board.")
    } catch (error) { setStatus(error instanceof Error ? error.message : "The sketch could not be created.") } finally { setProcessing(false) }
  }

  return <main className="bulletin-page"><section className="bulletin-board sketch-board" aria-label="Photo to sketch bulletin board">
    <header className="board-header sketch-title"><Paper stock="paper" edge="deckle" tilt={-1.5} fastener="clip" fastenerClassName="-top-5 left-3" className="sketch-title-paper" seed="sketch-title"><h1>Sketch</h1></Paper></header>
    <Paper stock="slip" edge="deckle" tilt={-0.55}  className="sketch-workbench" seed="sketch-workbench">
      <div className="workbench-copy"><p className="note-eyebrow">photo → pencil sketch</p><h2>Make a contour sketch</h2><p>Turn a favorite photo into a line drawing.</p></div>
      <div className="workbench-actions"><input ref={inputRef} className="sr-only" type="file" accept="image/*" onChange={(event) => selectFile(event.target.files?.[0])} /><button type="button" className="attachment" onClick={() => inputRef.current?.click()}><ImagePlus size={19} /><span>{file ? file.name : "Attach a photo"}</span><small>{file ? "ready" : "JPG, PNG, WEBP"}</small></button><Button onClick={process} disabled={!file || processing} seed="sketch-button" className="sketch-button"><Sparkles size={17} />{processing ? "Sketching…" : "Sketch"}</Button></div>
      <p className="processing-status" role="status">{status}</p>
      <p className="workbench-note">For better results, use images with a clean, uncluttered background.</p>
    </Paper>
    <div className="pinned-heading"><span>recent sketches</span><span>{sketches.length}/3 pinned</span></div>
    <section className="sketch-gallery" aria-live="polite">
      {sketches.map((item, index) => <Paper key={item.id} stock="paper" edge="torn" tilt={[-.8, .65, -.4][index]} fastener="staple" fastenerClassName="top-2 left-1/2 -ml-3" className="sketch-card" seed={item.id}><button type="button" className="sketch-image" onClick={() => setPreview({ src: item.sketch, name: item.name, label: "Sketch" })} aria-label={`View sketch of ${item.name}`}><NextImage src={item.sketch} alt={`Contour sketch of ${item.name}`} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized /></button><div className="sketch-card-footer"><span title={item.name}>{item.name}</span><div><button type="button" onClick={() => setPreview({ src: item.original, name: item.name, label: "Original" })} aria-label={`View original ${item.name}`}><Eye size={17} /></button><button type="button" onClick={() => download(item)} aria-label={`Download sketch of ${item.name}`}><Download size={17} /></button></div></div></Paper>)}
      {Array.from({ length: Math.max(0, 3 - sketches.length) }).map((_, index) => <Paper key={`empty-${index}`} stock="index-card" edge="cut" tilt={[.35, -.5, .6][index]} className="sketch-card sketch-card-empty" seed={`empty-${index}`}><Plus size={24} /><p>Your next sketch<br />will land here.</p></Paper>)}
    </section>
  </section>{preview ? <div className="original-dialog" role="dialog" aria-modal="true" aria-label={`${preview.label} ${preview.name}`}><button className="dialog-backdrop" onClick={() => setPreview(null)} aria-label="Close image" /><Paper stock="photo" edge="deckle" tilt={false} className="original-paper" seed="image-view"><button type="button" className="close-original" onClick={() => setPreview(null)} aria-label="Close"><X size={18} /></button><div className="original-image"><NextImage src={preview.src} alt={`${preview.label} ${preview.name}`} fill sizes="(max-width: 760px) 100vw, 760px" unoptimized /></div><p>{preview.label} · {preview.name}</p></Paper></div> : null}</main>
}
