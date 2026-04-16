import { useViewStore } from '@/stores'

const PRESETS = [
  { label: '1:200', dpp: 0.2 },
  { label: '1:500', dpp: 0.5 },
  { label: '1:1000', dpp: 1.0 },
] as const

function isActive(currentDepthPerPixel: number, presetDepthPerPixel: number): boolean {
  return Math.abs(currentDepthPerPixel - presetDepthPerPixel) < 0.001
}

export function ZoomControl() {
  const depthPerPixel = useViewStore((state) => state.depthPerPixel)
  const setScale = useViewStore((state) => state.setScale)

  return (
    <div className="zoom-control" aria-label="Depth scale presets">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          className={isActive(depthPerPixel, preset.dpp) ? 'zoom-control__button zoom-control__button--active' : 'zoom-control__button'}
          onClick={() => setScale(preset.dpp)}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
