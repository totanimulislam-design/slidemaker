import { useEffect, useRef, useState } from "react";

/**
 * How much height a floating box has before it would run past the bottom of the
 * window: from the box's own top edge — which does not depend on how tall its
 * content is — down to the bottom, minus a small gap.
 *
 * A box that hangs under a trigger (the slide picker) or under the top bar
 * (History) sizes itself with this instead of a fixed `max-h-*`, so a long list
 * opens all the way down the window and only scrolls once the screen itself
 * runs out.
 *
 * `room` is `null` until the box has been measured, so the caller keeps a plain
 * cap class for the first paint; it is re-measured on every resize.
 */
export function useRoomBelow(open: boolean, gap = 12, min = 220) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setRoom(null);
      return;
    }
    const measure = () => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      const vh = window.innerHeight || 800;
      setRoom(Math.max(min, Math.round(vh - box.top - gap)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, gap, min]);

  return { ref, room };
}
