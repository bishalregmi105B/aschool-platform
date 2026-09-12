"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Bell, Clock } from "lucide-react";
import { useServerTime } from "@/lib/use-server-time";

interface CalendarFlyoutProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

export default function CalendarFlyout({
  isOpen,
  onClose,
  accentColor = "#0078d4",
}: CalendarFlyoutProps) {
  const serverTime = useServerTime();

  const serverDate = useMemo(() => {
    return serverTime ? new Date(serverTime.epochMs) : new Date();
  }, [serverTime]);

  const [currentDate, setCurrentDate] = useState<Date>(serverDate);

  // Sync viewed date with authoritative server time on initial load
  useEffect(() => {
    if (serverTime) {
      setCurrentDate(new Date(serverTime.epochMs));
    }
  }, [serverTime]);

  if (!isOpen) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const isCurrentMonth =
    serverDate.getFullYear() === year && serverDate.getMonth() === month;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9998,
        }}
      />

      <div
        style={{
          position: "fixed",
          bottom: "56px",
          right: "12px",
          width: "360px",
          background: "var(--w11-surface-flyout)",
          backdropFilter: "blur(30px) saturate(180%)",
          WebkitBackdropFilter: "blur(30px) saturate(180%)",
          border: "1px solid var(--w11-acrylic-border)",
          borderRadius: "12px",
          boxShadow: "0 16px 40px rgba(0, 0, 0, 0.35)",
          padding: "16px",
          zIndex: 9999,
          userSelect: "none",
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Notifications Section */}
        <div style={{ marginBottom: "16px", borderBottom: "1px solid var(--w11-control-border)", paddingBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--w11-text-primary)" }}>Academic Alerts</span>
            <button style={{ all: "unset", fontSize: "11px", color: accentColor, cursor: "pointer" }}>
              Clear all
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                background: "var(--w11-control-bg)",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <Bell size={14} color={accentColor} style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--w11-text-primary)" }}>Dr. Robert Henderson (PHY-302)</div>
                <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>Problem Set 4 solutions uploaded to Library Vault.</div>
              </div>
            </div>
            <div
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                background: "var(--w11-control-bg)",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
              }}
            >
              <Bell size={14} color="#10b981" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--w11-text-primary)" }}>Academic Registrar</div>
                <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>Midterm Exam Seat Allotment: Desk B-14 confirmed.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Date Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
            {monthNames[month]} {year}
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={handlePrevMonth}
              style={{
                all: "unset",
                width: "26px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                cursor: "pointer",
                color: "var(--w11-text-primary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              style={{
                all: "unset",
                width: "26px",
                height: "26px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "4px",
                cursor: "pointer",
                color: "var(--w11-text-primary)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--w11-control-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Calendar Weekday Names */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: "6px", fontSize: "11px", fontWeight: 600, color: "var(--w11-text-secondary)" }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", textAlign: "center", fontSize: "12px" }}>
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const isToday = isCurrentMonth && serverDate.getDate() === dayNum;
            return (
              <div
                key={dayNum}
                style={{
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  cursor: "pointer",
                  color: isToday ? "#ffffff" : "var(--w11-text-primary)",
                  background: isToday ? accentColor : "transparent",
                  fontWeight: isToday ? "bold" : "normal",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isToday) e.currentTarget.style.backgroundColor = "var(--w11-control-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isToday) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {dayNum}
              </div>
            );
          })}
        </div>

        {/* Focus Session Button */}
        <div style={{ marginTop: "14px", paddingTop: "10px", borderTop: "1px solid var(--w11-control-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--w11-text-primary)" }}>
            <Clock size={14} color={accentColor} />
            <span>Focus session: 30 min</span>
          </div>
          <button className="win11-btn accent" style={{ padding: "4px 10px", fontSize: "11px", cursor: "pointer" }}>
            Start
          </button>
        </div>
      </div>
    </>
  );
}
