"use client";

import { useState } from "react";

interface ResultCheckerProps {
  schoolSlug?: string;
}

export function ResultChecker({ schoolSlug }: ResultCheckerProps) {
  const [rollNo, setRollNo] = useState("");
  const [examType, setExamType] = useState("final");

  return (
    <section className="py-16 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
      <div className="max-w-2xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Check Your Results</h2>
        <p className="text-blue-100 mb-8">Enter your roll number to view your exam results</p>

        <div className="bg-white rounded-2xl p-6 md:p-8 text-gray-900 shadow-2xl">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Exam Type</label>
              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="first_term">First Term Exam</option>
                <option value="second_term">Second Term Exam</option>
                <option value="third_term">Third Term Exam</option>
                <option value="final">Annual Exam</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Roll Number</label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="Enter your roll number"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">
              Check Result
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
