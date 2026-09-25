import { useState } from "react";
import type { ConnectionConfig } from "@/types";

interface PairingScreenProps {
  onConnect: (config: ConnectionConfig) => void;
  isConnecting: boolean;
  errorMessage: string | null;
}

export function PairingScreen({ onConnect, isConnecting, errorMessage }: PairingScreenProps) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8443");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [useTls, setUseTls] = useState(false);

  const codeString = code.join("");
  const canSubmit = host.trim().length > 0 && port.trim().length > 0 && codeString.length === 6;

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9A-Za-z]/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) {
      const el = document.getElementById(`pair-digit-${index + 1}`);
      el?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const el = document.getElementById(`pair-digit-${index - 1}`);
      el?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isConnecting) return;
    onConnect({ host: host.trim(), port: Number(port), pairingCode: codeString, useTls });
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-graphite-950 px-6 py-12">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl bg-graphite-900 shadow-panel ring-1 ring-white/5 md:grid-cols-[1.1fr_1fr]">
        {/* Left: identity panel */}
        <div className="relative flex flex-col justify-between gap-10 bg-graphite-850 p-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-signal shadow-[0_0_12px_2px_rgba(61,220,132,0.55)]" />
              <span className="font-mono text-xs tracking-wide text-graphite-500">remote session</span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-white">
              Remote
              <br />
              Droid
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-graphite-500">
              Pair with the Remote Droid app on your phone to control it, live, from this browser.
            </p>
          </div>

          <PhoneGlyph connecting={isConnecting} />

          <ol className="space-y-2.5 text-sm text-graphite-500">
            <li className="flex gap-2.5">
              <span className="font-mono text-signal">1</span> Open Remote Droid on your Android phone
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono text-signal">2</span> Tap "Start pairing" to get an address and code
            </li>
            <li className="flex gap-2.5">
              <span className="font-mono text-signal">3</span> Enter both on the right, on the same network
            </li>
          </ol>
        </div>

        {/* Right: form panel */}
        <form onSubmit={handleSubmit} className="flex flex-col justify-center gap-6 p-10">
          <div className="flex flex-col gap-4">
            <Field label="Phone IP address">
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.42"
                autoComplete="off"
                className="input-field"
              />
            </Field>

            <div className="grid grid-cols-[1fr_auto] gap-4">
              <Field label="Port">
                <input
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  className="input-field"
                />
              </Field>
              <label className="flex cursor-pointer select-none flex-col items-start gap-2 pt-[26px]">
                <span className="flex items-center gap-2 rounded-lg border border-graphite-700 bg-graphite-850 px-3 py-2.5 text-xs text-graphite-400">
                  <input
                    type="checkbox"
                    checked={useTls}
                    onChange={(e) => setUseTls(e.target.checked)}
                    className="h-3.5 w-3.5 accent-signal"
                  />
                  Use TLS (wss)
                </span>
              </label>
            </div>

            <Field label="6-digit pairing code">
              <div className="flex gap-2">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    id={`pair-digit-${i}`}
                    value={digit}
                    onChange={(e) => handleCodeChange(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    maxLength={1}
                    inputMode="text"
                    autoComplete="off"
                    className="h-12 w-11 rounded-lg border border-graphite-700 bg-graphite-850 text-center font-mono text-lg text-white outline-none transition focus:border-signal focus:ring-2 focus:ring-signal/30"
                  />
                ))}
              </div>
            </Field>
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isConnecting}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-signal py-3 font-display text-sm font-semibold text-graphite-950 transition disabled:cursor-not-allowed disabled:bg-graphite-700 disabled:text-graphite-500"
          >
            {isConnecting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-graphite-950/40 border-t-graphite-950" />
                Pairing…
              </>
            ) : (
              "Connect to device"
            )}
          </button>

          <p className="text-center text-xs text-graphite-600">
            Your phone and this browser must be on the same Wi-Fi network.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-graphite-500">{label}</span>
      {children}
    </label>
  );
}

function PhoneGlyph({ connecting }: { connecting: boolean }) {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center self-start">
      {connecting && (
        <span className="absolute h-full w-full animate-pulseRing rounded-2xl border-2 border-signal/60" />
      )}
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="4" width="28" height="48" rx="5" stroke="#3ddc84" strokeWidth="2" />
        <line x1="14" y1="42" x2="42" y2="42" stroke="#3ddc84" strokeWidth="2" />
        <circle cx="28" cy="47" r="1.6" fill="#3ddc84" />
      </svg>
    </div>
  );
}
