import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Delay in ms — keep small (30–80ms) when staggering siblings */
  delay?: number;
}

/**
 * One-shot scroll reveal: fades + slides content up the first time it enters
 * the viewport. IntersectionObserver-driven, 400ms ease-out, never replays.
 * Respects prefers-reduced-motion (renders visible immediately).
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: `opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(14px)",
      }}
    >
      {children}
    </div>
  );
}
