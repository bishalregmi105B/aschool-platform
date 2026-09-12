"use client";

import React, { useState } from "react";
import { GraduationCap, Clock, CheckSquare, Utensils, X, Plus, AlertCircle } from "lucide-react";

interface WidgetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accentColor?: string;
}

export default function WidgetsPanel({
  isOpen,
  onClose,
  accentColor = "#0078d4",
}: WidgetsPanelProps) {
  const [todos, setTodos] = useState([
    { id: 1, text: "Solve Wave Mechanics exercises 4.2 & 4.8", done: true, due: "Today" },
    { id: 2, text: "Submit Chemistry Lab titration report", done: false, due: "Tomorrow" },
    { id: 3, text: "Review Algorithms dynamic programming binder", done: false, due: "Thu" },
    { id: 4, text: "Consult Prof. Henderson on Quantum tunneling", done: false, due: "Fri" },
  ]);
  const [newTodo, setNewTodo] = useState("");

  if (!isOpen) return null;

  const toggleTodo = (id: number) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo.trim(), done: false, due: "Pending" }]);
    setNewTodo("");
  };

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
          top: "12px",
          left: "12px",
          bottom: "60px",
          width: "480px",
          maxWidth: "92vw",
          background: "var(--w11-surface-flyout)",
          backdropFilter: "blur(35px) saturate(180%)",
          WebkitBackdropFilter: "blur(35px) saturate(180%)",
          border: "1px solid var(--w11-acrylic-border)",
          borderRadius: "14px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.35)",
          padding: "20px",
          zIndex: 9999,
          userSelect: "none",
          overflowY: "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "linear-gradient(135deg, #0078d4, #005a9e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <GraduationCap size={16} />
            </div>
            <div>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--w11-text-primary)", display: "block", lineHeight: 1.1 }}>
                AOS Academic Board
              </span>
              <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
                Fall Semester 2026 • Live Sync
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ all: "unset", cursor: "pointer", color: "var(--w11-text-secondary)", padding: "4px" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Priority Memo from Principal */}
        <div
          style={{
            background: "linear-gradient(135deg, #0284c7, #005a9e)",
            color: "#ffffff",
            borderRadius: "10px",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            <AlertCircle size={15} />
            <span>Campus Executive Notice: Midterms</span>
          </div>
          <div style={{ fontSize: "12px", lineHeight: 1.4, opacity: 0.95 }}>
            Physics and Advanced Mathematics Midterm Assessments commence next Monday. Stations will enter Proctor Mode during all morning periods.
          </div>
        </div>

        {/* Live Bell Schedule & Period Widget */}
        <div
          style={{
            background: "var(--w11-control-bg)",
            border: "1px solid var(--w11-control-border)",
            borderRadius: "10px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={16} color={accentColor} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
                Live Period Schedule
              </span>
            </div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "#10b981",
                background: "rgba(16, 185, 129, 0.15)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              PERIOD 2 ACTIVE
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: "rgba(0,120,212,0.15)",
                borderRadius: "6px",
                borderLeft: `3px solid ${accentColor}`,
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
                  Period 2: PHY-302 (Quantum Mechanics)
                </div>
                <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>
                  Dr. Robert Henderson • Science Hall 304
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: accentColor }}>10:30 AM</div>
                <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>28m left</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: "transparent",
                borderRadius: "6px",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--w11-text-primary)" }}>
                  Period 3: MAT-210 (Multivariable Calculus)
                </div>
                <div style={{ fontSize: "10px", color: "var(--w11-text-secondary)" }}>
                  Dr. Leonhard Euler • Hall B
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>11:45 AM</div>
                <div style={{ fontSize: "10px", color: "var(--w11-text-tertiary)" }}>Upcoming</div>
              </div>
            </div>
          </div>
        </div>

        {/* Academic Todo List Widget */}
        <div
          style={{
            background: "var(--w11-control-bg)",
            border: "1px solid var(--w11-control-border)",
            borderRadius: "10px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckSquare size={16} color={accentColor} />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
                Coursework & Study Tasks
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>
              {todos.filter((t) => t.done).length}/{todos.length} done
            </span>
          </div>

          <form onSubmit={addTodo} style={{ display: "flex", gap: "6px" }}>
            <input
              type="text"
              placeholder="Add coursework task..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              style={{
                flex: 1,
                fontSize: "12px",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid var(--w11-control-border)",
                background: "var(--w11-surface-solid)",
                color: "var(--w11-text-primary)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              className="win11-btn accent"
              style={{ padding: "0 10px", minWidth: "32px", height: "30px", cursor: "pointer" }}
            >
              <Plus size={14} />
            </button>
          </form>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {todos.map((todo) => (
              <div
                key={todo.id}
                onClick={() => toggleTodo(todo.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: todo.done ? "transparent" : "var(--w11-surface-solid)",
                  opacity: todo.done ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => {}}
                    style={{ accentColor: accentColor }}
                  />
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--w11-text-primary)",
                      textDecoration: todo.done ? "line-through" : "none",
                    }}
                  >
                    {todo.text}
                  </span>
                </div>
                <span style={{ fontSize: "10px", color: "var(--w11-text-secondary)", flexShrink: 0 }}>
                  {todo.due}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Campus Dining Menu */}
        <div
          style={{
            background: "var(--w11-control-bg)",
            border: "1px solid var(--w11-control-border)",
            borderRadius: "10px",
            padding: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Utensils size={16} color="#f59e0b" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--w11-text-primary)" }}>
              Student Cafeteria • Today&apos;s Lunch Menu
            </span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)", lineHeight: 1.4 }}>
            Main Hall: Organic Quinoa Bowl with Roasted Veggies, Artisanal Sourdough & Fresh Citrus Infusion.
          </div>
        </div>
      </div>
    </>
  );
}
