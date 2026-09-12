"use client";

import React, { useState, useEffect } from "react";
import {
  Atom,
  QrCode,
  Utensils,
  Eye,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { SchoolRole } from "../RoleSwitcherModal";

export interface PluginRunnerAppProps {
  pluginId: string;
  currentRole?: SchoolRole;
  accentColor?: string;
}

export default function PluginRunnerApp({
  pluginId,
  currentRole = "student",
  accentColor = "#0078d4",
}: PluginRunnerAppProps) {
  // Quantum Simulator state
  const [waveFreq, setWaveFreq] = useState(4);
  const [particleSpeed, setParticleSpeed] = useState(50);
  const [isSimRunning, setIsSimRunning] = useState(true);

  // Attendance Scanner state
  const [scannedStudents, setScannedStudents] = useState<string[]>([
    "Aarav Sharma (Grade 11-A) — 10:31 AM",
    "Elena Rostova (Grade 11-A) — 10:32 AM",
  ]);

  // Meal Wallet state
  const [balance, setBalance] = useState(142.5);
  const [lastMeal, setLastMeal] = useState("Grilled Salmon Bowl ($9.50)");

  // Anti Cheat state
  const [cameraActive, setCameraActive] = useState(true);
  const [proctorScore, setProctorScore] = useState(99.4);

  // Periodic wave update for 120 FPS canvas simulation
  useEffect(() => {
    if (!isSimRunning) return;
    const interval = setInterval(() => {
      // Periodic tick
    }, 16);
    return () => clearInterval(interval);
  }, [isSimRunning]);

  if (pluginId === "plugin-physics-ai") {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", gap: "16px", background: "var(--w11-window-bg)", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Atom size={22} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700 }}>AI Quantum Physics & Particle Simulator</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>Wave-Particle Duality & Harmonic Oscillator Sandbox</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button className="subtle" onClick={() => setIsSimRunning(!isSimRunning)}>
              {isSimRunning ? "Pause" : "Resume"}
            </button>
            <button className="accent" onClick={() => { setWaveFreq(4); setParticleSpeed(50); }}>
              <RotateCcw size={14} style={{ marginRight: "4px" }} /> Reset
            </button>
          </div>
        </div>

        {/* Canvas Simulation Preview */}
        <div
          style={{
            flex: 1,
            minHeight: "220px",
            background: "linear-gradient(180deg, #09090b, #18181b)",
            borderRadius: "12px",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Animated Quantum Wave SVG */}
          <svg width="100%" height="160" viewBox="0 0 600 160" preserveAspectRatio="none">
            <path
              d={`M 0 80 Q 75 ${80 - waveFreq * 12} 150 80 T 300 80 T 450 80 T 600 80`}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="3"
              style={{ filter: "drop-shadow(0 0 10px #8b5cf6)" }}
            />
            <path
              d={`M 0 80 Q 75 ${80 + waveFreq * 12} 150 80 T 300 80 T 450 80 T 600 80`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2"
              strokeDasharray="4 4"
              style={{ opacity: 0.7 }}
            />
          </svg>

          <div style={{ position: "absolute", bottom: "12px", left: "14px", fontSize: "11px", color: "#a1a1aa", background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "6px" }}>
            Ψ(x,t) = Ae^(i(kx - ωt)) • Frame Rate: 120 FPS Target
          </div>
        </div>

        {/* Interactive Simulation Controls */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div style={{ background: "var(--w11-card-bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--w11-border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
              <span>Wave Frequency (ω):</span>
              <span style={{ fontWeight: 700, color: "#8b5cf6" }}>{waveFreq} GHz</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={waveFreq}
              onChange={(e) => setWaveFreq(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ background: "var(--w11-card-bg)", padding: "12px", borderRadius: "8px", border: "1px solid var(--w11-border-subtle)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
              <span>Particle Accelerator Velocity (v):</span>
              <span style={{ fontWeight: 700, color: "#06b6d4" }}>{particleSpeed}% c</span>
            </div>
            <input
              type="range"
              min="10"
              max="99"
              value={particleSpeed}
              onChange={(e) => setParticleSpeed(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (pluginId === "plugin-attendance") {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", gap: "16px", background: "var(--w11-window-bg)", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <QrCode size={22} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700 }}>Biometric & QR Attendance Kiosk</div>
            <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>Live Homeroom Check-in Scanner</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px" }} className="aos-responsive-split">
          <div style={{ flex: 1, background: "var(--w11-card-bg)", padding: "16px", borderRadius: "10px", border: "1px solid var(--w11-border-subtle)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
            <div style={{ width: "120px", height: "120px", border: "2px dashed #10b981", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
              <QrCode size={64} color="#10b981" />
            </div>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>Optical Scanner Active</div>
            <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>Present Student ID or NFC Badge to Camera</div>
            <button
              className="accent"
              style={{ marginTop: "14px", fontSize: "12px" }}
              onClick={() => {
                const names = ["Marcus Vance", "Sophia Chen", "Liam O'Connor", "Aria Patel"];
                const nextName = names[Math.floor(Math.random() * names.length)];
                setScannedStudents((prev) => [
                  `${nextName} (Grade 11-A) — ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
                  ...prev,
                ]);
              }}
            >
              Simulate Badge Tap
            </button>
          </div>

          <div style={{ flex: 1, background: "var(--w11-card-bg)", padding: "16px", borderRadius: "10px", border: "1px solid var(--w11-border-subtle)", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "10px" }}>
              Live Roster Stream ({scannedStudents.length} Verified)
            </div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {scannedStudents.map((s, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", background: "var(--w11-control-bg)", padding: "8px 10px", borderRadius: "6px" }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pluginId === "plugin-meal-wallet") {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", gap: "16px", background: "var(--w11-window-bg)", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Utensils size={22} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700 }}>Smart Canteen & Meal Wallet</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>Dietary Tracking & Pre-order POS</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "var(--w11-text-secondary)" }}>Account Balance</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#10b981" }}>${balance.toFixed(2)}</div>
          </div>
        </div>

        <div className="win11-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>Recent Cafeteria Order</div>
            <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>{lastMeal}</div>
          </div>
          <button
            className="accent"
            onClick={() => {
              const meals = [
                { name: "Avocado & Egg Brioche", cost: 6.5 },
                { name: "Organic Mediterranean Salad", cost: 8.0 },
                { name: "Steamed Chicken & Rice Bowl", cost: 9.0 },
                { name: "Fresh Berry Smoothie", cost: 4.5 },
              ];
              const randomMeal = meals[Math.floor(Math.random() * meals.length)];
              setBalance((prev) => Math.max(0, prev - randomMeal.cost));
              setLastMeal(`${randomMeal.name} ($${randomMeal.cost.toFixed(2)})`);
            }}
          >
            Order Lunch Tap
          </button>
        </div>
      </div>
    );
  }

  if (pluginId === "plugin-anti-cheat") {
    return (
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%", gap: "16px", background: "var(--w11-window-bg)", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Eye size={22} />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700 }}>AI Exam Proctor & Anti-Cheat Sentinel</div>
              <div style={{ fontSize: "12px", color: "var(--w11-text-secondary)" }}>Gaze Tracking & Dual-Monitor Lockdown</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldAlert size={18} color="#10b981" />
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>Integrity: {proctorScore}%</span>
          </div>
        </div>

        <div className="win11-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Neural Gaze & Face Detection Feed</span>
            <button
              className="subtle"
              onClick={() => {
                setCameraActive(!cameraActive);
                setProctorScore((prev) => (prev > 95 ? 98.2 : 99.8));
              }}
            >
              {cameraActive ? "Feed Active" : "Paused"}
            </button>
          </div>
          <div style={{ height: "120px", borderRadius: "8px", background: "#09090b", border: "1px dashed rgba(239, 68, 68, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444", fontSize: "12px", gap: "8px" }}>
            <Eye size={20} />
            <span>Single Student Face In Center Frame • No Secondary Devices Detected</span>
          </div>
        </div>
      </div>
    );
  }

  // Fallback generic plugin view
  return (
    <div style={{ padding: "30px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", background: "var(--w11-window-bg)" }}>
      <Sparkles size={48} color={accentColor} style={{ marginBottom: "16px" }} />
      <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
        Active Academic Extension
      </div>
      <div style={{ fontSize: "13px", color: "var(--w11-text-secondary)", maxWidth: "420px", marginBottom: "20px" }}>
        This extension is installed and fully synchronized with AOS station permissions for {currentRole}.
      </div>
      <button className="accent" onClick={() => alert("Extension status verified: Operational.")}>
        Perform Diagnostics
      </button>
    </div>
  );
}
