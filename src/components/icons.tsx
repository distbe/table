/**
 * Paths inlined from the Tabler Icons (MIT) outline set.
 * Only a handful are used, so the package is not worth a dependency.
 * Source: https://tabler.io/icons
 */

const ICONS = {
  rowInsertTop: [
    'M4 18v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1',
    'M12 9v-4',
    'M10 7l4 0',
  ],
  rowInsertBottom: [
    'M20 6v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1',
    'M12 15l0 4',
    'M14 17l-4 0',
  ],
  rowRemove: [
    'M20 6v4a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h14a1 1 0 0 1 1 1',
    'M10 16l4 4',
    'M10 20l4 -4',
  ],
  columnInsertLeft: [
    'M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1',
    'M5 12l4 0',
    'M7 10l0 4',
  ],
  columnInsertRight: [
    'M6 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1',
    'M15 12l4 0',
    'M17 10l0 4',
  ],
  columnRemove: [
    'M6 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1',
    'M16 10l4 4',
    'M16 14l4 -4',
  ],
  trash: [
    'M4 7l16 0',
    'M10 11l0 6',
    'M14 11l0 6',
    'M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12',
    'M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3',
  ],
  eraser: [
    'M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3',
    'M18 13.3l-6.3 -6.3',
  ],
  layoutRows: [
    'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12',
    'M4 12l16 0',
  ],
  alignLeft: ['M4 6l16 0', 'M4 12l10 0', 'M4 18l14 0'],
  alignCenter: ['M4 6l16 0', 'M8 12l8 0', 'M6 18l12 0'],
  alignRight: ['M4 6l16 0', 'M10 12l10 0', 'M6 18l14 0'],
  wand: [
    'M6 21l15 -15l-3 -3l-15 15l3 3',
    'M15 6l3 3',
    'M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2',
    'M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2',
  ],
} as const

export type IconName = keyof typeof ICONS

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
