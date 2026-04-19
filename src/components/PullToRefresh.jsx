import { useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(null);
  const pulling = useRef(false);

  function onTouchStart(e) {
    // Only trigger if scrolled to top
    if (window.scrollY > 0) return;
    startYRef.current = e.touches[0].clientY;
    pulling.current = true;
  }

  function onTouchMove(e) {
    if (!pulling.current || startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      setPullY(Math.min(delta * 0.5, THRESHOLD * 1.3));
    }
  }

  async function onTouchEnd() {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(THRESHOLD);
      await onRefresh();
      setRefreshing(false);
    }
    setPullY(0);
    startYRef.current = null;
  }

  const progress = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: refreshing ? THRESHOLD : pullY }}
        >
          <RefreshCw
            className="w-5 h-5 text-primary transition-transform"
            style={{
              transform: `rotate(${refreshing ? 0 : progress * 360}deg)`,
              animation: refreshing ? "spin 0.8s linear infinite" : "none",
              opacity: progress,
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}