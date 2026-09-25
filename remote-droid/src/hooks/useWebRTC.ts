import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, RtcStatus } from "@/types";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface UseWebRTCOptions {
  send: (msg: ClientMessage) => void;
}

/**
 * Owns the RTCPeerConnection. The Android side is always the offerer since it
 * owns the screen-capture media source; this hook answers and relays ICE.
 * No JPEG/base64 frames ever pass through here — `videoStream` is a live
 * MediaStream delivered straight from the phone's encoder over WebRTC.
 */
export function useWebRTC({ send }: UseWebRTCOptions) {
  const [status, setStatus] = useState<RtcStatus>("idle");
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [stats, setStats] = useState<{ fps: number; bitrateKbps: number } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBytesRef = useRef<{ bytes: number; frames: number; t: number } | null>(null);

  const teardown = useCallback(() => {
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    pendingCandidatesRef.current = [];
    lastBytesRef.current = null;
    setVideoStream(null);
    setStats(null);
  }, []);

  const createPeerConnection = useCallback(() => {
    teardown();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    setStatus("negotiating");

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setVideoStream(stream ?? new MediaStream([event.track]));
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: "ice-candidate", candidate: event.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case "connected":
          setStatus("connected");
          startStatsLoop(pc);
          break;
        case "disconnected":
          setStatus("disconnected");
          break;
        case "failed":
          setStatus("failed");
          break;
        case "closed":
          setStatus("idle");
          break;
      }
    };

    return pc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, teardown]);

  const handleOffer = useCallback(
    async (sdp: string) => {
      const pc = createPeerConnection();
      try {
        await pc.setRemoteDescription({ type: "offer", sdp });
        // Flush any ICE candidates that arrived before the remote description was set.
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(candidate).catch(() => {});
        }
        pendingCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "webrtc-answer", sdp: answer.sdp ?? "" });
      } catch {
        setStatus("failed");
      }
    },
    [createPeerConnection, send]
  );

  const handleRemoteIceCandidate = useCallback((candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription) {
      pc.addIceCandidate(candidate).catch(() => {});
    } else {
      pendingCandidatesRef.current.push(candidate);
    }
  }, []);

  function startStatsLoop(pc: RTCPeerConnection) {
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = setInterval(async () => {
      const report = await pc.getStats();
      report.forEach((r) => {
        if (r.type === "inbound-rtp" && r.kind === "video") {
          const now = performance.now();
          const bytes = r.bytesReceived ?? 0;
          const frames = r.framesDecoded ?? 0;
          const prev = lastBytesRef.current;
          if (prev) {
            const dt = (now - prev.t) / 1000;
            if (dt > 0) {
              const bitrateKbps = Math.max(0, ((bytes - prev.bytes) * 8) / 1000 / dt);
              const fps = Math.max(0, (frames - prev.frames) / dt);
              setStats({ fps: Math.round(fps), bitrateKbps: Math.round(bitrateKbps) });
            }
          }
          lastBytesRef.current = { bytes, frames, t: now };
        }
      });
    }, 2000);
  }

  const close = useCallback(() => {
    teardown();
    setStatus("idle");
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return { status, videoStream, stats, handleOffer, handleRemoteIceCandidate, close };
}
