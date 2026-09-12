"use client";
import { AdvancedSelect } from "@/components/ui/advanced-select";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bot, Sparkles } from "lucide-react";
import {
  AOSPage,
  AOSPageHeader,
  AOSPageBody,
  DataPanel,
} from "@/components/aos/kit/page-kit";

interface DesignVariation {
  theme_slug: string;
  theme_name: string;
  color_palette: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
  hero_style: string;
  sections: string[];
  copy: {
    hero_heading: string;
    hero_subheading: string;
    about_snippet: string;
  };
}

export default function AIBuilderPage() {
  const [prompt, setPrompt] = useState("");
  const [schoolType, setSchoolType] = useState("private");
  const [variations, setVariations] = useState<DesignVariation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const generateMut = useMutation({
    mutationFn: (data: { prompt: string; school_type: string }) =>
      api.post("/website-builder/ai/generate-design", data).then((r) => r.data.data),
    onSuccess: (data) => {
      setVariations(data.variations || []);
      setSelectedIdx(null);
    },
  });

  const applyMut = useMutation({
    mutationFn: (variation: DesignVariation) =>
      api.post("/website-builder/themes/apply", {
        theme_slug: variation.theme_slug,
        // themes/apply reads `color_overrides` (not `customizations`) — send
        // the AI-chosen palette there so the colors reach the public site.
        color_overrides: variation.color_palette,
      }),
    onSuccess: () => {
      alert("AI design applied! Go to the editor to fine-tune your website.");
    },
  });

  return (
    <AOSPage>
      <AOSPageHeader
        icon={<Bot className="h-5 w-5" style={{ color: "var(--w11-accent)" }} />}
        title="🤖 AI Website Builder"
        subtitle="Describe your ideal school website and AI will generate 3 design variations"
      />
      <AOSPageBody>
        {/* Prompt Input */}
        <DataPanel className="mb-4">
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--w11-text-primary)" }}
              >
                School Type
              </label>
              <AdvancedSelect
                value={schoolType}
                onChange={(v) => setSchoolType(v)}
                className="w-56"
                options={[
                  { value: "government", label: "Government School" },
                  { value: "private", label: "Private School" },
                  { value: "montessori", label: "Montessori / Pre-school" },
                  { value: "college", label: "College / +2" },
                  { value: "boarding", label: "Boarding School" },
                ]}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: "var(--w11-text-primary)" }}
              >
                Describe your ideal website
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Example: We are a modern private school in Kathmandu with a focus on technology and innovation. We want a clean, professional website with blue and white colors that showcases our STEM programs, modern facilities, and student achievements."
                className="w-full text-sm"
                style={{
                  background: "var(--w11-control-bg)",
                  color: "var(--w11-text-primary)",
                  border: "1px solid var(--w11-control-border)",
                  borderRadius: "var(--w11-radius-md)",
                  padding: "8px 12px",
                }}
              />
            </div>

            <button
              onClick={() => generateMut.mutate({ prompt, school_type: schoolType })}
              disabled={!prompt.trim() || generateMut.isPending}
              className="win11-btn accent"
            >
              {generateMut.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="win11-spinner h-4 w-4" />
                  AI is designing...
                </span>
              ) : (
                "✨ Generate 3 Variations"
              )}
            </button>

            {generateMut.isError && (
              <p className="text-sm" style={{ color: "var(--w11-text-primary)" }}>
                Failed to generate designs. Please try again.
              </p>
            )}
          </div>
        </DataPanel>

        {/* Variations */}
        {variations.length > 0 && (
          <div className="space-y-4 mb-4">
            <h2 className="text-lg font-semibold" style={{ color: "var(--w11-text-primary)" }}>
              Choose a Design
            </h2>
            <div className="grid md:grid-cols-3 gap-5">
              {variations.map((v, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  className="win11-card overflow-hidden cursor-pointer transition-all"
                  style={{
                    padding: 0,
                    border: `2px solid ${selectedIdx === idx ? "var(--w11-accent)" : "var(--w11-border-default)"}`,
                    boxShadow: selectedIdx === idx ? "0 0 0 2px var(--w11-accent-light)" : undefined,
                    borderRadius: "var(--w11-radius-xl)",
                  }}
                >
                  {/* Mini preview */}
                  <div
                    className="h-32 p-4 text-white"
                    style={{
                      background: `linear-gradient(135deg, ${v.color_palette.primary}, ${v.color_palette.secondary})`,
                    }}
                  >
                    <h3
                      className="text-lg font-bold"
                      style={{ fontFamily: v.fonts.heading }}
                    >
                      {v.copy.hero_heading}
                    </h3>
                    <p className="text-sm opacity-80">{v.copy.hero_subheading}</p>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium" style={{ color: "var(--w11-text-primary)" }}>
                        {v.theme_name}
                      </span>
                      <span className="win11-chip">{v.hero_style}</span>
                    </div>

                    {/* Color swatches */}
                    <div className="flex gap-1 mb-2">
                      {Object.values(v.color_palette).map((c, i) => (
                        <div
                          key={i}
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: c, borderColor: "var(--w11-border-default)" }}
                        />
                      ))}
                    </div>

                    <p
                      className="text-xs line-clamp-2"
                      style={{ color: "var(--w11-text-secondary)" }}
                    >
                      {v.copy.about_snippet}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {v.sections.slice(0, 4).map((s) => (
                        <span key={s} className="win11-chip">{s}</span>
                      ))}
                      {v.sections.length > 4 && (
                        <span className="text-xs" style={{ color: "var(--w11-text-tertiary)" }}>
                          +{v.sections.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedIdx === idx && (
                    <div
                      className="p-3 border-t"
                      style={{
                        background: "var(--w11-accent-light)",
                        borderColor: "var(--w11-border-subtle)",
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          applyMut.mutate(v);
                        }}
                        disabled={applyMut.isPending}
                        className="win11-btn accent w-full"
                      >
                        {applyMut.isPending ? "Applying..." : "🚀 Apply This Design"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <DataPanel title={<span>💡 Tips for better results</span>}>
          <ul className="text-xs space-y-1.5" style={{ color: "var(--w11-text-secondary)" }}>
            <li>• Mention your school&apos;s personality (modern, traditional, warm)</li>
            <li>• Include preferred colors if you have school brand colors</li>
            <li>• Describe what you want to highlight (academics, sports, facilities)</li>
            <li>• Specify if you want Nepali/English bilingual content</li>
            <li>• The AI will choose the best-matching theme from our 10 designs</li>
          </ul>
        </DataPanel>
      </AOSPageBody>
    </AOSPage>
  );
}
