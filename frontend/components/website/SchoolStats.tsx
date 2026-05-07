"use client";

import { useEffect, useState, useRef } from "react";

interface StatItem {
  label: string;
  value: number;
  suffix?: string;
  icon?: string;
}

interface SchoolStatsProps {
  items?: StatItem[];
  bgColor?: string;
  textColor?: string;
}

const defaultStats: StatItem[] = [
  { label: "Students", value: 1200, suffix: "+", icon: "🎓" },
  { label: "Teachers", value: 85, suffix: "+", icon: "👩‍🏫" },
  { label: "Years of Excellence", value: 25, suffix: "+", icon: "🏫" },
  { label: "Pass Rate", value: 98, suffix: "%", icon: "📊" },
];

function useCountUp(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const steps = 60;
    const stepDuration = duration / steps;
    let current = 0;
    const increment = target / steps;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [started, target, duration]);

  return { count, ref };
}

function StatCard({ item }: { item: StatItem }) {
  const { count, ref } = useCountUp(item.value);

  return (
    <div ref={ref} className="text-center p-6">
      {item.icon && <div className="text-4xl mb-2">{item.icon}</div>}
      <div className="text-4xl md:text-5xl font-bold">
        {count}
        {item.suffix}
      </div>
      <div className="text-sm mt-2 opacity-80 font-medium">{item.label}</div>
    </div>
  );
}

export function SchoolStats({
  items = defaultStats,
  bgColor = "#1e40af",
  textColor = "#ffffff",
}: SchoolStatsProps) {
  return (
    <section
      className="py-16"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item, i) => (
            <StatCard key={i} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
