import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from "recharts";
import { ThumbsDown, ThumbsUp, Lightbulb, MessageSquare, TrendingUp, BarChart2, X } from "lucide-react";
import { 
  useGetTrends, 
  useGetDistribution, 
  useGetFeedback,
  useGetSubjectSessions,
} from "@workspace/api-client-react";
import { cn, formatRating } from "@/lib/utils";

type TabType = "trends" | "distribution" | "feedback";

interface SubjectDrilldownProps {
  subject: string;
  onClose: () => void;
}

export function SubjectDrilldown({ subject, onClose }: SubjectDrilldownProps) {
  const [activeTab, setActiveTab] = useState<TabType>("trends");
  const [selectedUploadId, setSelectedUploadId] = useState<number | undefined>(undefined);

  // Escape key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const { data: sessions } = useGetSubjectSessions({ subject });
  const { data: trends, isLoading: loadingTrends } = useGetTrends({ subject });
  const { data: distDelivery, isLoading: loadingDistD } = useGetDistribution({ 
    subject, type: "delivery", ...(selectedUploadId ? { upload_id: selectedUploadId } : {}) 
  });
  const { data: distContent, isLoading: loadingDistC } = useGetDistribution({ 
    subject, type: "content", ...(selectedUploadId ? { upload_id: selectedUploadId } : {}) 
  });
  const { data: feedback, isLoading: loadingFeedback } = useGetFeedback({ 
    subject, ...(selectedUploadId ? { upload_id: selectedUploadId } : {}) 
  });

  const loading = loadingTrends || loadingDistD || loadingDistC || loadingFeedback;

  const hasMultipleSessions = sessions && sessions.length > 1;

  // Format session label
  const sessionLabel = (s: NonNullable<typeof sessions>[0]) => {
    if (!s.session_date) return `Week ${s.week_number}`;
    const d = new Date(s.session_date);
    const month = d.toLocaleDateString("en-US", { month: "short" });
    return `Week ${s.week_number} (${month})`;
  };

  const distData = [
    { name: "1 ★", delivery: distDelivery?.["1"] || 0, content: distContent?.["1"] || 0 },
    { name: "2 ★", delivery: distDelivery?.["2"] || 0, content: distContent?.["2"] || 0 },
    { name: "3 ★", delivery: distDelivery?.["3"] || 0, content: distContent?.["3"] || 0 },
    { name: "4 ★", delivery: distDelivery?.["4"] || 0, content: distContent?.["4"] || 0 },
    { name: "5 ★", delivery: distDelivery?.["5"] || 0, content: distContent?.["5"] || 0 },
  ];

  const pieData = feedback ? [
    { name: "Positive", value: feedback.sentiment.positive, color: "#22c55e" },
    { name: "Negative", value: feedback.sentiment.negative, color: "#ef4444" },
    { name: "Suggestion", value: feedback.sentiment.suggestion, color: "#f59e0b" },
    { name: "Neutral", value: feedback.sentiment.neutral, color: "#6b7280" },
  ] : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-8 border border-border/50 rounded-2xl bg-card overflow-hidden shadow-2xl shadow-black/50"
    >
      {/* Header */}
      <div className="border-b border-border/50 bg-white/[0.02] p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-2 h-6 rounded-full bg-primary inline-block" />
              {subject} Drill-down
            </h3>
            <p className="text-sm text-muted-foreground mt-1 ml-4">
              Detailed performance &amp; sentiment analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-full w-8 h-8 flex items-center justify-center transition-colors flex-shrink-0"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Week selector — only if multiple sessions */}
        {hasMultipleSessions && (
          <div className="ml-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mr-1">View:</span>
            <button
              onClick={() => setSelectedUploadId(undefined)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                selectedUploadId === undefined
                  ? "bg-blue-600 text-white shadow shadow-blue-900/30"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              )}
            >
              All Sessions
            </button>
            {sessions.map((s) => (
              <button
                key={s.upload_id}
                onClick={() => setSelectedUploadId(s.upload_id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  selectedUploadId === s.upload_id
                    ? "bg-blue-600 text-white shadow shadow-blue-900/30"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                )}
              >
                {sessionLabel(s)}
              </button>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="ml-4 flex bg-background p-1 rounded-xl border border-border shadow-inner self-start">
          <button
            onClick={() => setActiveTab("trends")}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all", activeTab === "trends" ? "bg-white/10 text-white shadow" : "text-muted-foreground hover:text-white")}
          >
            <TrendingUp className="w-4 h-4" /> Trends
          </button>
          <button
            onClick={() => setActiveTab("distribution")}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all", activeTab === "distribution" ? "bg-white/10 text-white shadow" : "text-muted-foreground hover:text-white")}
          >
            <BarChart2 className="w-4 h-4" /> Distribution
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all", activeTab === "feedback" ? "bg-white/10 text-white shadow" : "text-muted-foreground hover:text-white")}
          >
            <MessageSquare className="w-4 h-4" /> Feedback NLP
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-muted-foreground animate-pulse">Analyzing {subject}...</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === "trends" && (
              <motion.div 
                key="trends"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends || []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: '#fff' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Line type="monotone" name="Delivery Rating" dataKey="avg_delivery" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" name="Content Rating" dataKey="avg_content" stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Session comparison table when All selected */}
                {!selectedUploadId && hasMultipleSessions && sessions && (
                  <div className="border border-border/50 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-white/[0.03] border-b border-border/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delivery</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Content</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s, idx) => (
                          <tr key={s.upload_id} className="border-b border-border/20">
                            <td className="px-4 py-3 text-white font-medium">{sessionLabel(s)}</td>
                            <td className="px-4 py-3 text-center text-white">{formatRating(s.avg_delivery)}</td>
                            <td className="px-4 py-3 text-center text-white">{formatRating(s.avg_content)}</td>
                            <td className="px-4 py-3 text-center text-muted-foreground">{s.total_responses}</td>
                          </tr>
                        ))}
                        {sessions.length >= 2 && (() => {
                          const first = sessions[0];
                          const last = sessions[sessions.length - 1];
                          const dDiff = last.avg_delivery - first.avg_delivery;
                          const cDiff = last.avg_content - first.avg_content;
                          const rDiff = last.total_responses - first.total_responses;
                          const fmt = (n: number) => (n > 0 ? `↑+${n.toFixed(2)}` : n < 0 ? `↓${n.toFixed(2)}` : "→0");
                          return (
                            <tr className="bg-white/[0.02]">
                              <td className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Change</td>
                              <td className={cn("px-4 py-3 text-center text-xs font-bold", dDiff > 0 ? "text-green-400" : dDiff < 0 ? "text-red-400" : "text-muted-foreground")}>{fmt(dDiff)}</td>
                              <td className={cn("px-4 py-3 text-center text-xs font-bold", cDiff > 0 ? "text-green-400" : cDiff < 0 ? "text-red-400" : "text-muted-foreground")}>{fmt(cDiff)}</td>
                              <td className={cn("px-4 py-3 text-center text-xs font-bold", rDiff > 0 ? "text-green-400" : rDiff < 0 ? "text-red-400" : "text-muted-foreground")}>{rDiff > 0 ? `+${rDiff}` : rDiff}</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "distribution" && (
              <motion.div 
                key="dist"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: '#fff' }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '20px' }} />
                      <Bar dataKey="delivery" name="Delivery" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="content" name="Content" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-6 justify-center">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery NPS</p>
                    <span className={cn("text-lg font-bold", (distDelivery?.nps || 0) > 50 ? "text-green-400" : (distDelivery?.nps || 0) > 30 ? "text-amber-400" : "text-red-400")}>
                      {distDelivery?.nps?.toFixed(1) || "0"}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Content NPS</p>
                    <span className={cn("text-lg font-bold", (distContent?.nps || 0) > 50 ? "text-green-400" : (distContent?.nps || 0) > 30 ? "text-amber-400" : "text-red-400")}>
                      {distContent?.nps?.toFixed(1) || "0"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "feedback" && feedback && (
              <motion.div 
                key="feedback"
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="col-span-1 border border-border/50 rounded-xl bg-white/[0.01] p-6 flex flex-col items-center justify-center">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Sentiment Breakdown</h4>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%" cy="50%"
                          innerRadius={60} outerRadius={80}
                          paddingAngle={5} dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3 mt-4">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                  {/* Theme tags */}
                  {feedback.themes.length > 0 && (
                    <div className="mt-4 w-full">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Top Themes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {feedback.themes.slice(0, 6).map((t) => (
                          <span key={t.theme} className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/70">
                            {t.theme} ×{t.count}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-5">
                    <h4 className="flex items-center gap-2 text-red-400 font-semibold mb-3">
                      <ThumbsDown className="w-4 h-4" /> Top Negative
                    </h4>
                    <ul className="space-y-2">
                      {feedback.top_negative.length > 0 ? feedback.top_negative.map((text, i) => (
                        <li key={i} className="text-sm text-foreground/80 leading-relaxed border-l-2 border-red-500/50 pl-3 py-1">
                          {text}
                        </li>
                      )) : (
                        <li className="text-sm text-muted-foreground italic">No negative feedback found.</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-5">
                    <h4 className="flex items-center gap-2 text-amber-400 font-semibold mb-3">
                      <Lightbulb className="w-4 h-4" /> Suggestions
                    </h4>
                    <ul className="space-y-2">
                      {feedback.top_suggestions.length > 0 ? feedback.top_suggestions.map((text, i) => (
                        <li key={i} className="text-sm text-foreground/80 leading-relaxed border-l-2 border-amber-500/50 pl-3 py-1">
                          {text}
                        </li>
                      )) : (
                        <li className="text-sm text-muted-foreground italic">No suggestions provided.</li>
                      )}
                    </ul>
                  </div>

                  <div className="md:col-span-2 bg-green-950/20 border border-green-500/20 rounded-xl p-5">
                    <h4 className="flex items-center gap-2 text-green-400 font-semibold mb-3">
                      <ThumbsUp className="w-4 h-4" /> What's Working Well
                    </h4>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {feedback.top_positive.length > 0 ? feedback.top_positive.map((text, i) => (
                        <li key={i} className="text-sm text-foreground/80 leading-relaxed border-l-2 border-green-500/50 pl-3 py-1">
                          {text}
                        </li>
                      )) : (
                        <li className="text-sm text-muted-foreground italic">No specific positive highlights.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
