import axios from "axios";
import Cookies from "js-cookie";

const PLUGIN_MARKETPLACE_ALIASES: Record<string, string> = {
  communications: "sms_notifications",
  hr: "hr_payroll",
  transport: "gps_tracking",
  visitors: "visitor_management",
  library: "library_management",
  digital_content: "elibrary",
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 + token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = Cookies.get("refresh_token");

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });

          if (res.data.success) {
            const { access_token, refresh_token } = res.data.data;
            Cookies.set("access_token", access_token, { sameSite: "lax" });
            Cookies.set("refresh_token", refresh_token, { sameSite: "lax" });
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        } catch {
          // Refresh failed — force logout
          Cookies.remove("access_token");
          Cookies.remove("refresh_token");
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
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
