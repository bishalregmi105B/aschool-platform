"use client";

interface SchoolHeaderProps {
  schoolName: string;
  logo?: string;
  bgColor?: string;
  textColor?: string;
  topBarText?: string;
  navItems?: { label: string; href: string }[];
  ctaText?: string;
  ctaHref?: string;
}

export function SchoolHeader({
  schoolName,
  logo,
  bgColor = "#1e40af",
  textColor = "#ffffff",
  topBarText,
  navItems = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Academics", href: "/academics" },
    { label: "Admission", href: "/admission" },
    { label: "Teachers", href: "/teachers" },
    { label: "Contact", href: "/contact" },
  ],
  ctaText = "Apply Now",
  ctaHref = "/admission",
}: SchoolHeaderProps) {
  return (
    <>
      {topBarText && (
        <div className="bg-gray-900 text-gray-400 text-xs py-1.5 px-4 text-center">
          {topBarText}
        </div>
      )}
      <header className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: bgColor, color: textColor }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={schoolName} className="h-10" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
                {schoolName.charAt(0)}
              </div>
            )}
            <span className="font-bold text-lg hidden sm:block">{schoolName}</span>
          </div>
          <nav className="hidden lg:flex items-center gap-6">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-medium hover:opacity-80 transition-opacity">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href={ctaHref}
              className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              {ctaText}
            </a>
          </div>
        </div>
      </header>
    </>
  );
}
