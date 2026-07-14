import { formatLteBand, formatNrBand } from '@/signals/band-mask';

/**
 * Reusable band multi-select used by both the LTE and NR pages. Renders a grid
 * of toggle chips; the parent owns the selected-set state.
 */
export function BandSelector({
  rat,
  options,
  selected,
  onToggle,
}: {
  rat: 'LTE' | 'NR';
  options: number[];
  selected: Set<number>;
  onToggle: (band: number) => void;
}) {
  const format = rat === 'LTE' ? formatLteBand : formatNrBand;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((band) => {
        const active = selected.has(band);
        return (
          <button
            key={band}
            onClick={() => onToggle(band)}
            className={`chip cursor-pointer select-none px-3 py-1 ${
              active
                ? 'border-brand bg-brand/15 text-brand'
                : 'text-content-muted hover:border-content-muted'
            }`}
          >
            {format(band)}
          </button>
        );
      })}
    </div>
  );
}
