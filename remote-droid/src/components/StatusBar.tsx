import type { DeviceInfo, RtcStatus, WsStatus } from "@/types";

interface StatusBarProps {
  wsStatus: WsStatus;
  rtcStatus: RtcStatus;
  device: DeviceInfo | null;
  stats: { fps: number; bitrateKbps: number } | null;
  onDisconnect: () => void;
}

export function StatusBar({ wsStatus, rtcStatus, device, stats, onDisconnect }: StatusBarProps) {
  const link = describeLink(wsStatus, rtcStatus);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite-800 bg-graphite-900 px-5 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${link.dotClass}`} />
        <div>
          <p className="font-display text-sm font-medium text-white">{device?.name ?? "Remote Droid"}</p>
          <p className="font-mono text-[11px] text-graphite-500">
            {device ? `${device.model} · Android ${device.androidVersion}` : link.label}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5">
        {device && (
          <div className="hidden items-center gap-4 sm:flex">
            <Metric label="Link" value={link.label} tone={link.tone} />
            <Metric
              label="Stream"
              value={rtcStatus === "connected" ? (stats ? `${stats.fps} fps` : "live") : "—"}
              tone={rtcStatus === "connected" ? "good" : "muted"}
            />
            <Metric label="Resolution" value={`${device.screenWidth}×${device.screenHeight}`} tone="muted" />
            <Metric
              label="Orientation"
              value={device.orientation === "portrait" ? "Portrait" : "Landscape"}
              tone="muted"
            />
            {typeof device.batteryLevel === "number" && (
              <Metric label="Battery" value={`${device.batteryLevel}%`} tone="muted" />
            )}
          </div>
        )}

        <button
          onClick={onDisconnect}
          className="rounded-lg border border-alert/40 px-3 py-1.5 font-display text-xs font-medium text-alert transition hover:bg-alert/10"
        >
          Disconnect
        </button>
      </div>
    </header>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "muted" | "warn" }) {
  const toneClass = tone === "good" ? "text-signal" : tone === "warn" ? "text-amber" : "text-graphite-400";
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-graphite-600">{label}</p>
      <p className={`font-mono text-xs ${toneClass}`}>{value}</p>
    </div>
  );
}

function describeLink(
  wsStatus: WsStatus,
  rtcStatus: RtcStatus
): { label: string; tone: "good" | "muted" | "warn"; dotClass: string } {
  if (wsStatus === "reconnecting") {
    return { label: "Reconnecting…", tone: "warn", dotClass: "bg-amber animate-pulse" };
  }
  if (wsStatus === "error" || rtcStatus === "failed") {
    return { label: "Connection error", tone: "warn", dotClass: "bg-alert" };
  }
  if (wsStatus === "paired" && rtcStatus === "connected") {
    return { label: "Connected", tone: "good", dotClass: "bg-signal" };
  }
  if (wsStatus === "paired") {
    return { label: "Streaming…", tone: "warn", dotClass: "bg-amber animate-pulse" };
  }
  return { label: "Connecting…", tone: "muted", dotClass: "bg-graphite-500 animate-pulse" };
}
