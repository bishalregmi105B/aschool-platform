"use client";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  bgImage?: string;
  bgColor?: string;
  height?: string;
}

export function PageHero({
  title,
  subtitle,
  bgImage,
  bgColor = "#1e40af",
  height = "300px",
}: PageHeroProps) {
  return (
    <section
      className="relative flex items-center justify-center text-white overflow-hidden"
      style={{
        height,
        backgroundColor: bgImage ? undefined : bgColor,
        backgroundImage: bgImage ? `url(${bgImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {bgImage && <div className="absolute inset-0 bg-black/50" />}
      <div className="relative z-10 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-bold mb-2">{title}</h1>
        {subtitle && <p className="text-lg md:text-xl opacity-90">{subtitle}</p>}
      </div>
    </section>
  );
}
