"use client";

import { useState, useRef, useEffect } from "react";
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
    
    // Reset state
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
        
        if (done) {
          setIsGenerating(false);
          break;
        }

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

  // Formatting helpers
  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e"; // green
    if (score >= 60) return "#06b6d4"; // cyan
    if (score >= 40) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  // Helper for rendering Markdown properly
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
    <main className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5] font-sans overflow-x-hidden selection:bg-purple-500/30 pb-20">
      {/* Background Particles Container */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,transparent_70%)] -top-[200px] -right-[200px] animate-[pulse_15s_ease-in-out_infinite]"></div>
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.06)_0%,transparent_70%)] -bottom-[150px] -left-[150px] animate-[pulse_20s_ease-in-out_infinite]"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 py-4 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-extrabold bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent tracking-tight">
              Blogy
            </span>
          </div>
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-widest px-3 py-1 bg-white/5 border border-white/10 rounded-full">
            AI SEO Engine
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="hidden sm:inline">Prompt Chain Architecture</span>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="text-center py-16">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            From <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">Keyword</span> to{" "}
            <span className="bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 bg-clip-text text-transparent">Ranked Blog</span>
            <br />in One Click
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-12">
            7-stage AI pipeline: Intent Analysis → SERP Gaps → Traffic Projection → Brief → Write → Humanize → SEO Score
          </p>

          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-[#12121a]/70 border border-white/5 rounded-xl transition-all focus-within:border-purple-500 focus-within:shadow-[0_0_30px_rgba(139,92,246,0.15)]">
                <span className="text-xl">🌱</span>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                  placeholder="Enter seed keyword... e.g. 'AI blog automation tools India'"
                  className="flex-1 bg-transparent border-none outline-none text-white text-base w-full"
                  disabled={isGenerating}
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !keyword.trim()}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white font-semibold rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_25px_rgba(139,92,246,0.3)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <span>Generating</span>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </>
                ) : (
                  <>
                    <span>Generate</span>
                    <span>→</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-sm text-gray-400">Try:</span>
              {["AI blog automation tools India", "best SEO tools for startups 2025", "content marketing strategy for SaaS"].map((kw) => (
                <button
                  key={kw}
                  onClick={() => setKeyword(kw)}
                  className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 hover:border-purple-500 hover:text-white hover:bg-purple-500/10 transition-colors cursor-pointer"
                  disabled={isGenerating}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline Progress */}
        {(isGenerating || showResults) && (
          <section className="my-12 p-6 md:p-8 bg-[#12121a]/70 border border-white/5 rounded-2xl backdrop-blur-md">
            <div className="flex justify-between items-center mb-6 md:mb-8">
              <h2 className="text-lg font-semibold flex items-center gap-2">🔗 Pipeline Progress</h2>
              <div className="font-mono text-sm text-cyan-400 px-3 py-1 bg-cyan-400/10 border border-cyan-400/20 rounded-full">
                {formatTime(elapsedTime)}
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-y-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {stages.map((stage, idx) => {
                const isActive = activeStageIndex === idx;
                const isComplete = completedStages.includes(idx);
                const isPending = !isActive && !isComplete;
                
                return (
                  <div key={stage.id} className={`flex items-center gap-3 px-4 py-3 md:py-2 rounded-lg shrink-0 transition-all relative
                    ${isPending ? "opacity-40" : ""}
                    ${isActive ? "opacity-100 bg-purple-500/10 border border-purple-500/30 animate-pulse" : ""}
                    ${isComplete ? "opacity-100" : ""}
                  `}>
                    <span className="text-xl md:text-2xl">{stage.icon}</span>
                    <div className="flex flex-col">
                      <span className={`text-xs md:text-sm font-medium whitespace-nowrap ${isComplete ? "text-green-500" : "text-gray-300"}`}>
                        {isComplete ? "✅ " : ""}{stage.name}
                      </span>
                      <span className="text-[10px] md:text-xs text-gray-500 font-mono">
                        {isComplete 
                          ? `✓ ${(stageDurations[idx] / 1000).toFixed(1)}s` 
                          : isActive ? "Processing..." : "Waiting..."}
                      </span>
                    </div>
                    {/* Arrow for desktop */}
                    {idx < stages.length - 1 && (
                      <span className="hidden md:block absolute -right-4 text-gray-500 text-xs">→</span>
                    )}
                    {/* Arrow for mobile */}
                    {idx < stages.length - 1 && (
                      <span className="block md:hidden absolute -bottom-4 left-4 text-gray-500 text-xs">↓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Error Display */}
        {error && (
          <div className="max-w-xl mx-auto my-12 p-8 text-center bg-[#12121a]/70 border border-red-500/30 rounded-2xl">
            <span className="text-4xl block mb-4">⚠️</span>
            <p className="text-sm text-red-400 mb-6">{error}</p>
            <button 
              onClick={() => { setError(null); handleGenerate(); }}
              className="px-6 py-2 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:-translate-y-0.5 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results Section */}
        {showResults && (
          <div ref={resultsRef} className="animate-in fade-in duration-700 mt-16">
            {/* Intermediate Outputs */}
            <section className="mb-16">
              <h2 className="text-xl font-semibold mb-6">📑 Intermediate Outputs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <IntermediateCard 
                  title="Keyword Cluster" icon="🧠" data={stageOutputs.intent}
                  summary={stageOutputs.intent ? `${stageOutputs.intent.total_keywords || "?"} keywords, Intent: ${stageOutputs.intent.primary_intent}` : ""}
                />
                <IntermediateCard 
                  title="SERP Gaps" icon="🔍" data={stageOutputs.serp}
                  summary={stageOutputs.serp ? `${stageOutputs.serp.gaps?.length || 0} gaps found` : ""}
                />
                <IntermediateCard 
                  title="Traffic Projection" icon="📈" data={stageOutputs.traffic}
                  summary={stageOutputs.traffic?.primary_keyword_volume?.estimated_range 
                    ? `Vol: ${stageOutputs.traffic.primary_keyword_volume.estimated_range.high || "?"}/mo` 
                    : ""}
                />
                <IntermediateCard 
                  title="Blog Brief" icon="📋" data={stageOutputs.brief}
                  summary={stageOutputs.brief ? `${stageOutputs.brief.target_word_count || "?"} words, ${stageOutputs.brief.outline?.length || 0} sections` : ""}
                />
              </div>
            </section>

            {/* Main Results: Blog + Scorecard */}
            <section className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {/* Blog Column */}
              <div className="lg:col-span-2 xl:col-span-3 bg-[#12121a]/70 border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[800px]">
                <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-white/[0.02] shrink-0">
                  <h2 className="font-semibold text-lg flex items-center gap-2">✍️ Generated Blog</h2>
                  <button 
                    onClick={() => navigator.clipboard.writeText(rawBlog)}
                    className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs hover:border-purple-500 hover:text-white transition-colors"
                  >
                    📋 Copy Markdown
                  </button>
                </div>
                
                {/* Styled Markdown Content rendering */}
                <div className="p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 prose prose-invert prose-purple max-w-none">
                  {/* Custom styling applied through global css or inline here */}
                  <div dangerouslySetInnerHTML={renderMarkdown(rawBlog)} />
                </div>
              </div>

              {/* Scorecard Column */}
              <div className="lg:col-span-1 bg-[#12121a]/70 border border-white/5 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[800px]">
                <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] shrink-0">
                  <h2 className="font-semibold text-lg flex items-center gap-2">📊 SEO Scorecard</h2>
                </div>
                
                {scorecard && (
                  <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1">
                    {/* Overall Score Circle */}
                    <div className="text-center pb-8 border-b border-white/5 mb-6">
                      <div className="relative w-32 h-32 mx-auto mb-4">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                          <circle className="fill-none stroke-white/5 stroke-[8px]" cx="70" cy="70" r="58" />
                          <circle 
                            className="fill-none stroke-[8px] transition-all duration-1000 ease-out" 
                            stroke={getScoreColor(scorecard.overall_score || 0)}
                            strokeDasharray={2 * Math.PI * 58}
                            strokeDashoffset={(2 * Math.PI * 58) * (1 - (scorecard.overall_score || 0) / 100)}
                            strokeLinecap="round"
                            cx="70" cy="70" r="58" 
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-4xl font-extrabold" style={{ color: getScoreColor(scorecard.overall_score || 0) }}>
                            {scorecard.overall_score || 0}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-medium">Overall SEO Score</div>
                      
                      {scorecard.overall_grade && (
                        <span className={`inline-block px-4 py-1 rounded-full text-xs font-bold border
                          ${scorecard.overall_grade === 'A' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 
                            scorecard.overall_grade === 'B' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30' : 
                            scorecard.overall_grade === 'C' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 
                            'bg-red-500/10 text-red-500 border-red-500/30'}`}
                        >
                          Grade {scorecard.overall_grade}
                        </span>
                      )}
                    </div>

                    {/* Individual Metrics */}
                    {scorecard.metrics && scorecard.metrics.length > 0 && (
                      <div className="flex flex-col gap-2 mb-8">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Metrics</h3>
                        {scorecard.metrics.map((metric, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                            <span className="text-lg shrink-0">
                              {metric.status === 'pass' ? '✅' : metric.status === 'fail' ? '❌' : '⚠️'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white">{metric.name}</div>
                              <div className="text-[10px] text-gray-400 font-mono truncate">{metric.value} (tgt: {metric.target})</div>
                            </div>
                            <span className={`text-base font-bold font-mono shrink-0 ml-2
                              ${metric.status === 'pass' ? 'text-green-500' : metric.status === 'fail' ? 'text-red-500' : 'text-amber-500'}`}
                            >
                              {metric.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Analysis Details */}
                    {scorecard.strengths && scorecard.strengths.length > 0 && (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-4 mb-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-green-400">💪 Strengths</h3>
                        <ul className="space-y-2">
                          {scorecard.strengths.map((s, i) => (
                            <li key={i} className="text-xs text-gray-300 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-green-500">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {scorecard.improvements && scorecard.improvements.length > 0 && (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-4">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-400">🔧 Improvements</h3>
                        <ul className="space-y-2">
                          {scorecard.improvements.map((s, i) => (
                            <li key={i} className="text-xs text-gray-300 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-amber-500">
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {scorecard.summary && (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <h3 className="text-sm font-semibold mb-2 text-gray-300">📝 Summary</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">{scorecard.summary}</p>
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
function IntermediateCard({ title, icon, summary, data }: { title: string, icon: string, summary: string, data: any }) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!data) return null;

  return (
    <div className={`bg-[#12121a]/70 border border-white/5 rounded-xl overflow-hidden transition-all duration-300 hover:border-purple-500/30 ${isOpen ? '' : ''}`}>
      <div 
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-white/[0.02]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-1 overflow-hidden pr-2">
          <span className="text-sm font-medium flex items-center gap-2 text-white">
            <span className="text-lg">{icon}</span> 
            {title}
          </span>
          <span className="text-[10px] text-gray-500 truncate w-full">{summary}</span>
        </div>
        <span className={`text-[10px] text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </div>
      
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px] border-t border-white/5' : 'max-h-0'}`}>
        <div className="p-4 bg-black/30">
          <pre className="p-2 rounded overflow-x-auto text-[10px] font-mono text-gray-400 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
