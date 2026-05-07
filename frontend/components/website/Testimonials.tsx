"use client";

interface TestimonialItem {
  name: string;
  role: string;
  text: string;
  avatar?: string;
}

export function Testimonials({ items = [], title = "What People Say" }: { items?: TestimonialItem[]; title?: string }) {
  const displayItems = items.length > 0 ? items : [
    { name: "Parent Name", role: "Parent of Grade 5 Student", text: "The school has transformed my child's learning experience. The teachers are dedicated and the environment is nurturing." },
    { name: "Alumni Name", role: "Class of 2020", text: "My years at this school prepared me well for college and beyond. The values I learned here still guide me." },
    { name: "Teacher Name", role: "Senior Faculty", text: "It's a privilege to teach at an institution that truly prioritizes student growth and academic excellence." },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{title}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {displayItems.map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <p className="text-gray-600 italic leading-relaxed mb-4">&ldquo;{item.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {item.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
