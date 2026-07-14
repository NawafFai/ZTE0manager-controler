import { useState, type ReactNode } from 'react';

/**
 * A button that requires an explicit second click to fire a mutating action.
 * Router band/cell locks change the live connection, so we never fire them on a
 * single click. Shows pending + result state inline.
 */
export function ConfirmButton({
  label,
  confirmLabel = 'Confirm',
  onConfirm,
  danger = false,
  disabled = false,
  pending = false,
  children,
}: {
  label: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  danger?: boolean;
  disabled?: boolean;
  pending?: boolean;
  children?: ReactNode;
}) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          disabled={disabled || pending}
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
        >
          {pending ? 'Working…' : confirmLabel}
        </button>
        <button className="btn-ghost" onClick={() => setArmed(false)} disabled={pending}>
          Cancel
        </button>
        {children}
      </span>
    );
  }

  return (
    <button
      className={danger ? 'btn-danger' : 'btn-primary'}
      disabled={disabled || pending}
      onClick={() => setArmed(true)}
    >
      {label}
    </button>
  );
}
