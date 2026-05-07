"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
        customizations: {
          colors: variation.color_palette,
          fonts: variation.fonts,
          hero_style: variation.hero_style,
        },
      }),
    onSuccess: () => {
      alert("AI design applied! Go to the editor to fine-tune your website.");
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🤖 AI Website Builder</h1>
        <p className="text-gray-500 text-sm mt-1">
          Describe your ideal school website and AI will generate 3 design variations
        </p>
      </div>

      {/* Prompt Input */}
      <div className="border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">School Type</label>
          <select
            value={schoolType}
            onChange={(e) => setSchoolType(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="government">Government School</option>
            <option value="private">Private School</option>
            <option value="montessori">Montessori / Pre-school</option>
            <option value="college">College / +2</option>
            <option value="boarding">Boarding School</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Describe your ideal website
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Example: We are a modern private school in Kathmandu with a focus on technology and innovation. We want a clean, professional website with blue and white colors that showcases our STEM programs, modern facilities, and student achievements."
            className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={() => generateMut.mutate({ prompt, school_type: schoolType })}
          disabled={!prompt.trim() || generateMut.isPending}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
        >
          {generateMut.isPending ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              AI is designing...
            </span>
          ) : (
            "✨ Generate 3 Variations"
          )}
        </button>

        {generateMut.isError && (
          <p className="text-red-500 text-sm">
            Failed to generate designs. Please try again.
          </p>
        )}
      </div>

      {/* Variations */}
      {variations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Choose a Design</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {variations.map((v, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedIdx(idx)}
                className={`border-2 rounded-xl overflow-hidden cursor-pointer transition-all ${
                  selectedIdx === idx
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-gray-200 hover:border-gray-300"
                }`}
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
                    <span className="text-sm font-medium">{v.theme_name}</span>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {v.hero_style}
                    </span>
                  </div>

                  {/* Color swatches */}
                  <div className="flex gap-1 mb-2">
                    {Object.values(v.color_palette).map((c, i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2">
                    {v.copy.about_snippet}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.sections.slice(0, 4).map((s) => (
                      <span key={s} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                    {v.sections.length > 4 && (
                      <span className="text-xs text-gray-400">
                        +{v.sections.length - 4} more
                      </span>
                    )}
                  </div>
                </div>

                {selectedIdx === idx && (
                  <div className="p-3 bg-blue-50 border-t border-blue-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        applyMut.mutate(v);
                      }}
                      disabled={applyMut.isPending}
                      className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
      <div className="bg-gray-50 rounded-lg p-5">
        <h3 className="font-medium text-sm mb-2">💡 Tips for better results</h3>
        <ul className="text-xs text-gray-600 space-y-1.5">
          <li>• Mention your school&apos;s personality (modern, traditional, warm)</li>
          <li>• Include preferred colors if you have school brand colors</li>
          <li>• Describe what you want to highlight (academics, sports, facilities)</li>
          <li>• Specify if you want Nepali/English bilingual content</li>
          <li>• The AI will choose the best-matching theme from our 20 options</li>
        </ul>
      </div>
    </div>
  );
}
