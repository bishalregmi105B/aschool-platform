"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, LogOut, Search, User, X, Check, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  formatTimeAgo,
  getCategoryIcon,
  type InAppNotification,
} from "@/lib/services/notifications.service";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function Header() {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Search logic
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/search", { params: { q: debouncedQuery, limit: 8 } });
        if (!cancelled) {
          setResults((res.data as { data: SearchResult[] }).data || []);
          setShowResults(true);
        }
      } catch {
        if (!cancelled) setResults([]);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Click outside handlers
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Poll unread count every 30s
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const count = await fetchUnreadCount();
        setUnreadCount(count);
      } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  const handleBellClick = useCallback(async () => {
    setShowNotifications((prev) => !prev);
    try {
      const notifs = await fetchNotifications({ per_page: 8 });
      setNotifications(notifs);
    } catch {}
  }, []);

  // Mark single notification as read
  const handleMarkRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b bg-card shrink-0">
      {/* Search */}
      <div ref={wrapperRef} className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students, teachers, notices..."
          className="pl-9 h-9 pr-8"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => { if (results.length) setShowResults(true); }}
        />
        {query && (
          <button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => { setQuery(""); setResults([]); }}>
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        {showResults && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
            {results.map((r) => (
              <a
                key={`${r.type}-${r.id}`}
                href={r.url}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted text-sm"
                onClick={() => setShowResults(false)}
              >
                <span className="text-xs font-medium text-muted-foreground uppercase w-16 shrink-0">
                  {r.type}
                </span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.title}</p>
                  {r.subtitle && <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
        {showResults && query.trim() && results.length === 0 && debouncedQuery === query && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50 px-3 py-4 text-sm text-muted-foreground text-center">
            No results found
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={handleBellClick}
            id="notification-bell"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-96 bg-popover border rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
                <h3 className="font-semibold text-sm">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
                        !n.is_read ? "bg-primary/5" : ""
                      }`}
                      onClick={() => {
                        if (!n.is_read) handleMarkRead(n.id);
                        if (n.action_url) {
                          window.location.href = n.action_url;
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg mt-0.5">{getCategoryIcon(n.category)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm truncate ${!n.is_read ? "font-semibold" : ""}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatTimeAgo(n.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {n.body}
                          </p>
                        </div>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <a
                href="/dashboard/notifications"
                className="block text-center py-2.5 text-xs font-medium text-primary hover:bg-muted/50 border-t"
              >
                View All Notifications
              </a>
            </div>
          )}
        </div>

        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email || user.phone}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href="/dashboard/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
