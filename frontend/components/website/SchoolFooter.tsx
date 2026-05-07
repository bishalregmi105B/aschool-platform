"use client";

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

interface SchoolFooterProps {
  schoolName: string;
  columns?: FooterColumn[];
  address?: string;
  phone?: string;
  email?: string;
  socialLinks?: { platform: string; url: string }[];
  bgColor?: string;
  textColor?: string;
}

export function SchoolFooter({
  schoolName,
  columns = [],
  address,
  phone,
  email,
  socialLinks = [],
  bgColor = "#0f172a",
  textColor = "#94a3b8",
}: SchoolFooterProps) {
  return (
    <footer style={{ backgroundColor: bgColor, color: textColor }}>
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* School Info */}
          <div>
            <h3 className="text-white font-bold text-lg mb-4">{schoolName}</h3>
            {address && <p className="text-sm mb-2">📍 {address}</p>}
            {phone && <p className="text-sm mb-2">📞 {phone}</p>}
            {email && <p className="text-sm mb-2">📧 {email}</p>}
            {socialLinks.length > 0 && (
              <div className="flex gap-3 mt-4">
                {socialLinks.map((social) => (
                  <a key={social.platform} href={social.url} className="hover:text-white transition-colors">
                    {social.platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link Columns */}
          {columns.map((col, i) => (
            <div key={i}>
              <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-sm hover:text-white transition-colors">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 text-center text-sm">
          <p>© {new Date().getFullYear()} {schoolName}. All rights reserved.</p>
          <p className="mt-1 text-xs opacity-60">Powered by ASchool</p>
        </div>
      </div>
    </footer>
  );
}
