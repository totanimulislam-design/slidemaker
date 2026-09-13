import { useEffect, useRef, useState, type ReactNode } from "react";
import { SLIDE_H, SLIDE_W } from "./Slide";

function useFitScale(ref: React.RefObject<HTMLDivElement | null>, padding = 24) {
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const s = Math.min((width - padding) / SLIDE_W, (height - padding) / SLIDE_H);
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, padding]);
  return scale;
}

/** Centers a 1280×720 slide inside any flexible container. */
export function Stage({ children, padding = 32 }: { children: ReactNode; padding?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = useFitScale(ref, padding);
  return (
    <div ref={ref} className="relative min-h-0 w-full flex-1">
      <div
        className="absolute top-1/2 left-1/2 origin-center shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)]"
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Small non-interactive preview used in the slide rail. */
export function Thumb({ children, width = 190 }: { children: ReactNode; width?: number }) {
  const scale = width / SLIDE_W;
  return (
    <div style={{ width, height: Math.round(SLIDE_H * scale) }} className="overflow-hidden rounded-md bg-black">
      <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
