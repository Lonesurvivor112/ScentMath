import { useEffect, useRef, useState } from 'react'
import { normalizeBarcode, type BarcodeFormat } from '../engine/barcode'

interface BarcodeScannerProps {
  /** Called once each time a new barcode comes into view. */
  onScan: (code: string) => void
  /** Keeps the camera on but ignores what it sees. */
  paused?: boolean
  /**
   * Codes handled just before the camera started. They are treated as still
   * in view, so a bottle that hasn't been moved away isn't added twice.
   */
  recentCodes?: readonly string[]
}

type ScanState = 'starting' | 'scanning' | 'denied' | 'no-camera' | 'insecure' | 'error'

/**
 * A code is reported again only after it has been out of view this long, so
 * holding one bottle steady doesn't add it twice.
 */
const REARM_MS = 1500

/** How long after the camera starts a just-handled bottle is assumed to still be in view. */
const STILL_IN_VIEW_MS = 4000

const WANTED_FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8'] as const

/** The browser's built-in detector, where there is one (not on iPhone). */
interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string; format: string }[]>
}
interface NativeDetectorCtor {
  new (options: { formats: string[] }): NativeDetector
  getSupportedFormats(): Promise<string[]>
}

const toFormat = (name: string): BarcodeFormat =>
  (WANTED_FORMATS as readonly string[]).includes(name) ? (name as BarcodeFormat) : 'other'

type Report = (raw: string, format: BarcodeFormat) => void

/** Starts reading barcodes from the video. Returns a function that stops it. */
async function startDetecting(video: HTMLVideoElement, report: Report): Promise<() => void> {
  const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      const formats = WANTED_FORMATS.filter((f) => supported.includes(f))
      if (formats.includes('upc_a') || formats.includes('ean_13')) {
        const detector = new Native({ formats: [...formats] })
        await video.play()
        let busy = false
        const timer = window.setInterval(() => {
          if (busy || video.readyState < 2) return
          busy = true
          detector
            .detect(video)
            .then((found) => found.forEach((f) => report(f.rawValue, toFormat(f.format))))
            .catch(() => undefined)
            .finally(() => {
              busy = false
            })
        }, 150)
        return () => window.clearInterval(timer)
      }
    } catch {
      // Fall through to the bundled reader.
    }
  }

  // Loaded only when the scanner opens, so it doesn't slow down the app.
  // This reader starts the video playing itself.
  const [{ BrowserMultiFormatReader }, { BarcodeFormat: Zx, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map<number, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [Zx.UPC_A, Zx.UPC_E, Zx.EAN_13, Zx.EAN_8])
  hints.set(DecodeHintType.TRY_HARDER, true)
  const reader = new BrowserMultiFormatReader(hints, {
    delayBetweenScanAttempts: 120,
    delayBetweenScanSuccess: 400,
  })
  const controls = await reader.decodeFromVideoElement(video, (result) => {
    if (!result) return
    const format = result.getBarcodeFormat()
    report(
      result.getText(),
      format === Zx.UPC_E ? 'upc_e' : format === Zx.EAN_8 ? 'ean_8' : format === Zx.UPC_A ? 'upc_a' : 'ean_13',
    )
  })
  return () => controls.stop()
}

const MESSAGES: Record<Exclude<ScanState, 'scanning'>, { title: string; detail: string }> = {
  starting: { title: 'Starting the camera…', detail: '' },
  denied: {
    title: 'Camera access is off',
    detail: 'Allow the camera for this site in your browser settings, or type the barcode below.',
  },
  'no-camera': {
    title: 'No camera found',
    detail: 'Type the number under the barcode below instead.',
  },
  insecure: {
    title: 'The camera needs a secure connection',
    detail: 'Open the app over https to scan. You can still type the barcode below.',
  },
  error: {
    title: "The camera couldn't start",
    detail: 'Close other apps using the camera and try again, or type the barcode below.',
  },
}

/** A live camera view that reads product barcodes (UPC and EAN). */
export function BarcodeScanner({ onScan, paused = false, recentCodes }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onScanRef = useRef(onScan)
  const pausedRef = useRef(paused)
  const recentRef = useRef(recentCodes)
  const [state, setState] = useState<ScanState>('starting')
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    onScanRef.current = onScan
    pausedRef.current = paused
  }, [onScan, paused])

  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let stopDetecting: (() => void) | null = null
    let flashTimer = 0
    const lastSeen = new Map<string, number>()
    // A bottle that was handled just before the camera started is probably
    // still in front of it. Its first sighting only marks it as in view. If
    // it isn't seen in the first few seconds it has been moved away, and a
    // later sighting counts as a new scan.
    const stillInView = new Set(recentRef.current ?? [])
    let graceEnds = Number.POSITIVE_INFINITY

    const report: Report = (raw, format) => {
      const code = normalizeBarcode(raw, format)
      if (!code) return
      const now = Date.now()
      if (graceEnds === Number.POSITIVE_INFINITY) graceEnds = now + STILL_IN_VIEW_MS
      const seen = lastSeen.get(code)
      lastSeen.set(code, now)
      if (stillInView.delete(code) && now < graceEnds) return
      if (pausedRef.current) return
      if (seen !== undefined && now - seen < REARM_MS) return
      navigator.vibrate?.(60)
      setFlash(true)
      window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(() => setFlash(false), 350)
      onScanRef.current(code)
    }

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState(window.isSecureContext ? 'no-camera' : 'insecure')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch (cause) {
        const name = cause instanceof DOMException ? cause.name : ''
        if (cancelled) return
        if (name === 'NotAllowedError' || name === 'SecurityError') setState('denied')
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') setState('no-camera')
        else setState('error')
        return
      }
      const video = videoRef.current
      if (cancelled || !video) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      video.srcObject = stream
      try {
        const stop = await startDetecting(video, report)
        if (cancelled) stop()
        else {
          stopDetecting = stop
          setState('scanning')
        }
      } catch {
        if (!cancelled) setState('error')
      }
    }
    void start()

    return () => {
      cancelled = true
      window.clearTimeout(flashTimer)
      stopDetecting?.()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const message = state === 'scanning' ? null : MESSAGES[state]

  return (
    <div
      className={`relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-stone-900 ring-4 transition-colors ${
        flash ? 'ring-emerald-400' : 'ring-transparent'
      }`}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        aria-label="Camera view for scanning barcodes"
        className="h-full w-full object-cover"
      />
      {state === 'scanning' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`h-2/5 w-4/5 rounded-xl border-2 ${paused ? 'border-white/30' : 'border-white/90'}`} />
        </div>
      )}
      {state === 'scanning' && (
        <p role="status" className="absolute inset-x-0 bottom-2 text-center text-xs font-medium text-white drop-shadow">
          {paused ? 'Paused' : 'Hold the barcode inside the frame'}
        </p>
      )}
      {message && (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center text-white">
          <p className="text-sm font-semibold">{message.title}</p>
          {message.detail && <p className="text-xs text-stone-300">{message.detail}</p>}
        </div>
      )}
    </div>
  )
}
