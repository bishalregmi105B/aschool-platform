"use client";

import { useEffect, useState } from "react";

interface Slide {
  image?: string;
  title: string;
  subtitle?: string;
  cta?: { text: string; href: string };
}

interface HeroSlideshowProps {
  slides?: Slide[];
  height?: string;
  overlay?: boolean;
  overlayOpacity?: number;
  autoPlay?: boolean;
  interval?: number;
}

export function HeroSlideshow({
  slides = [],
  height = "70vh",
  overlay = true,
  overlayOpacity = 0.5,
  autoPlay = true,
  interval = 5000,
}: HeroSlideshowProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!autoPlay || slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, interval);
    return () => clearInterval(timer);
  }, [autoPlay, interval, slides.length]);

  if (slides.length === 0) return null;

  return (
    <section className="relative overflow-hidden" style={{ height }}>
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          {slide.image ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.image})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-slate-900" />
          )}
          {overlay && (
            <div
              className="absolute inset-0 bg-black"
              style={{ opacity: overlayOpacity }}
            />
          )}
          <div className="relative z-10 flex items-center justify-center h-full text-white text-center px-4">
            <div className="max-w-3xl">
              <h1 className="text-4xl md:text-6xl font-bold mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {slide.title}
              </h1>
              {slide.subtitle && (
                <p className="text-xl md:text-2xl mb-8 opacity-90 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                  {slide.subtitle}
                </p>
              )}
              {slide.cta && (
                <a
                  href={slide.cta.href}
                  className="inline-flex items-center px-8 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300"
                >
                  {slide.cta.text}
                </a>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Slide indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-3 h-3 rounded-full transition-all ${
              i === current ? "bg-white w-8" : "bg-white/50 hover:bg-white/75"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
