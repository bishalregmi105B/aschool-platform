/**
 * School Website Widget Registry
 * Defines all available section/widget types for school websites.
 * Adapted from Vexel's registry pattern for school-specific widgets.
 */
import type { SchoolWidgetDef, WidgetCategory } from "./types";

const HERO_WIDGETS: SchoolWidgetDef[] = [
  {
    type: "hero",
    name: "Hero Banner",
    icon: "🖼️",
    description: "Full-width hero with school name, subtitle and CTA buttons",
    category: "hero",
    previewGradient: "linear-gradient(135deg, #1e3a5f 0%, #2e6da4 100%)",
    defaultContent: {
      heading: "Welcome to Our School",
      subheading: "Empowering minds, shaping futures through quality education",
      cta_primary: "Apply for Admission",
      cta_secondary: "Learn More",
      bg_color: "#1e3a5f",
      text_color: "#ffffff",
      height: "520px",
      overlay_opacity: 0.55,
      show_logo: true,
      show_location: true,
    },
    controls: [
      { key: "heading", label: "Heading", type: "text", group: "content", placeholder: "Welcome to Our School" },
      { key: "subheading", label: "Subheading", type: "textarea", group: "content", placeholder: "A brief school tagline..." },
      { key: "cta_primary", label: "Primary Button Text", type: "text", group: "content" },
      { key: "cta_secondary", label: "Secondary Button Text", type: "text", group: "content" },
      { key: "bg_color", label: "Background Color", type: "color", group: "style" },
      { key: "text_color", label: "Text Color", type: "color", group: "style" },
      { key: "height", label: "Height (px or vh)", type: "text", group: "style", placeholder: "520px" },
      { key: "overlay_opacity", label: "Image Overlay Opacity", type: "number", group: "style", hint: "0 to 1 (e.g. 0.5)" },
      { key: "show_logo", label: "Show School Logo", type: "toggle", group: "content" },
      { key: "show_location", label: "Show Location", type: "toggle", group: "content" },
    ],
  },
  {
    type: "slideshow",
    name: "Hero Slideshow",
    icon: "🎞️",
    description: "Auto-playing hero slideshow with multiple slides",
    category: "hero",
    previewGradient: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    defaultContent: {
      height: "600px",
      auto_play: true,
      interval: 5000,
      overlay_opacity: 0.5,
      slides: [
        { title: "Excellence in Education", subtitle: "Building tomorrow's leaders today", image: "", cta_text: "Explore", cta_link: "#" },
        { title: "State-of-the-Art Facilities", subtitle: "Modern labs, libraries and sports grounds", image: "", cta_text: "Learn More", cta_link: "#" },
      ],
    },
    controls: [
      { key: "height", label: "Slider Height", type: "text", group: "style", placeholder: "600px" },
      { key: "auto_play", label: "Auto Play", type: "toggle", group: "advanced" },
      { key: "interval", label: "Slide Interval (ms)", type: "number", group: "advanced" },
      { key: "overlay_opacity", label: "Overlay Opacity", type: "number", group: "style" },
      { key: "slides", label: "Slides", type: "slides", group: "content" },
    ],
  },
];

const CONTENT_WIDGETS: SchoolWidgetDef[] = [
  {
    type: "about",
    name: "About Section",
    icon: "📖",
    description: "About the school with text, vision, and mission",
    category: "content",
    previewGradient: "linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)",
    defaultContent: {
      tag: "Who We Are",
      heading: "About Us",
      body: "Our school is a reputed educational institution dedicated to providing quality education and holistic development. We are committed to creating a nurturing environment where every student can thrive.",
      vision: "To be a center of excellence that nurtures holistic development and prepares students to be responsible global citizens.",
      mission: "Providing quality education with a focus on academics, character building, and co-curricular excellence.",
      show_vision: true,
      show_mission: false,
      cta_text: "Read More",
      cta_link: "/about",
      layout: "default",
    },
    controls: [
      { key: "tag", label: "Tag Line (small text)", type: "text", group: "content" },
      { key: "heading", label: "Section Heading", type: "text", group: "content" },
      { key: "body", label: "Body Text", type: "richtext", group: "content" },
      { key: "vision", label: "Vision Statement", type: "textarea", group: "content" },
      { key: "mission", label: "Mission Statement", type: "textarea", group: "content" },
      { key: "show_vision", label: "Show Vision", type: "toggle", group: "content" },
      { key: "show_mission", label: "Show Mission", type: "toggle", group: "content" },
      { key: "cta_text", label: "Button Text", type: "text", group: "content" },
      { key: "cta_link", label: "Button Link", type: "text", group: "advanced" },
      { key: "layout", label: "Layout", type: "select", group: "style", options: [
        { value: "default", label: "Default" }, { value: "split", label: "Split with Image" },
      ]},
    ],
  },
  {
    type: "stats",
    name: "Statistics Bar",
    icon: "📊",
    description: "Bold number counters: students, teachers, programs",
    category: "content",
    previewGradient: "linear-gradient(135deg, #1e3a5f 0%, #2e6da4 100%)",
    defaultContent: {
      bg_color: "#1e3a5f",
      text_color: "#ffffff",
      items: [
        { value: "500+", label: "Students" },
        { value: "50+", label: "Staff Members" },
        { value: "15+", label: "Programs" },
        { value: "2045 BS", label: "Established" },
      ],
    },
    controls: [
      { key: "bg_color", label: "Background Color", type: "color", group: "style" },
      { key: "text_color", label: "Text Color", type: "color", group: "style" },
      { key: "items", label: "Stat Items", type: "stats", group: "content", hint: "Add value + label pairs" },
    ],
  },
  {
    type: "programs",
    name: "Programs / Classes",
    icon: "🎓",
    description: "Grid of academic programs or class levels offered",
    category: "content",
    previewGradient: "linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)",
    defaultContent: {
      tag: "What We Offer",
      heading: "Academic Programs",
      columns: 3,
      items: [
        { icon: "📚", title: "Primary Level", desc: "Classes 1–5: Foundation learning with activity-based education.", color: "#dbeafe" },
        { icon: "✏️", title: "Lower Secondary", desc: "Classes 6–8: Building analytical and creative thinking.", color: "#dcfce7" },
        { icon: "🔬", title: "Secondary (SEE)", desc: "Classes 9–10: Science, Management and Humanities streams.", color: "#fef3c7" },
        { icon: "🧪", title: "Higher Secondary", desc: "Classes 11–12: Science, Management and Humanities.", color: "#fce7f3" },
      ],
    },
    controls: [
      { key: "tag", label: "Tag Line", type: "text", group: "content" },
      { key: "heading", label: "Section Heading", type: "text", group: "content" },
      { key: "columns", label: "Columns", type: "select", group: "style", options: [
        { value: "2", label: "2 Columns" }, { value: "3", label: "3 Columns" }, { value: "4", label: "4 Columns" },
      ]},
      { key: "items", label: "Program Items", type: "items", group: "content" },
    ],
  },
  {
    type: "facilities",
    name: "Facilities / Services",
    icon: "🏫",
    description: "School facilities: library, lab, sports, transport",
    category: "content",
    previewGradient: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
    defaultContent: {
      tag: "What We Offer",
      heading: "Our Facilities",
      subtitle: "Modern infrastructure designed to support every aspect of student growth",
      use_api: true,
      items: [
        { icon: "🖥️", title: "Computer Lab", desc: "Modern computer lab with high-speed internet for all students." },
        { icon: "📚", title: "Library", desc: "Well-stocked library with textbooks, magazines and digital resources." },
        { icon: "🚌", title: "Transportation", desc: "Safe and reliable transport covering all major routes in the city." },
        { icon: "🏆", title: "Sports", desc: "Students participate in inter-school sports competitions every year." },
        { icon: "🔬", title: "Science Labs", desc: "Physics, chemistry and biology labs with advanced equipment." },
        { icon: "🎨", title: "Arts & Culture", desc: "Rich extra-curricular activities including arts, music and culture." },
      ],
    },
    controls: [
      { key: "tag", label: "Tag Line", type: "text", group: "content" },
      { key: "heading", label: "Section Heading", type: "text", group: "content" },
      { key: "subtitle", label: "Subtitle", type: "textarea", group: "content" },
      { key: "use_api", label: "Load from School Settings", type: "toggle", group: "advanced", hint: "Pull facilities from Settings → Facilities" },
      { key: "items", label: "Fallback Facility Items", type: "items", group: "content" },
    ],
  },
  {
    type: "principal",
    name: "Principal's Message",
    icon: "👨‍💼",
    description: "Principal's photo and message",
    category: "content",
    previewGradient: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    defaultContent: {
      tag: "Leadership",
      heading: "Message from Principal",
      quote: "Education is not the filling of a pail, but the lighting of a fire. Our teachers are committed to inspiring students to reach their fullest potential.",
      name: "",
      designation: "Principal",
      photo: "",
      cta_text: "Read More",
      cta_link: "/about",
    },
    controls: [
      { key: "tag", label: "Tag Line", type: "text", group: "content" },
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "quote", label: "Message / Quote", type: "richtext", group: "content" },
      { key: "name", label: "Principal's Name (leave empty to auto-fill)", type: "text", group: "content" },
      { key: "designation", label: "Designation", type: "text", group: "content" },
      { key: "photo", label: "Photo URL (leave empty to auto-fill)", type: "image", group: "content" },
      { key: "cta_text", label: "Button Text", type: "text", group: "content" },
      { key: "cta_link", label: "Button Link", type: "text", group: "advanced" },
    ],
  },
  {
    type: "testimonials",
    name: "Testimonials",
    icon: "💬",
    description: "Student and parent testimonials / reviews",
    category: "content",
    previewGradient: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)",
    defaultContent: {
      tag: "Student Stories",
      heading: "What People Say",
      columns: 2,
      items: [
        {
          quote: "This school gave me the foundation to excel academically and personally. The teachers are truly dedicated.",
          name: "Anita Sharma", title: "Grade XII Topper — Science", initials: "AS",
        },
        {
          quote: "The facilities and learning environment here are exceptional. I felt supported throughout my academic journey.",
          name: "Bikash Thapa", title: "Scholarship Winner — Management", initials: "BT",
        },
      ],
    },
    controls: [
      { key: "tag", label: "Tag Line", type: "text", group: "content" },
      { key: "heading", label: "Section Heading", type: "text", group: "content" },
      { key: "columns", label: "Columns", type: "select", group: "style", options: [
        { value: "1", label: "1 Column" }, { value: "2", label: "2 Columns" }, { value: "3", label: "3 Columns" },
      ]},
      { key: "items", label: "Testimonial Items", type: "items", group: "content" },
    ],
  },
  {
    type: "gallery",
    name: "Photo Gallery",
    icon: "📸",
    description: "Grid photo gallery with hover captions",
    category: "content",
    previewGradient: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
    defaultContent: {
      tag: "Memories",
      heading: "Photo Gallery",
      use_api: true,
      columns: 3,
      max_items: 6,
      show_view_all: true,
    },
    controls: [
      { key: "tag", label: "Tag Line", type: "text", group: "content" },
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "use_api", label: "Load from Gallery API", type: "toggle", group: "advanced" },
      { key: "columns", label: "Columns", type: "select", group: "style", options: [
        { value: "2", label: "2 Columns" }, { value: "3", label: "3 Columns" }, { value: "4", label: "4 Columns" },
      ]},
      { key: "max_items", label: "Max Photos to Show", type: "number", group: "content" },
      { key: "show_view_all", label: "Show 'View All' Link", type: "toggle", group: "content" },
    ],
  },
];

const ACADEMIC_WIDGETS: SchoolWidgetDef[] = [
  {
    type: "notices",
    name: "Notices / Events",
    icon: "📢",
    description: "Latest school notices and events fetched from the system",
    category: "academic",
    previewGradient: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
    defaultContent: {
      tag: "Updates",
      heading: "Latest Notices",
      layout: "grid",
      max_items: 6,
      show_view_all: true,
      use_api: true,
    },
    controls: [
      { key: "tag", label: "Tag Line", type: "text", group: "content" },
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "layout", label: "Layout", type: "select", group: "style", options: [
        { value: "grid", label: "Grid Cards" }, { value: "list", label: "Date List" }, { value: "sidebar", label: "Sidebar List" },
      ]},
      { key: "max_items", label: "Max Notices to Show", type: "number", group: "content" },
      { key: "show_view_all", label: "Show 'View All' Link", type: "toggle", group: "content" },
    ],
  },
  {
    type: "teachers",
    name: "Teacher Grid",
    icon: "👩‍🏫",
    description: "Showcase featured teachers with photo, name, subject",
    category: "academic",
    previewGradient: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)",
    defaultContent: {
      tag: "Our Team",
      heading: "Meet Our Teachers",
      max_items: 4,
      use_api: true,
      show_view_all: true,
    },
    controls: [
      { key: "tag", label: "Tag Line", type: "text", group: "content" },
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "max_items", label: "Max Teachers to Show", type: "number", group: "content" },
      { key: "use_api", label: "Load from Staff API", type: "toggle", group: "advanced" },
      { key: "show_view_all", label: "Show 'View All' Link", type: "toggle", group: "content" },
    ],
  },
  {
    type: "results",
    name: "Result Checker",
    icon: "📝",
    description: "Result lookup form for students/parents",
    category: "academic",
    previewGradient: "linear-gradient(135deg, #f0f9ff 0%, #bae6fd 100%)",
    defaultContent: {
      heading: "Check Your Result",
      subtitle: "Enter your roll number and year to view your result",
      button_text: "Check Result",
    },
    controls: [
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "subtitle", label: "Subtitle", type: "textarea", group: "content" },
      { key: "button_text", label: "Button Text", type: "text", group: "content" },
    ],
  },
];

const LAYOUT_WIDGETS: SchoolWidgetDef[] = [
  {
    type: "spacer",
    name: "Spacer",
    icon: "↕️",
    description: "Add vertical space between sections",
    category: "layout",
    previewGradient: "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)",
    defaultContent: { height: "64px", bg_color: "" },
    controls: [
      { key: "height", label: "Height", type: "text", group: "style", placeholder: "64px" },
      { key: "bg_color", label: "Background Color", type: "color", group: "style" },
    ],
  },
  {
    type: "divider",
    name: "Section Divider",
    icon: "─",
    description: "Decorative horizontal divider",
    category: "layout",
    previewGradient: "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)",
    defaultContent: { style: "line", color: "#e5e7eb", width: "full" },
    controls: [
      { key: "style", label: "Style", type: "select", group: "style", options: [
        { value: "line", label: "Line" }, { value: "dots", label: "Dots" }, { value: "wave", label: "Wave" },
      ]},
      { key: "color", label: "Color", type: "color", group: "style" },
      { key: "width", label: "Width", type: "select", group: "style", options: [
        { value: "full", label: "Full Width" }, { value: "contained", label: "Contained" },
      ]},
    ],
  },
  {
    type: "map",
    name: "Location Map",
    icon: "📍",
    description: "Embedded Google Maps or location info",
    category: "layout",
    previewGradient: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
    defaultContent: {
      heading: "Find Us",
      embed_url: "",
      address: "",
      phone: "",
      email: "",
      show_contact_info: true,
    },
    controls: [
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "embed_url", label: "Google Maps Embed URL", type: "text", group: "content", hint: "Paste the <iframe src= URL from Google Maps" },
      { key: "address", label: "Address Text", type: "text", group: "content" },
      { key: "phone", label: "Phone", type: "text", group: "content" },
      { key: "email", label: "Email", type: "text", group: "content" },
      { key: "show_contact_info", label: "Show Contact Info", type: "toggle", group: "content" },
    ],
  },
];

const CTA_WIDGETS: SchoolWidgetDef[] = [
  {
    type: "cta",
    name: "Call to Action",
    icon: "📣",
    description: "Prominent CTA banner encouraging admission or contact",
    category: "cta",
    previewGradient: "linear-gradient(135deg, #1e3a5f 0%, #2e6da4 100%)",
    defaultContent: {
      heading: "Join Our School Community",
      body: "Admission is open for the upcoming academic year. Apply now to secure your spot.",
      cta_primary: "Start Application",
      cta_primary_link: "/admission",
      cta_secondary: "Contact Us",
      cta_secondary_link: "/contact",
      bg_color: "#1e3a5f",
      text_color: "#ffffff",
    },
    controls: [
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "body", label: "Body Text", type: "textarea", group: "content" },
      { key: "cta_primary", label: "Primary Button Text", type: "text", group: "content" },
      { key: "cta_primary_link", label: "Primary Button Link", type: "text", group: "advanced" },
      { key: "cta_secondary", label: "Secondary Button Text", type: "text", group: "content" },
      { key: "cta_secondary_link", label: "Secondary Button Link", type: "text", group: "advanced" },
      { key: "bg_color", label: "Background Color", type: "color", group: "style" },
      { key: "text_color", label: "Text Color", type: "color", group: "style" },
    ],
  },
  {
    type: "contact",
    name: "Contact Section",
    icon: "📞",
    description: "Contact form with school info",
    category: "cta",
    previewGradient: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    defaultContent: {
      heading: "Get In Touch",
      subtitle: "Have questions? We'd love to hear from you.",
      show_form: true,
      show_map: false,
      embed_url: "",
    },
    controls: [
      { key: "heading", label: "Heading", type: "text", group: "content" },
      { key: "subtitle", label: "Subtitle", type: "textarea", group: "content" },
      { key: "show_form", label: "Show Contact Form", type: "toggle", group: "content" },
      { key: "show_map", label: "Show Map", type: "toggle", group: "content" },
      { key: "embed_url", label: "Map Embed URL", type: "text", group: "advanced" },
    ],
  },
];

export const ALL_WIDGETS: SchoolWidgetDef[] = [
  ...HERO_WIDGETS,
  ...CONTENT_WIDGETS,
  ...ACADEMIC_WIDGETS,
  ...LAYOUT_WIDGETS,
  ...CTA_WIDGETS,
];

export const WIDGET_MAP: Record<string, SchoolWidgetDef> = Object.fromEntries(
  ALL_WIDGETS.map((w) => [w.type, w])
);

export const CATEGORIES: { key: WidgetCategory; label: string; icon: string }[] = [
  { key: "hero", label: "Hero", icon: "🖼️" },
  { key: "content", label: "Content", icon: "📄" },
  { key: "academic", label: "Academic", icon: "🎓" },
  { key: "layout", label: "Layout", icon: "⬜" },
  { key: "cta", label: "CTA", icon: "📣" },
];

export function getWidgetsByCategory(category: WidgetCategory): SchoolWidgetDef[] {
  return ALL_WIDGETS.filter((w) => w.category === category);
}

export function getWidgetDef(type: string): SchoolWidgetDef | undefined {
  return WIDGET_MAP[type];
}
