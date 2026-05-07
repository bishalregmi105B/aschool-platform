"use client";

export function EventCalendar({ events = [] }: { events?: { title: string; date: string; time?: string }[] }) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">Upcoming Events</h2>
        {events.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No upcoming events published.</div>
        ) : (
          <div className="space-y-4">
            {events.map((event, i) => (
            <div key={i} className="bg-white rounded-xl p-5 flex items-center gap-6 shadow-sm border border-gray-100">
              <div className="text-center bg-blue-50 rounded-lg px-4 py-2 min-w-[70px]">
                <div className="text-2xl font-bold text-blue-600">{new Date(event.date).getDate()}</div>
                <div className="text-xs text-blue-500 uppercase">{new Date(event.date).toLocaleString("default", { month: "short" })}</div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{event.title}</h3>
                {event.time && <p className="text-sm text-gray-500">Time: {event.time}</p>}
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
