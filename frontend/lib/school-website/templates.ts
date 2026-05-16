/**
 * School Website Template Presets
 * Three ready-made page layouts inspired by the HTML templates in templates_demo/.
 * Each template can be applied via the themes picker → one-click applies all sections.
 */
import type { SchoolTemplate } from "./types";

/** Template 1 — Classic Blue
 * Inspired by: templates_demo/GGCOkara.github.io-main
 * Professional, rich blue color scheme with full feature set.
 */
export const TEMPLATE_CLASSIC_BLUE: SchoolTemplate = {
  id: "classic-blue",
  name: "Classic Blue",
  description: "Professional blue design with slideshow, stats, programs, notices and gallery",
  emoji: "🔵",
  category: "classic",
  tags: ["professional", "blue", "full-featured", "notices"],
  colorScheme: {
    primary: "#1e3a5f",
    secondary: "#2e6da4",
    accent: "#f59e0b",
    bg: "#ffffff",
    surface: "#f3f4f6",
    text: "#111827",
  },
  sections: [
    {
      type: "slideshow",
      title: "Hero Slideshow",
      sort_order: 0,
      content: {
        height: "600px",
        auto_play: true,
        interval: 5000,
        overlay_opacity: 0.5,
        slides: [
          { title: "Welcome to Our School", subtitle: "Excellence in Education Since 2045 BS", image: "", cta_text: "Apply Now", cta_link: "/admission" },
          { title: "Holistic Development", subtitle: "Academics · Sports · Arts · Technology", image: "", cta_text: "Explore", cta_link: "#programs" },
          { title: "Building Tomorrow's Leaders", subtitle: "Join our vibrant learning community", image: "", cta_text: "Learn More", cta_link: "/about" },
        ],
      },
    },
    {
      type: "stats",
      title: "Statistics",
      sort_order: 1,
      content: {
        bg_color: "#1e3a5f",
        text_color: "#ffffff",
        items: [
          { value: "1000+", label: "Students" },
          { value: "60+", label: "Staff Members" },
          { value: "A++", label: "HSEB Grade" },
          { value: "2045 BS", label: "Established" },
        ],
      },
    },
    {
      type: "about",
      title: "About Section",
      sort_order: 2,
      content: {
        tag: "Who We Are",
        heading: "About Our School",
        body: "We are a premier educational institution committed to academic excellence and character development. Our school provides a nurturing environment where students discover their potential and grow into responsible citizens.",
        vision: "To be the leading school that inspires lifelong learning and leadership.",
        show_vision: true,
        show_mission: false,
        cta_text: "Read More",
        cta_link: "/about",
        layout: "default",
      },
    },
    {
      type: "notices",
      title: "Latest Notices",
      sort_order: 3,
      content: {
        tag: "Updates",
        heading: "Events & Notices",
        layout: "sidebar",
        max_items: 6,
        show_view_all: true,
        use_api: true,
      },
    },
    {
      type: "programs",
      title: "Academic Programs",
      sort_order: 4,
      content: {
        tag: "What We Offer",
        heading: "Academic Programs",
        columns: 4,
        items: [
          { icon: "📚", title: "Primary Level", desc: "Classes 1–5: Foundation learning with activity-based education.", color: "#dbeafe" },
          { icon: "✏️", title: "Lower Secondary", desc: "Classes 6–8: Building analytical and creative thinking skills.", color: "#dcfce7" },
          { icon: "🔬", title: "Secondary (SEE)", desc: "Classes 9–10: Preparing students for national examinations.", color: "#fef3c7" },
          { icon: "🧪", title: "Higher Secondary", desc: "Classes 11–12: Science, Management and Humanities streams.", color: "#fce7f3" },
        ],
      },
    },
    {
      type: "teachers",
      title: "Our Teachers",
      sort_order: 5,
      content: {
        tag: "Our Team",
        heading: "Meet Our Teachers",
        max_items: 4,
        use_api: true,
        show_view_all: true,
      },
    },
    {
      type: "gallery",
      title: "Photo Gallery",
      sort_order: 6,
      content: {
        tag: "Memories",
        heading: "Photo Gallery",
        use_api: true,
        columns: 3,
        max_items: 6,
        show_view_all: true,
      },
    },
    {
      type: "cta",
      title: "Call to Action",
      sort_order: 7,
      content: {
        heading: "Join Our School Community",
        body: "Admission is open for the upcoming academic year. Apply now to secure your spot and be part of our family.",
        cta_primary: "Start Application",
        cta_primary_link: "/admission",
        cta_secondary: "Contact Us",
        cta_secondary_link: "/contact",
        bg_color: "#1e3a5f",
        text_color: "#ffffff",
      },
    },
  ],
};

/** Template 2 — Modern Minimal
 * Inspired by: templates_demo/School-Profile-Website-main
 * Clean, contemporary design with focus on programs and testimonials.
 */
export const TEMPLATE_MODERN_MINIMAL: SchoolTemplate = {
  id: "modern-minimal",
  name: "Modern Minimal",
  description: "Clean contemporary layout with hero, programs, testimonials and contact",
  emoji: "⚪",
  category: "modern",
  tags: ["minimal", "modern", "clean", "programs"],
  colorScheme: {
    primary: "#0f766e",
    secondary: "#134e4a",
    accent: "#f59e0b",
    bg: "#ffffff",
    surface: "#f0fdfa",
    text: "#0f172a",
  },
  sections: [
    {
      type: "hero",
      title: "Hero Banner",
      sort_order: 0,
      content: {
        heading: "Quality Education for Every Child",
        subheading: "We believe every student deserves the best start in life. Join our community of learners.",
        cta_primary: "Apply for Admission",
        cta_secondary: "Learn More",
        bg_color: "#0f766e",
        text_color: "#ffffff",
        height: "580px",
        overlay_opacity: 0.6,
        show_logo: true,
        show_location: true,
      },
    },
    {
      type: "about",
      title: "About Section",
      sort_order: 1,
      content: {
        tag: "Our Story",
        heading: "About Us",
        body: "Founded with a vision to provide world-class education in Nepal, our school has been nurturing bright minds for over two decades. We combine traditional values with modern pedagogy.",
        vision: "Empowering every student to achieve excellence in academics and life.",
        show_vision: true,
        show_mission: true,
        mission: "Creating a safe, inclusive and stimulating environment where students develop intellectually, socially and morally.",
        cta_text: "Our Full Story",
        cta_link: "/about",
        layout: "split",
      },
    },
    {
      type: "stats",
      title: "Statistics",
      sort_order: 2,
      content: {
        bg_color: "#0f766e",
        text_color: "#ffffff",
        items: [
          { value: "800+", label: "Students" },
          { value: "45+", label: "Teachers" },
          { value: "98%", label: "Pass Rate" },
          { value: "15+", label: "Years of Excellence" },
        ],
      },
    },
    {
      type: "programs",
      title: "Programs",
      sort_order: 3,
      content: {
        tag: "Our Curriculum",
        heading: "Programs We Offer",
        columns: 3,
        items: [
          { icon: "🌱", title: "Early Childhood", desc: "Nurturing kindergarten program for ages 3–5.", color: "#d1fae5" },
          { icon: "📐", title: "Primary Education", desc: "Strong foundations in literacy, numeracy and science.", color: "#cffafe" },
          { icon: "🔭", title: "Secondary & SEE", desc: "Comprehensive preparation for national board exams.", color: "#ede9fe" },
        ],
      },
    },
    {
      type: "notices",
      title: "Notices",
      sort_order: 4,
      content: {
        tag: "Stay Updated",
        heading: "Latest Notices",
        layout: "grid",
        max_items: 6,
        show_view_all: true,
        use_api: true,
      },
    },
    {
      type: "gallery",
      title: "Gallery",
      sort_order: 5,
      content: {
        tag: "School Life",
        heading: "Campus & Activities",
        use_api: true,
        columns: 3,
        max_items: 6,
        show_view_all: true,
      },
    },
    {
      type: "testimonials",
      title: "Testimonials",
      sort_order: 6,
      content: {
        tag: "Student Stories",
        heading: "What People Say",
        columns: 2,
        items: [
          { quote: "The teachers here truly care about every student. My child has grown so much academically and as a person.", name: "Sunita Gurung", title: "Parent of Class 8 Student", initials: "SG" },
          { quote: "Winning the district merit scholarship was a dream come true, made possible by the dedication of my teachers.", name: "Roshan Karki", title: "Merit Scholarship Recipient", initials: "RK" },
        ],
      },
    },
    {
      type: "cta",
      title: "Admission CTA",
      sort_order: 7,
      content: {
        heading: "Ready to Join Our School?",
        body: "Admissions are open. Limited seats available. Apply today.",
        cta_primary: "Apply Now",
        cta_primary_link: "/admission",
        cta_secondary: "Book a Visit",
        cta_secondary_link: "/contact",
        bg_color: "#0f766e",
        text_color: "#ffffff",
      },
    },
  ],
};

/** Template 3 — Traditional Nepali
 * Inspired by: templates_demo/PrabhawatiVidyaPeeth-master
 * Warm, traditional feel with principal message, facilities and cultural focus.
 */
export const TEMPLATE_TRADITIONAL: SchoolTemplate = {
  id: "traditional",
  name: "Traditional",
  description: "Warm traditional layout with principal message, facilities and cultural heritage",
  emoji: "🏛️",
  category: "traditional",
  tags: ["traditional", "warm", "principal", "heritage"],
  colorScheme: {
    primary: "#7c2d12",
    secondary: "#9a3412",
    accent: "#d97706",
    bg: "#fffbeb",
    surface: "#fef3c7",
    text: "#1c1917",
  },
  sections: [
    {
      type: "hero",
      title: "Hero Banner",
      sort_order: 0,
      content: {
        heading: "श्री विद्यापीठ माध्यमिक विद्यालय",
        subheading: "Imparting knowledge rooted in our cultural heritage — shaping tomorrow's leaders today",
        cta_primary: "प्रवेश अनुरोध",
        cta_secondary: "हाम्रो बारे",
        bg_color: "#7c2d12",
        text_color: "#ffffff",
        height: "540px",
        overlay_opacity: 0.6,
        show_logo: true,
        show_location: true,
      },
    },
    {
      type: "stats",
      title: "Statistics",
      sort_order: 1,
      content: {
        bg_color: "#7c2d12",
        text_color: "#ffffff",
        items: [
          { value: "1200+", label: "विद्यार्थीहरू" },
          { value: "70+", label: "शिक्षकहरू" },
          { value: "A+", label: "राष्ट्रिय ग्रेड" },
          { value: "2035 BS", label: "स्थापना वर्ष" },
        ],
      },
    },
    {
      type: "about",
      title: "About Section",
      sort_order: 2,
      content: {
        tag: "हाम्रो परिचय",
        heading: "विद्यालयको बारेमा",
        body: "हाम्रो विद्यालय नेपालको शैक्षिक परम्परालाई सम्मान गर्दै आधुनिक शिक्षाको अभ्यास गर्छ। हामी विद्यार्थीहरूको सर्वाङ्गीण विकासमा विश्वास गर्छौं।",
        vision: "ज्ञान, संस्कार र सेवाद्वारा उत्कृष्ट नागरिक निर्माण गर्नु।",
        show_vision: true,
        show_mission: false,
        cta_text: "थप पढ्नुहोस्",
        cta_link: "/about",
        layout: "default",
      },
    },
    {
      type: "principal",
      title: "Principal's Message",
      sort_order: 3,
      content: {
        tag: "नेतृत्व सन्देश",
        heading: "प्रधानाध्यापकको सन्देश",
        quote: "शिक्षा भनेको बालटिन भर्ने काम होइन, आगो बाल्ने काम हो। हाम्रा शिक्षकहरू विद्यार्थीहरूलाई उनीहरूको सर्वोच्च क्षमतामा पुग्न प्रेरित गर्न प्रतिबद्ध छन्।",
        name: "",
        designation: "प्रधानाध्यापक",
        photo: "",
        cta_text: "थप पढ्नुहोस्",
        cta_link: "/about",
      },
    },
    {
      type: "programs",
      title: "Programs",
      sort_order: 4,
      content: {
        tag: "हाम्रा कक्षाहरू",
        heading: "शैक्षिक कार्यक्रम",
        columns: 4,
        items: [
          { icon: "🌸", title: "प्राथमिक तह", desc: "कक्षा १–५: आधारभूत शिक्षा", color: "#fce7f3" },
          { icon: "📚", title: "निम्न माध्यमिक", desc: "कक्षा ६–८: विश्लेषणात्मक सोच", color: "#fef3c7" },
          { icon: "🏫", title: "माध्यमिक (SEE)", desc: "कक्षा ९–१०: राष्ट्रिय परीक्षा", color: "#dbeafe" },
          { icon: "🎓", title: "उच्च माध्यमिक", desc: "कक्षा ११–१२: विज्ञान, व्यवस्थापन", color: "#dcfce7" },
        ],
      },
    },
    {
      type: "facilities",
      title: "Facilities",
      sort_order: 5,
      content: {
        tag: "हाम्रा सुविधाहरू",
        heading: "विद्यालयका सुविधाहरू",
        subtitle: "विद्यार्थीहरूको सर्वाङ्गीण विकासका लागि आधुनिक पूर्वाधार",
        use_api: true,
        items: [],
      },
    },
    {
      type: "notices",
      title: "Notices",
      sort_order: 6,
      content: {
        tag: "सूचनाहरू",
        heading: "ताजा सूचनाहरू",
        layout: "list",
        max_items: 8,
        show_view_all: true,
        use_api: true,
      },
    },
    {
      type: "gallery",
      title: "Gallery",
      sort_order: 7,
      content: {
        tag: "तस्बिरहरू",
        heading: "फोटो ग्यालेरी",
        use_api: true,
        columns: 4,
        max_items: 8,
        show_view_all: true,
      },
    },
    {
      type: "testimonials",
      title: "Testimonials",
      sort_order: 8,
      content: {
        tag: "विद्यार्थीका अनुभव",
        heading: "के भन्छन् हाम्रा विद्यार्थी",
        columns: 2,
        items: [
          { quote: "यो विद्यालयले मलाई जीवनमा सफल हुन आवश्यक आधार दियो। शिक्षकहरू साँच्चिकै समर्पित छन्।", name: "सीता देवी", title: "कक्षा १२ विज्ञान — स्वर्ण पदक", initials: "सी" },
          { quote: "यहाँको शिक्षाको वातावरण उत्कृष्ट छ। मैले यहाँ पढेर जिल्लातहको छात्रवृत्ति पाएँ।", name: "रमेश थापा", title: "छात्रवृत्ति विजेता", initials: "र" },
        ],
      },
    },
    {
      type: "cta",
      title: "Admission CTA",
      sort_order: 9,
      content: {
        heading: "हाम्रो विद्यालय परिवारमा जोडिनुहोस्",
        body: "नयाँ शैक्षिक वर्षको लागि प्रवेश खुला छ। आजै आवेदन दिनुहोस् र हाम्रो उत्कृष्टताको यात्रामा सहभागी हुनुहोस्।",
        cta_primary: "प्रवेशपत्र भर्नुहोस्",
        cta_primary_link: "/admission",
        cta_secondary: "सम्पर्क गर्नुहोस्",
        cta_secondary_link: "/contact",
        bg_color: "#7c2d12",
        text_color: "#ffffff",
      },
    },
  ],
};

export const ALL_TEMPLATES: SchoolTemplate[] = [
  TEMPLATE_CLASSIC_BLUE,
  TEMPLATE_MODERN_MINIMAL,
  TEMPLATE_TRADITIONAL,
];

export function getTemplate(id: string): SchoolTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}
