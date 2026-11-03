"use client"

type CvMat = {
  cols: number
  rows: number
  data: Uint8Array
  type: () => number
  create: (rows: number, cols: number, type: number) => void
  setTo: (value: CvScalar, mask?: CvMat) => void
  copyTo: (output: CvMat, mask?: CvMat) => void
  delete: () => void
}

type CvScalar = object
type CvRect = object
type CvSize = object

type Cv = {
  Mat: new () => CvMat
  Scalar: new (...values: number[]) => CvScalar
  Rect: new (x: number, y: number, width: number, height: number) => CvRect
  Size: new (width: number, height: number) => CvSize
  matFromImageData: (image: ImageData) => CvMat
  cvtColor: (source: CvMat, destination: CvMat, code: number) => void
  grabCut: (source: CvMat, mask: CvMat, rectangle: CvRect, backgroundModel: CvMat, foregroundModel: CvMat, iterations: number, mode: number) => void
  GaussianBlur: (source: CvMat, destination: CvMat, size: CvSize, sigmaX: number, sigmaY: number, borderType: number) => void
  Canny: (source: CvMat, destination: CvMat, lowThreshold: number, highThreshold: number, apertureSize: number, l2Gradient: boolean) => void
  COLOR_RGBA2BGR: number
  COLOR_BGR2GRAY: number
  COLOR_BGR2RGBA: number
  GC_INIT_WITH_RECT: number
  GC_FGD: number
  GC_PR_FGD: number
  CV_8UC1: number
  CV_8UC3: number
  BORDER_DEFAULT: number
}

function isCv(candidate: Cv | Promise<Cv> | undefined): candidate is Cv {
  return typeof candidate === "object" && candidate !== null && "Mat" in candidate
}

let openCvPromise: Promise<Cv> | undefined

export function loadOpenCv(): Promise<Cv> {
  if (openCvPromise) return openCvPromise
  openCvPromise = new Promise((resolve, reject) => {
    const scope = window as Window & { cv?: Cv | Promise<Cv>; Module?: { onRuntimeInitialized?: () => void } }
    let done = false
    const finish = (candidate: Cv | Promise<Cv> | undefined) => {
      if (done || !isCv(candidate)) return
      done = true
      resolve(new Proxy(candidate, { get: (target, property, receiver) => property === "then" ? undefined : Reflect.get(target, property, receiver) }))
    }
    const fail = (error: Error) => { if (!done) { done = true; reject(error) } }
    const ready = () => {
      const candidate = scope.cv
      if (candidate && typeof (candidate as Promise<Cv>).then === "function") (candidate as Promise<Cv>).then(finish, fail)
      else finish(candidate)
    }
    scope.Module = { ...scope.Module, onRuntimeInitialized: ready }
    const script = document.createElement("script")
    script.async = true
    script.src = "https://docs.opencv.org/4.13.0/opencv.js"
    script.onload = ready
    script.onerror = () => fail(new Error("OpenCV.js could not be loaded."))
    document.head.appendChild(script)
    window.setTimeout(() => fail(new Error("OpenCV.js took too long to load.")), 30_000)
  })
  return openCvPromise
}

export async function createSketch(image: ImageData): Promise<ImageData> {
  const cv = await loadOpenCv()
  const src = cv.matFromImageData(image)
  const bgr = new cv.Mat(), mask = new cv.Mat(), bgModel = new cv.Mat(), fgModel = new cv.Mat()
  const foregroundMask = new cv.Mat(), foreground = new cv.Mat(), gray = new cv.Mat(), blurred = new cv.Mat(), edges = new cv.Mat(), sketch = new cv.Mat(), rgba = new cv.Mat()
  try {
    cv.cvtColor(src, bgr, cv.COLOR_RGBA2BGR)
    const inset = Math.max(4, Math.round(Math.min(src.cols, src.rows) * 0.055))
    cv.grabCut(bgr, mask, new cv.Rect(inset, inset, src.cols - inset * 2, src.rows - inset * 2), bgModel, fgModel, 5, cv.GC_INIT_WITH_RECT)
    foregroundMask.create(mask.rows, mask.cols, cv.CV_8UC1)
    for (let i = 0; i < mask.data.length; i++) foregroundMask.data[i] = mask.data[i] === cv.GC_FGD || mask.data[i] === cv.GC_PR_FGD ? 255 : 0
    foreground.create(bgr.rows, bgr.cols, bgr.type())
    foreground.setTo(new cv.Scalar(255, 255, 255))
    bgr.copyTo(foreground, foregroundMask)
    cv.cvtColor(foreground, gray, cv.COLOR_BGR2GRAY)
    cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 1.5, 1.5, cv.BORDER_DEFAULT)
    cv.Canny(blurred, edges, 54, 145, 3, false)
    sketch.create(bgr.rows, bgr.cols, cv.CV_8UC3)
    sketch.setTo(new cv.Scalar(250, 248, 241))
    sketch.setTo(new cv.Scalar(50, 37, 31), edges)
    cv.cvtColor(sketch, rgba, cv.COLOR_BGR2RGBA)
    return new ImageData(new Uint8ClampedArray(rgba.data), rgba.cols, rgba.rows)
  } finally {
    ;[src, bgr, mask, bgModel, fgModel, foregroundMask, foreground, gray, blurred, edges, sketch, rgba].forEach((mat) => mat.delete())
  }
}

// Kept as an alias for the separate Fourier study project that shares this workspace.
export function createFinalSketch(image: ImageData, sensitivity: number) {
  void sensitivity
  return createSketch(image)
}
