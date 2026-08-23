export type PortalName = "parent" | "student" | "teacher";

interface PortalRouteMeta {
  title: string;
  description: string;
  guidance: string;
}

const PORTAL_HOME: Record<PortalName, string> = {
  parent: "/parent",
  student: "/student",
  teacher: "/teacher",
};

const PORTAL_ROUTE_META: Record<PortalName, Record<string, PortalRouteMeta>> = {
  parent: {
    attendance: {
      title: "Attendance",
      description: "Review your child attendance updates and daily presence status.",
      guidance: "This section is coming soon to the web portal. The ASchool parent app already covers it today.",
    },
    results: {
      title: "Results",
      description: "Check examination outcomes and progress updates for your child.",
      guidance: "Result summaries remain available from the parent dashboard and mobile app during the web rollout.",
    },
    fees: {
      title: "Fees",
      description: "Track fee status, due balances, and collection activity.",
      guidance: "This section is coming soon to the web portal. The ASchool parent app already covers fee payment today.",
    },
    notices: {
      title: "Notices",
      description: "Read school announcements and shared updates for guardians.",
      guidance: "This section is coming soon to the web portal. Notices are available on the dashboard meanwhile.",
    },
    bus: {
      title: "Bus Tracker",
      description: "Follow transport updates and route movement for your child.",
      guidance: "Transport tracking is being connected to the web portal. Use the mobile workflow for live tracking in the meantime.",
    },
    chat: {
      title: "Messages",
      description: "Send and receive school communication from one place.",
      guidance: "Messaging is still being wired into the parent web portal. Portal home remains available for other actions.",
    },
  },
  student: {
    timetable: {
      title: "Timetable",
      description: "See class periods and weekly schedule information.",
      guidance: "Student dashboard remains the quickest way to reach active school data while this section is being connected.",
    },
    homework: {
      title: "Homework",
      description: "Review homework tasks, due dates, and class assignments.",
      guidance: "This section is coming soon to the student web portal.",
    },
    results: {
      title: "Results",
      description: "Check exam results, grades, and academic progress.",
      guidance: "Result access is being aligned with the broader exam workflow. Use your dashboard for the latest overview in the meantime.",
    },
    library: {
      title: "Library",
      description: "Browse books, issue history, and library activity.",
      guidance: "Library features are still being connected for student web access. The route now remains available instead of failing.",
    },
    lms: {
      title: "LMS",
      description: "Access lessons, digital content, and course activity.",
      guidance: "Learning resources are continuing to move into the student portal experience. Return to your dashboard for the current entry points.",
    },
    "ai-tutor": {
      title: "AI Tutor",
      description: "Open guided study help and AI-assisted learning support.",
      guidance: "The AI study workflow is still being integrated into the student web portal. This route is now registered so it no longer returns a not-found page.",
    },
  },
  teacher: {
    attendance: {
      title: "Attendance",
      description: "Manage daily attendance and monitor class presence.",
      guidance: "Teacher web attendance tools are being connected to this portal route. Use the main teaching workflows for current operations.",
    },
    marks: {
      title: "Marks",
      description: "Enter and review student marks and assessment records.",
      guidance: "This section is coming soon to the teacher web portal. Marks entry lives in the Exams module meanwhile.",
    },
    assignments: {
      title: "Assignments",
      description: "Publish classwork, homework, and assignment updates.",
      guidance: "Assignment workflow integration is still in progress across backend, web, and apps. This route now resolves without a 404 while that work lands.",
    },
    timetable: {
      title: "Timetable",
      description: "Check your assigned periods and schedule plan.",
      guidance: "Timetable details remain available through the existing teacher workflows while this portal section is completed.",
    },
    notices: {
      title: "Notices",
      description: "Review notices and announcements shared with staff.",
      guidance: "Staff notices are still being consolidated into the teacher portal. The section now has a stable route for navigation.",
    },
    "ai-tools": {
      title: "AI Tools",
      description: "Open AI-assisted teaching tools and planning helpers.",
      guidance: "This section is coming soon to the teacher web portal. AI tools live in the main dashboard meanwhile.",
    },
  },
};

export function isKnownPortalRoute(portal: PortalName, slug: string) {
  return Boolean(PORTAL_ROUTE_META[portal][slug]);
}

export function getPortalRouteMeta(
  portal: PortalName,
  slug: string,
): PortalRouteMeta {
  return PORTAL_ROUTE_META[portal][slug];
}

export function getPortalHomeHref(portal: PortalName) {
  return PORTAL_HOME[portal];
}