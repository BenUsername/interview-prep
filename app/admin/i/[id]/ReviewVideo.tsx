"use client";

import { useRef, useState } from "react";

const SPEEDS = [1, 1.25, 1.5, 2];

/**
 * Browser MediaRecorder output has no duration in its header, so the scrub bar
 * shows "Infinity" until the whole file is read. Seeking far ahead once forces
 * the browser to compute the real duration, then we jump back to the start.
 */
export function ReviewVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <video
        ref={ref}
        className="video"
        style={{ objectFit: "contain" }}
        src={src}
        controls
        preload="metadata"
        playsInline
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.duration === Infinity) {
            v.currentTime = 1e7;
            v.addEventListener("durationchange", () => { v.currentTime = 0; }, { once: true });
          }
        }}
      />
      <div className="row small">
        <span className="muted">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`btn small ${s === speed ? "" : "secondary"}`}
            style={{ padding: "4px 10px" }}
            onClick={() => {
              setSpeed(s);
              if (ref.current) ref.current.playbackRate = s;
            }}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
