"use client";

import React, { useState, useRef, useEffect } from "react";
import { marked } from "marked";

type StageId = "intent" | "serp" | "traffic" | "brief" | "write" | "humanize" | "score";

interface Stage {
  id: StageId;
  name: string;
  icon: string;
}

interface ScorecardMetric {
  name: string;
  score: number;
  value: string;
  target: string;
  status: "pass" | "fail" | "warn";
  weight: number;
  details: string;
}

interface Scorecard {
  overall_score: number;
  overall_grade: string;
  metrics: ScorecardMetric[];
  strengths?: string[];
  improvements?: string[];
  summary?: string;
}

// Ensure marked uses safe defaults
marked.setOptions({
  gfm: true,
  breaks: true,
});

const stageIconMap: Record<string, React.ReactNode> = {
  intent: <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /></svg>,
  serp: <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>,
  traffic: <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  brief: <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  write: <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  humanize: <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  score: <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
};

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [activeStageIndex, setActiveStageIndex] = useState(-1);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  const [stageDurations, setStageDurations] = useState<Record<number, number>>({});

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const [error, setError] = useState<string | null>(null);

  // Outputs
  const [rawBlog, setRawBlog] = useState("");
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [stageOutputs, setStageOutputs] = useState<Record<string, any>>({});
  const [showResults, setShowResults] = useState(false);

  // Refs
  const resultsRef = useRef<HTMLDivElement>(null);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (startTime && isGenerating) {
      interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [startTime, isGenerating]);

  const handleGenerate = async () => {
    if (!keyword.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setStages([]);
    setActiveStageIndex(-1);
    setCompletedStages([]);
    setStageDurations({});
    setStartTime(Date.now());
    setElapsedTime(0);
    setRawBlog("");
    setScorecard(null);
    setStageOutputs({});
    setShowResults(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });

      if (!response.body) throw new Error("ReadableStream not supported");
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start generation");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) { setIsGenerating(false); break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = null;
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEEvent(eventType, data);
            } catch (e) {
              console.warn("Failed to parse SSE data:", e);
              console.warn("Raw data:", line.slice(6));
            }
            eventType = null;
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
      setIsGenerating(false);
    }
  };

  const handleSSEEvent = (event: string, data: any) => {
    if (event === "init") {
      setStages(data.stages);
    } else if (event === "stage-start") {
      setActiveStageIndex(data.index);
    } else if (event === "stage-complete") {
      setCompletedStages((prev) => [...prev, data.index]);
      setStageDurations((prev) => ({ ...prev, [data.index]: data.duration }));
      setStageOutputs((prev) => ({ ...prev, [data.stage]: data.data }));
    } else if (event === "complete") {
      setRawBlog(data.blog);
      setScorecard(data.scorecard);
      setStageOutputs({
        intent: data.keywordData,
        serp: data.gapData,
        traffic: data.trafficData,
        brief: data.brief,
      });
      setShowResults(true);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } else if (event === "error") {
      setError(data.message);
      setIsGenerating(false);
    }
  };

  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#2d8a4e";
    if (score >= 60) return "#1d6fa4";
    if (score >= 40) return "#c47e1a";
    return "#c0392b";
  };

  const renderMarkdown = (markdown: string) => {
    if (!markdown) return { __html: "" };
    try {
      // @ts-ignore
      const html = marked.parse(markdown);
      return { __html: html };
    } catch (e) {
      console.error("Markdown parsing error", e);
      return { __html: "<p>Error rendering content</p>" };
    }
  };

  return (
    <main className="min-h-screen bg-[#f0ece6] text-[#111110] overflow-x-hidden pb-20">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-8 py-4
        bg-[#f0ece6]/90 backdrop-blur-md border-b border-[#e3ddd5]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            {/* 5-pointed chevron star logo matching reference image */}
            <div className="w-8 h-8 flex items-center justify-center">
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                <g transform="translate(24, 24)">
                  <path d="M -7 -15 L 0 -6 L 7 -15" stroke="#e8440a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M -7 -15 L 0 -6 L 7 -15" stroke="#e8440a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(72)" />
                  <path d="M -7 -15 L 0 -6 L 7 -15" stroke="#e8440a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(144)" />
                  <path d="M -7 -15 L 0 -6 L 7 -15" stroke="#e8440a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(216)" />
                  <path d="M -7 -15 L 0 -6 L 7 -15" stroke="#e8440a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(288)" />
                </g>
              </svg>
            </div>
            <span
              className="text-[22px] font-extrabold italic tracking-tight text-[#111110]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >blogy</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-12">

        {/* ── Hero Section ── */}
        <section className="text-center pt-16 pb-20 border-b border-[#e3ddd5]">
          {/* Section eyebrow — Intercom style: colored square dot + small caps label */}
          <div className="flex items-center justify-center gap-2 mb-10">
            <span className="w-2.5 h-2.5 bg-[#e8440a] rounded-[2px]" />
            <span className="text-[11px] font-semibold text-[#5c5a57] uppercase tracking-[0.2em]">
              AI Blog Generation
            </span>
          </div>

          {/* Large editorial headline — Intercom's "Fin outperforms" energy */}
          <h1
            className="text-[clamp(1.6rem,4.2vw,3.6rem)] font-extrabold leading-[1.08] tracking-[-0.03em] mb-6 text-[#111110] whitespace-nowrap"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            From{" "}
            <span className="italic text-[#e8440a]">Keyword</span>
            {" "}to{" "}
            <span className="italic text-[#e8440a]">Ranked Blog</span>
            {" "}in One Click.
          </h1>

          <p className="text-base md:text-lg text-[#5c5a57] max-w-xl mx-auto mb-12 leading-relaxed">
            7-stage AI pipeline: Intent Analysis → SERP Gaps → Traffic Projection → Brief → Write → Humanize → SEO Score
          </p>

          {/* Input row */}
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="flex-1 flex items-center gap-3 px-5 py-3.5
                bg-white border border-[#e3ddd5] rounded-sm
                focus-within:border-[#e8440a] focus-within:shadow-[0_0_0_3px_rgba(232,68,10,0.08)]
                transition-all">
                <svg className="w-4 h-4 text-[#9c9790] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  placeholder="Enter seed keyword... e.g. 'AI blog automation tools India'"
                  className="flex-1 bg-transparent border-none outline-none
                    text-[#111110] text-[15px] placeholder:text-[#b0aa9f] w-full"
                  disabled={isGenerating}
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !keyword.trim()}
                className="flex items-center justify-center gap-2 px-7 py-3.5
                  bg-[#111110] text-white font-semibold text-sm
                  rounded-sm transition-all whitespace-nowrap
                  hover:bg-[#e8440a]
                  active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generating</span>
                  </>
                ) : (
                  <span>Generate →</span>
                )}
              </button>
            </div>

            {/* Suggestion chips */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <span className="text-xs text-[#9c9790]">Try:</span>
              {["AI blog automation tools India", "best SEO tools for startups 2025", "content marketing strategy for SaaS"].map((kw) => (
                <button
                  key={kw}
                  onClick={() => setKeyword(kw)}
                  className="px-3.5 py-1.5 bg-white border border-[#e3ddd5] rounded-sm
                    text-[11px] text-[#5c5a57] font-medium
                    hover:border-[#e8440a]/50 hover:text-[#e8440a]
                    transition-colors cursor-pointer"
                  disabled={isGenerating}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pipeline Progress ── */}
        {(isGenerating || showResults) && (
          <section className="my-10 bg-white border border-[#e3ddd5] rounded-sm overflow-hidden">
            {/* Section header — Intercom label style */}
            <div className="flex justify-between items-center px-7 py-4 border-b border-[#e3ddd5] bg-[#faf8f5]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#e8440a] rounded-[2px]" />
                <span className="text-[11px] font-semibold text-[#5c5a57] uppercase tracking-[0.16em]">
                  Pipeline Progress
                </span>
              </div>
              <span className="font-mono text-xs text-[#5c5a57] px-2.5 py-1
                border border-[#e3ddd5] bg-[#f0ece6] rounded-sm">
                {formatTime(elapsedTime)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-[3px] bg-[#e3ddd5]">
              <div
                className="h-full bg-[#e8440a] transition-all duration-700 ease-out"
                style={{ width: stages.length > 0 ? `${(completedStages.length / stages.length) * 100}%` : "0%" }}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-y-4 overflow-x-auto px-7 py-5">
              {stages.map((stage, idx) => {
                const isActive = activeStageIndex === idx;
                const isComplete = completedStages.includes(idx);
                const isPending = !isActive && !isComplete;

                return (
                  <div key={stage.id} className={`flex items-center gap-3 px-4 py-3 md:py-2
                    rounded-sm shrink-0 transition-all relative
                    ${isPending ? "opacity-35" : ""}
                    ${isActive ? "bg-[#e8440a]/[0.07] border border-[#e8440a]/25" : ""}
                    ${isComplete ? "opacity-100" : ""}
                  `}>
                    <span className={`flex items-center justify-center shrink-0 ${isComplete ? 'text-[#2d8a4e]' : isActive ? 'text-[#e8440a]' : 'text-[#9c9790]'} transition-colors`}>
                      {stageIconMap[stage.id] || <span className="text-xl md:text-2xl">{stage.icon}</span>}
                    </span>
                    <div className="flex flex-col">
                      <span className={`text-xs md:text-[13px] font-semibold whitespace-nowrap
                        ${isComplete ? "text-[#2d8a4e]" : isActive ? "text-[#e8440a]" : "text-[#5c5a57]"}`}>
                        {isComplete ? "✓ " : ""}{stage.name}
                      </span>
                      <span className="text-[10px] text-[#9c9790] font-mono">
                        {isComplete
                          ? `${(stageDurations[idx] / 1000).toFixed(1)}s`
                          : isActive ? "Processing..." : "Waiting..."}
                      </span>
                    </div>
                    {idx < stages.length - 1 && (
                      <span className="hidden md:block absolute -right-4 text-[#c8c2ba] text-xs">→</span>
                    )}
                    {idx < stages.length - 1 && (
                      <span className="block md:hidden absolute -bottom-4 left-4 text-[#c8c2ba] text-xs">↓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="max-w-xl mx-auto my-12 p-8 text-center
            bg-white border border-red-200 rounded-sm">
            <div className="w-10 h-10 rounded-sm bg-red-50 border border-red-200
              flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-sm text-red-600 mb-6">{error}</p>
            <button
              onClick={() => { setError(null); handleGenerate(); }}
              className="px-6 py-2.5 bg-[#111110] text-white text-sm font-semibold
                rounded-sm hover:bg-[#e8440a] transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Results ── */}
        {showResults && (
          <div ref={resultsRef} className="animate-fade-up mt-14">

            {/* Intermediate Outputs */}
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#e3ddd5]">
                <span className="w-2 h-2 bg-[#e8440a] rounded-[2px]" />
                <h2 className="text-[11px] font-semibold text-[#5c5a57] uppercase tracking-[0.16em]">
                  Research Data
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <IntermediateCard
                  title="Keyword Cluster"
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>}
                  data={stageOutputs.intent}
                  summary={stageOutputs.intent ? `${stageOutputs.intent.total_keywords || "?"} keywords, Intent: ${stageOutputs.intent.primary_intent}` : ""}
                />
                <IntermediateCard
                  title="SERP Gaps"
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}
                  data={stageOutputs.serp}
                  summary={stageOutputs.serp ? `${stageOutputs.serp.gaps?.length || 0} gaps found` : ""}
                />
                <IntermediateCard
                  title="Traffic Projection"
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>}
                  data={stageOutputs.traffic}
                  summary={stageOutputs.traffic?.primary_keyword_volume?.estimated_range
                    ? `Vol: ${stageOutputs.traffic.primary_keyword_volume.estimated_range.high || "?"}/mo`
                    : ""}
                />
                <IntermediateCard
                  title="Blog Brief"
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
                  data={stageOutputs.brief}
                  summary={stageOutputs.brief ? `${stageOutputs.brief.target_word_count || "?"} words, ${stageOutputs.brief.outline?.length || 0} sections` : ""}
                />
              </div>
            </section>

            {/* Blog + Scorecard */}
            <section className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5">

              {/* Blog Column */}
              <div className="lg:col-span-2 xl:col-span-3
                bg-white border border-[#e3ddd5] rounded-sm overflow-hidden
                flex flex-col h-[800px]">
                <div className="flex justify-between items-center px-6 py-4
                  border-b border-[#e3ddd5] bg-[#faf8f5] shrink-0">
                  <h2 className="font-semibold text-[13px] text-[#111110] flex items-center gap-2 uppercase tracking-wider">
                    <svg className="w-4 h-4 text-[#e8440a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    Generated Blog
                  </h2>
                  <button
                    onClick={() => navigator.clipboard.writeText(rawBlog)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5
                      bg-[#f0ece6] border border-[#e3ddd5] rounded-sm
                      text-[11px] text-[#5c5a57] font-medium
                      hover:border-[#e8440a]/50 hover:text-[#e8440a] transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    Copy Markdown
                  </button>
                </div>

                <div className="p-8 overflow-y-auto flex-1 prose prose-editorial max-w-none">
                  <div dangerouslySetInnerHTML={renderMarkdown(rawBlog)} />
                </div>
              </div>

              {/* Scorecard Column */}
              <div className="lg:col-span-1
                bg-white border border-[#e3ddd5] rounded-sm overflow-hidden
                flex flex-col h-[800px]">
                <div className="px-6 py-4 border-b border-[#e3ddd5] bg-[#faf8f5] shrink-0">
                  <h2 className="font-semibold text-[13px] text-[#111110] flex items-center gap-2 uppercase tracking-wider">
                    <svg className="w-4 h-4 text-[#e8440a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                    SEO Scorecard
                  </h2>
                </div>

                {scorecard && (
                  <div className="p-6 overflow-y-auto flex-1">
                    {/* Score Ring */}
                    <div className="text-center pb-6 border-b border-[#e3ddd5] mb-6">
                      <div className="relative w-32 h-32 mx-auto mb-4">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                          <circle
                            className="fill-none"
                            stroke="#e3ddd5"
                            strokeWidth="8"
                            cx="70" cy="70" r="58"
                          />
                          <circle
                            className="fill-none transition-all duration-1000 ease-out"
                            stroke={getScoreColor(scorecard.overall_score || 0)}
                            strokeWidth="8"
                            strokeDasharray={2 * Math.PI * 58}
                            strokeDashoffset={(2 * Math.PI * 58) * (1 - (scorecard.overall_score || 0) / 100)}
                            strokeLinecap="round"
                            cx="70" cy="70" r="58"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="text-4xl font-extrabold tabular-nums"
                            style={{ color: getScoreColor(scorecard.overall_score || 0), fontFamily: "'Playfair Display', Georgia, serif" }}
                          >
                            {scorecard.overall_score || 0}
                          </span>
                        </div>
                      </div>
                      <div className="text-[10px] text-[#9c9790] uppercase tracking-widest mb-3 font-medium">
                        Overall SEO Score
                      </div>
                      {scorecard.overall_grade && (
                        <span className={`inline-block px-4 py-1 rounded-sm text-xs font-bold border
                          ${scorecard.overall_grade === 'A' ? 'bg-green-50 text-green-700 border-green-200' :
                            scorecard.overall_grade === 'B' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              scorecard.overall_grade === 'C' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200'}`}>
                          Grade {scorecard.overall_grade}
                        </span>
                      )}
                    </div>

                    {/* Metrics */}
                    {scorecard.metrics && scorecard.metrics.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-6">
                        <h3 className="text-[10px] font-semibold text-[#9c9790] uppercase tracking-wider mb-2">Metrics</h3>
                        {scorecard.metrics.map((metric, i) => (
                          <div key={i} className="flex items-center gap-3 p-3
                            bg-[#faf8f5] rounded-sm border border-[#ece8e2]
                            hover:border-[#e8440a]/20 transition-colors">
                            <span className="text-base shrink-0">
                              {metric.status === 'pass' ? '✅' : metric.status === 'fail' ? '❌' : '⚠️'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[13px] font-medium text-[#111110]">{metric.name}</div>
                              <div className="text-[10px] text-[#9c9790] font-mono truncate">
                                {metric.value} (tgt: {metric.target})
                              </div>
                            </div>
                            <span className={`text-sm font-bold font-mono shrink-0 ml-1
                              ${metric.status === 'pass' ? 'text-green-700' :
                                metric.status === 'fail' ? 'text-red-600' : 'text-amber-600'}`}>
                              {metric.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Strengths */}
                    {scorecard.strengths && scorecard.strengths.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-sm p-4 mb-3">
                        <h3 className="text-xs font-semibold mb-2.5 text-green-800 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          Strengths
                        </h3>
                        <ul className="space-y-1.5">
                          {scorecard.strengths.map((s, i) => (
                            <li key={i} className="text-[11px] text-green-900 pl-3.5 relative
                              before:content-['·'] before:absolute before:left-0 before:text-green-600 before:font-bold">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improvements */}
                    {scorecard.improvements && scorecard.improvements.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 mb-3">
                        <h3 className="text-xs font-semibold mb-2.5 text-amber-800 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                          Improvements
                        </h3>
                        <ul className="space-y-1.5">
                          {scorecard.improvements.map((s, i) => (
                            <li key={i} className="text-[11px] text-amber-900 pl-3.5 relative
                              before:content-['·'] before:absolute before:left-0 before:text-amber-600 before:font-bold">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Summary */}
                    {scorecard.summary && (
                      <div className="bg-[#faf8f5] border border-[#e3ddd5] rounded-sm p-4">
                        <h3 className="text-xs font-semibold mb-2 text-[#5c5a57] uppercase tracking-wide">Summary</h3>
                        <p className="text-[11px] text-[#5c5a57] leading-relaxed">{scorecard.summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

// Subcomponent for intermediate cards
function IntermediateCard({ title, icon, summary, data }: { title: string, icon: React.ReactNode, summary: string, data: any }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!data) return null;

  return (
    <div className={`bg-white border border-[#e3ddd5] rounded-sm overflow-hidden
      transition-all duration-300 hover:border-[#e8440a]/35`}>
      <div
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-[#faf8f5] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-1 overflow-hidden pr-2">
          <span className="text-[13px] font-semibold flex items-center gap-2 text-[#111110]">
            <span className="text-[#e8440a] shrink-0">{icon}</span>
            {title}
          </span>
          <span className="text-[10px] text-[#9c9790] truncate w-full">{summary}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-[#9c9790] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px] border-t border-[#e3ddd5]' : 'max-h-0'}`}>
        <div className="p-4 bg-[#faf8f5]">
          <pre className="p-3 rounded-sm overflow-x-auto
            text-[10px] font-mono text-[#5c5a57]
            max-h-[400px] overflow-y-auto
            bg-[#111110] text-[#e2e0dc]">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
