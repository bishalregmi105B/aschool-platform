"use client";

export function ContactForm() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-2xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-10 text-gray-900">Contact Us</h2>
        <form className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <input type="text" placeholder="Full Name" className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500" />
            <input type="email" placeholder="Email Address" className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500" />
          </div>
          <input type="text" placeholder="Subject" className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500" />
          <textarea rows={5} placeholder="Your Message" className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-blue-500 resize-none" />
          <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
            Send Message
          </button>
        </form>
      </div>
    </section>
  );
}
