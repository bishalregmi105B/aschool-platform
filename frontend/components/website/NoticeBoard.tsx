"use client";

interface NoticeItem {
  title: string;
  date: string;
  category?: string;
  href: string;
}

interface NoticeBoardProps {
  title?: string;
  notices?: NoticeItem[];
  count?: number;
}

export function NoticeBoard({
  title = "Latest Notices",
  notices = [],
  count = 5,
}: NoticeBoardProps) {
  const displayNotices = notices.slice(0, count);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">{title}</h2>
        {displayNotices.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No notices published.</div>
        ) : (
          <div className="space-y-0 divide-y divide-gray-100">
            {displayNotices.map((notice, i) => (
              <a
                key={i}
                href={notice.href}
                className="flex items-center justify-between py-4 px-4 hover:bg-blue-50 rounded-lg transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {notice.title}
                    </h3>
                    {notice.category && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {notice.category}
                      </span>
                    )}
                  </div>
                </div>
                <time className="text-sm text-gray-400 flex-shrink-0">{notice.date}</time>
              </a>
            ))}
          </div>
        )}
        {displayNotices.length > 0 && (
          <div className="text-center mt-8">
            <a href="/notices" className="text-blue-600 font-medium hover:underline">
              View All Notices
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
