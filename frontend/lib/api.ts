import axios from "axios";

const PLUGIN_MARKETPLACE_ALIASES: Record<string, string> = {
  communications: "sms_notifications",
  hr: "hr_payroll",
  transport: "gps_tracking",
  visitors: "visitor_management",
  library: "library_management",
  digital_content: "elibrary",
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
  // Session tokens live in HttpOnly cookies set by the backend (/auth/*).
  // Same registrable domain (app.* -> api.*) so cookies ride along on XHR.
  withCredentials: true,
});

// Response interceptor: handle 401 + cookie-based token refresh
let refreshInFlight: Promise<unknown> | null = null;

async function refreshSession(): Promise<boolean> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      null,
      { withCredentials: true }
    );
    return res.data?.success === true;
  } catch {
    return false;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!refreshInFlight) {
        refreshInFlight = refreshSession().finally(() => {
          refreshInFlight = null;
        });
      }

      const refreshed = await refreshInFlight;
      if (refreshed) {
        return api(originalRequest);
      }

      // Refresh failed — session is over
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    // Handle missing plugin errors globally
    if (error.response?.status === 403 && error.response.data?.data?.plugin_slug) {
      const pluginData = error.response.data.data;
      import("sonner").then(({ toast }) => {
        toast.error(`Plugin Required`, {
          description: error.response.data.error || pluginData.message,
          action: {
            label: "Activate Plugin",
            onClick: () => {
              if (typeof window !== "undefined") {
                // Since dynamic /marketplace/[slug] routes don't exist, we send them to the main marketplace.
                const slug =
                  PLUGIN_MARKETPLACE_ALIASES[pluginData.plugin_slug] ||
                  pluginData.plugin_slug;
                window.location.href = `/dashboard/marketplace?search=${encodeURIComponent(slug)}`;
              }
            }
          },
          duration: 10000,
        });
      });
    }

    return Promise.reject(error);
  }
);

// Typed API response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error: string | { code: string; message: string; details?: unknown } | null;
  meta: {
    pagination?: {
      total: number;
      page: number;
      per_page: number;
      pages: number;
      has_next: boolean;
      has_prev: boolean;
    };
  };
}
