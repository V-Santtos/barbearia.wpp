import { useRef, useEffect } from "react";
import { gsap } from "gsap";

type StepDotsProps = {
  total: number;
  page: number; // 0-based
};

export function StepDots({ total, page }: StepDotsProps) {
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    dotsRef.current.forEach((dot: HTMLDivElement | null, i: number) => {
      if (!dot) return;
      gsap.to(dot, {
        width: i === page ? 28 : 10,
        duration: 0.35,
        ease: "back.out(1.7)",
        overwrite: true,
      });
    });
  }, [page]);

  return (
    <div className="stepDotsRow">
      <div className="stepDots">
        {Array.from({ length: total }).map((_, i) => {
          const isActive = i === page;
          return (
            <div
              key={i}
              ref={(el: HTMLDivElement | null) => { dotsRef.current[i] = el; }}
              className={`stepDot ${isActive ? "is-active" : ""}`}
              style={{ width: isActive ? 28 : 10, height: 10, borderRadius: 9999 }}
            >
              {isActive && <span key={page} className="stepDotRipple" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
