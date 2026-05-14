/** Public School Homepage — SSR with ISR (revalidate every 5 minutes) */
const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://flask:5000";

async function getSchoolData(slug: string) {
  const res = await fetch(`${API_URL}/api/v1/website/public/${slug}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data;
}

type Notice = { id: string; title: string; content: string; created_at: string; category?: string };
type Teacher = { id: string; name: string; subject?: string; photo?: string; designation?: string };
type Gallery = { id: string; url: string; caption?: string };

const SERVICES = [
  {
    icon: "🖥️",
    title: "Computer Lab",
    description: "Modern computer lab with high-speed internet, networking and free Wi-Fi for all students.",
  },
  {
    icon: "📚",
    title: "Library",
    description: "Well-stocked library with textbooks, magazines, newspapers and digital resources.",
  },
  {
    icon: "🚌",
    title: "Transportation",
    description: "Safe and reliable transport facility covering all major routes in the city.",
  },
  {
    icon: "🏆",
    title: "Sports",
    description: "Students participate in inter-school and district-level sports competitions every year.",
  },
  {
    icon: "🔬",
    title: "Laboratories",
    description: "Ultra-modern physics, chemistry and biology labs with advanced equipment.",
  },
  {
    icon: "🎨",
    title: "Arts & Culture",
    description: "Rich extra-curricular activities including arts, music and cultural programs.",
  },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: d.toLocaleDateString("en", { day: "2-digit" }),
    month: d.toLocaleDateString("en", { month: "short" }).toUpperCase(),
    full: d.toLocaleDateString("en-NP", { year: "numeric", month: "long", day: "numeric" }),
  };
}

export default async function SchoolHomePage({ params }: { params: { slug: string } }) {
  const data = await getSchoolData(params.slug);
  if (!data) return <div className="p-8 text-center text-lg">School not found</div>;

  const { school, notices, teachers, gallery } = data as {
    school: Record<string, string | number>;
    notices: Notice[];
    teachers: Teacher[];
    gallery: Gallery[];
  };

  const recentNotices = (notices || []).slice(0, 6);
  const featuredTeachers = (teachers || []).slice(0, 4);
  const galleryItems = (gallery || []).slice(0, 6);

  return (
    <div>
      {/* ─── HERO ─── */}
      <section
        className="relative min-h-[420px] md:min-h-[520px] flex items-center justify-center text-center text-white overflow-hidden"
        style={{
          background: school.banner_url
            ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${school.banner_url}) center/cover no-repeat`
            : "linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary, #1e3a5f) 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute top-8 left-8 w-32 h-32 rounded-full bg-white/5 blur-xl" />
        <div className="absolute bottom-8 right-8 w-48 h-48 rounded-full bg-white/5 blur-xl" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-16">
          {school.logo_url && (
            <img
              src={school.logo_url as string}
              alt={school.name as string}
              className="h-20 w-20 rounded-full border-4 border-white/40 mx-auto mb-4 object-cover shadow-lg"
            />
          )}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {school.name as string}
          </h1>
          {school.name_nepali && (
            <p className="text-lg sm:text-xl opacity-90 mb-3" style={{ fontFamily: "var(--font-heading)" }}>
              {school.name_nepali as string}
            </p>
          )}
          <p className="text-sm sm:text-base opacity-75 mb-8">
            {school.municipality as string}, {school.district as string}
            {school.established_year_bs ? ` • Est. ${school.established_year_bs} BS` : ""}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/school/${params.slug}/admission`}
              className="px-7 py-3 rounded-lg font-semibold text-white shadow-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--color-accent, #f59e0b)" }}
            >
              Apply for Admission
            </a>
            <a
              href={`/school/${params.slug}/about`}
              className="px-7 py-3 rounded-lg font-semibold border-2 border-white/70 hover:bg-white/10 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ─── STATS BAR ─── */}
      <section className="py-0">
        <div
          className="grid grid-cols-2 md:grid-cols-4"
          style={{ backgroundColor: "var(--color-secondary, #1e3a5f)" }}
        >
          {[
            { value: school.total_students || "500+", label: "Students" },
            { value: school.total_staff || "50+", label: "Staff Members" },
            { value: "A+", label: "Grade Ranking" },
            { value: school.established_year_bs || "2050", label: "Established (BS)" },
          ].map((stat, i) => (
            <div
              key={i}
              className="text-center py-6 px-4 border-white/10"
              style={{ borderRight: i < 3 ? "1px solid rgba(255,255,255,0.1)" : undefined }}
            >
              <p className="text-2xl md:text-3xl font-bold text-white">{stat.value as string}</p>
              <p className="text-xs sm:text-sm text-white/60 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ABOUT + EVENTS/NOTICES ─── */}
      <section className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* About Us */}
        <div className="lg:col-span-2 space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
              Who We Are
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold mb-4"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
            >
              About Us
            </h2>
            <div className="w-12 h-1 rounded mb-5" style={{ backgroundColor: "var(--color-accent, #f59e0b)" }} />
          </div>

          {school.about_us ? (
            <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: school.about_us as string }}
            />
          ) : (
            <p className="text-gray-600 leading-relaxed">
              {school.name as string} is a reputed educational institution located in {school.municipality as string},{" "}
              {school.district as string}, Nepal. We are dedicated to providing quality education and holistic
              development to our students. Our school is affiliated with national education boards and offers
              programs from primary to higher secondary levels.
            </p>
          )}

          {school.vision && (
            <div className="mt-4 p-4 rounded-lg border-l-4" style={{ borderColor: "var(--color-accent, #f59e0b)", backgroundColor: "var(--color-bg, #f9f9f9)" }}>
              <p className="font-semibold text-sm mb-1" style={{ color: "var(--color-primary)" }}>Our Vision</p>
              <p className="text-sm text-gray-600">{school.vision as string}</p>
            </div>
          )}

          <a
            href={`/school/${params.slug}/about`}
            className="inline-flex items-center gap-2 text-sm font-semibold hover:gap-3 transition-all"
            style={{ color: "var(--color-primary)" }}
          >
            Read More
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Events / Notices Sidebar */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold" style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}>
              Events / Notices
            </h3>
            <a
              href={`/school/${params.slug}/notices`}
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--color-accent, #f59e0b)" }}
            >
              View All
            </a>
          </div>
          <div className="space-y-3">
            {recentNotices.length > 0 ? recentNotices.map((notice) => {
              const dt = formatDate(notice.created_at);
              return (
                <a
                  key={notice.id}
                  href={`/school/${params.slug}/notices`}
                  className="flex gap-3 p-3 rounded-lg border hover:shadow-md transition-shadow group"
                  style={{ borderColor: "var(--color-border, #e5e7eb)" }}
                >
                  <div
                    className="flex-shrink-0 w-12 text-center rounded-md py-2 text-white"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    <p className="text-lg font-bold leading-none">{dt.day}</p>
                    <p className="text-[10px] font-semibold">{dt.month}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm leading-tight line-clamp-2 group-hover:underline" style={{ color: "var(--color-text)" }}>
                      {notice.title}
                    </p>
                  </div>
                </a>
              );
            }) : (
              <p className="text-sm text-gray-500 italic">No recent notices.</p>
            )}
          </div>
        </div>
      </section>

      {/* ─── SERVICES / FACILITIES ─── */}
      <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
              What We Offer
            </p>
            <h2
              className="text-2xl sm:text-3xl font-bold"
              style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
            >
              SERVICES
            </h2>
            <div className="w-12 h-1 rounded mx-auto mt-3" style={{ backgroundColor: "var(--color-primary)" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service) => (
              <div
                key={service.title}
                className="bg-white rounded-xl p-6 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow group"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: "var(--color-secondary, #e8f0fe)" }}
                >
                  {service.icon}
                </div>
                <div>
                  <h3 className="font-bold mb-1" style={{ color: "var(--color-primary)", fontFamily: "var(--font-heading)" }}>
                    {service.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{service.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRINCIPAL'S MESSAGE + STUDENT VIEWS ─── */}
      <section className="max-w-7xl mx-auto px-4 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Principal's Message */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
            Leadership
          </p>
          <h2
            className="text-2xl font-bold mb-6"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
          >
            Message from Principal
          </h2>
          <div className="flex flex-col sm:flex-row gap-5">
            {school.principal_photo ? (
              <img
                src={school.principal_photo as string}
                alt="Principal"
                className="w-28 h-28 rounded-xl object-cover flex-shrink-0 shadow-md"
              />
            ) : (
              <div
                className="w-28 h-28 rounded-xl flex items-center justify-center text-4xl flex-shrink-0 shadow-md"
                style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}
              >
                👨‍💼
              </div>
            )}
            <div>
              <blockquote className="text-gray-600 text-sm leading-relaxed italic mb-4 border-l-4 pl-4" style={{ borderColor: "var(--color-accent, #f59e0b)" }}>
                &ldquo;{(school.principal_message as string) ||
                  "Education is not the filling of a pail, but the lighting of a fire. Our teachers are committed to inspiring students to reach their fullest potential and become responsible citizens of tomorrow."}&rdquo;
              </blockquote>
              <a
                href={`/school/${params.slug}/about`}
                className="text-xs font-semibold hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                Read More »
              </a>
              <p className="font-bold mt-3 text-sm" style={{ color: "var(--color-primary)" }}>
                {(school.principal_name as string) || "School Principal"}
              </p>
              {school.principal_designation && (
                <p className="text-xs text-gray-500">{school.principal_designation as string}</p>
              )}
            </div>
          </div>
        </div>

        {/* Student Views / Testimonials */}
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
            Student Stories
          </p>
          <h2
            className="text-2xl font-bold mb-6"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
          >
            Students&apos; Views
          </h2>
          <div className="space-y-4">
            {[
              {
                quote: "This school gave me the foundation to excel academically and personally. The teachers are truly dedicated and inspiring.",
                name: "Anita Sharma",
                title: "Grade XII Topper — Science",
                initials: "AS",
              },
              {
                quote: "The facilities and learning environment here are exceptional. I felt supported throughout my academic journey.",
                name: "Bikash Thapa",
                title: "Scholarship Winner — Management",
                initials: "BT",
              },
            ].map((t) => (
              <div key={t.name} className="flex gap-4 p-4 rounded-xl border" style={{ borderColor: "var(--color-border, #e5e7eb)" }}>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">&ldquo;{t.quote}&rdquo;</p>
                  <a
                    href={`/school/${params.slug}/about`}
                    className="text-xs font-semibold hover:underline mt-1 inline-block"
                    style={{ color: "var(--color-primary)" }}
                  >
                    Read More »
                  </a>
                  <p className="font-bold text-sm mt-1" style={{ color: "var(--color-primary)" }}>{t.name}</p>
                  <p className="text-xs text-gray-500">{t.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TEACHERS ─── */}
      {featuredTeachers.length > 0 && (
        <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
                  Our Team
                </p>
                <h2
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
                >
                  Meet Our Teachers
                </h2>
              </div>
              <a
                href={`/school/${params.slug}/teachers`}
                className="text-sm font-semibold hover:underline hidden sm:block"
                style={{ color: "var(--color-primary)" }}
              >
                View All
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              {featuredTeachers.map((teacher) => (
                <div key={teacher.id} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow text-center p-5">
                  {teacher.photo ? (
                    <img src={teacher.photo} alt={teacher.name} className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-gray-100 mb-3" />
                  ) : (
                    <div
                      className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold text-white mb-3"
                      style={{ backgroundColor: "var(--color-primary)" }}
                    >
                      {teacher.name.charAt(0)}
                    </div>
                  )}
                  <p className="font-semibold text-sm" style={{ color: "var(--color-primary)" }}>{teacher.name}</p>
                  {teacher.subject && <p className="text-xs text-gray-500 mt-0.5">{teacher.subject}</p>}
                  {teacher.designation && <p className="text-xs text-gray-400 mt-0.5">{teacher.designation}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── GALLERY PREVIEW ─── */}
      {galleryItems.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-14">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
                Memories
              </p>
              <h2
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
              >
                Photo Gallery
              </h2>
            </div>
            <a
              href={`/school/${params.slug}/gallery`}
              className="text-sm font-semibold hover:underline hidden sm:block"
              style={{ color: "var(--color-primary)" }}
            >
              View All
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {galleryItems.map((item) => (
              <a key={item.id} href={`/school/${params.slug}/gallery`} className="group overflow-hidden rounded-xl aspect-video relative">
                <img
                  src={item.url}
                  alt={item.caption || "Gallery"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {item.caption && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <p className="text-white text-xs font-medium">{item.caption}</p>
                  </div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ─── LATEST NOTICES LIST ─── */}
      {recentNotices.length > 0 && (
        <section className="py-14" style={{ backgroundColor: "var(--color-surface, #f3f4f6)" }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: "var(--color-accent, #f59e0b)" }}>
                  Updates
                </p>
                <h2
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-heading)", color: "var(--color-primary)" }}
                >
                  📢 Latest Notices
                </h2>
              </div>
              <a
                href={`/school/${params.slug}/notices`}
                className="text-sm font-semibold hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                View All
              </a>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentNotices.map((notice) => (
                <a
                  key={notice.id}
                  href={`/school/${params.slug}/notices`}
                  className="bg-white border rounded-xl p-5 hover:shadow-md transition-shadow group"
                  style={{ borderColor: "var(--color-border, #e5e7eb)" }}
                >
                  <h3 className="font-semibold text-sm mb-2 line-clamp-2 group-hover:underline" style={{ color: "var(--color-primary)" }}>
                    {notice.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {notice.content?.replace(/<[^>]*>/g, "").slice(0, 150)}
                  </p>
                  {notice.created_at && (
                    <p className="text-xs text-gray-400">{formatDate(notice.created_at).full}</p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── CTA SECTION ─── */}
      <section
        className="py-16 px-4 text-center text-white"
        style={{ backgroundColor: "var(--color-primary)" }}
      >
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-2xl sm:text-3xl font-bold mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Join Our School Community
          </h2>
          <p className="opacity-80 mb-8 text-sm sm:text-base">
            Admission is open for the upcoming academic year. Apply now to secure your spot and be part of our excellence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`/school/${params.slug}/admission`}
              className="inline-block px-8 py-3 rounded-lg font-semibold text-base hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--color-accent, #f59e0b)", color: "#fff" }}
            >
              Start Application
            </a>
            <a
              href={`/school/${params.slug}/contact`}
              className="inline-block px-8 py-3 rounded-lg font-semibold text-base border-2 border-white/60 hover:bg-white/10 transition-colors"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
