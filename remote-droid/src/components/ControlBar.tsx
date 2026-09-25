import type { NavAction } from "@/types";

interface ControlBarProps {
  onNav: (action: NavAction) => void;
  keyboardActive: boolean;
  onToggleKeyboard: () => void;
  disabled: boolean;
}

export function ControlBar({ onNav, keyboardActive, onToggleKeyboard, disabled }: ControlBarProps) {
  return (
    <footer className="flex items-center justify-center gap-3 border-t border-graphite-800 bg-graphite-900 px-5 py-3">
      <NavButton label="Back" onClick={() => onNav("back")} disabled={disabled}>
        <TriangleIcon />
      </NavButton>
      <NavButton label="Home" onClick={() => onNav("home")} disabled={disabled}>
        <CircleIcon />
      </NavButton>
      <NavButton label="Recents" onClick={() => onNav("recents")} disabled={disabled}>
        <SquareIcon />
      </NavButton>

      <div className="mx-2 h-8 w-px bg-graphite-800" />

      <button
        onClick={onToggleKeyboard}
        disabled={disabled}
        aria-pressed={keyboardActive}
        className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 font-display text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
          keyboardActive
            ? "border-signal/50 bg-signal/10 text-signal"
            : "border-graphite-700 text-graphite-400 hover:border-graphite-600 hover:text-white"
        }`}
      >
        <KeyboardIcon />
        Keyboard
      </button>
    </footer>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-10 w-14 items-center justify-center rounded-lg text-graphite-400 transition hover:bg-graphite-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function TriangleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L4 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="4" width="13" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M4 9.8h7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
