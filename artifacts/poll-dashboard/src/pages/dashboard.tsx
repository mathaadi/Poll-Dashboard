import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Presentation, Star, Award, ChevronRight, MessageSquare } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts";
import { 
  useGetSummary, 
  useGetSubjects, 
  useGetCohorts,
  useGetDistributionOverall,
  useGetFeedbackOverview,
} from "@workspace/api-client-react";
import { cn, formatRating, formatNPS } from "@/lib/utils";
import { SubjectDrilldown } from "@/components/subject-drilldown";

export default function Dashboard() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const drilldownRef = useRef<HTMLDivElement>(null);

  const { data: summary, isLoading: sumLoading } = useGetSummary();
  const { data: subjects, isLoading: subLoading } = useGetSubjects();
  const { data: cohorts, isLoading: cohLoading } = useGetCohorts();
  const { data: overallDist } = useGetDistributionOverall();
  const { data: feedbackOverview } = useGetFeedbackOverview();

  useEffect(() => {
    if (selectedSubject && drilldownRef.current) {
      setTimeout(() => {
        drilldownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [selectedSubject]);

  if (sumLoading || subLoading || cohLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground font-medium animate-pulse">Compiling analytics...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
          <Presentation className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-white">No Data Available</h2>
        <p className="text-muted-foreground max-w-md">
          There are no poll results to display yet. Head over to the Upload page to process your first Zoom poll CSV.
        </p>
      </div>
    );
  }

  const kpis = [
    { label: "Total Sessions", value: summary.total_sessions, icon: Presentation, color: "text-blue-400" },
    { label: "Total Responses", value: summary.total_responses, icon: Users, color: "text-purple-400" },
    { label: "Avg Delivery", value: formatRating(summary.avg_delivery), icon: Star, color: "text-amber-400" },
    { label: "Avg Content", value: formatRating(summary.avg_content), icon: Star, color: "text-emerald-400" },
    { label: "Overall Score", value: formatRating(summary.avg_combined), icon: Award, color: "text-rose-400" },
  ];

  // Overall distribution chart data
  const overallDistData = overallDist ? [
    { name: "1 ★", delivery: overallDist.delivery["1"], content: overallDist.content["1"] },
    { name: "2 ★", delivery: overallDist.delivery["2"], content: overallDist.content["2"] },
    { name: "3 ★", delivery: overallDist.delivery["3"], content: overallDist.content["3"] },
    { name: "4 ★", delivery: overallDist.delivery["4"], content: overallDist.content["4"] },
    { name: "5 ★", delivery: overallDist.delivery["5"], content: overallDist.content["5"] },
  ] : [];

  // Subject comparison chart data
  const subjectCompData = subjects?.map((s) => ({
    name: s.subject,
    Delivery: s.avg_delivery,
    Content: s.avg_content,
  })) || [];

  const npsColor = (nps: number) =>
    nps > 50 ? "text-green-400 bg-green-400/10" : nps > 30 ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10";

  const sentimentIcons: Record<string, string> = {
    positive: "✅",
    negative: "🔴",
    suggestion: "💡",
    neutral: "⚪",
  };

  const handleSelectSubject = (subjectName: string) => {
    setSelectedSubject(prev => prev === subjectName ? null : subjectName);
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold text-white">Executive Summary</h1>
        <p className="text-muted-foreground">
          {summary.date_range.from && summary.date_range.to
            ? `Showing data from ${summary.date_range.from} to ${summary.date_range.to}`
            : "No sessions uploaded yet"}
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = kpi.icon;
          return (
            <motion.div 
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border/50 rounded-2xl p-5 relative overflow-hidden group hover:border-primary/50 transition-colors"
            >
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
              <div className="flex flex-col gap-3 relative z-10">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                  <Icon className={cn("w-4 h-4", kpi.color)} />
                </div>
                <h3 className="text-3xl font-bold text-white tracking-tight">{kpi.value}</h3>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Overall Rating Distribution */}
      {overallDist && overallDist.total_responses > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-white">Overall Rating Distribution</h2>
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overallDistData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={8} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dx={-8} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '16px' }} />
                  <Bar dataKey="delivery" name="Delivery" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="content" name="Content" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-6 mt-4 justify-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Delivery NPS:</span>
                <span className={cn("px-3 py-1 rounded-full text-sm font-bold", npsColor(overallDist.nps_delivery))}>
                  {overallDist.nps_delivery.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Content NPS:</span>
                <span className={cn("px-3 py-1 rounded-full text-sm font-bold", npsColor(overallDist.nps_content))}>
                  {overallDist.nps_content.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subject Performance Cards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-bold text-white">Subject Performance</h2>

        {/* Subject comparison bar chart */}
        {subjectCompData.length > 1 && (
          <div className="bg-card border border-border/50 rounded-2xl p-5 mb-4">
            <p className="text-sm text-muted-foreground mb-4 font-medium">Delivery vs Content — all subjects</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectCompData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis domain={[3, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dx={-8} />
                  <RechartsTooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend />
                  <Bar dataKey="Delivery" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Content" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects?.map((sub, i) => (
            <motion.div
              key={sub.subject}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleSelectSubject(sub.subject)}
              className={cn(
                "group cursor-pointer rounded-2xl border p-6 transition-all duration-300 relative overflow-hidden",
                selectedSubject === sub.subject 
                  ? "bg-primary/5 border-primary shadow-lg shadow-primary/10" 
                  : "bg-card border-border/50 hover:border-border hover:shadow-xl hover:-translate-y-1"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-white truncate pr-4">{sub.subject}</h3>
                <div className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-bold",
                  sub.nps > 50 ? "bg-green-500/20 text-green-400" : 
                  sub.nps > 20 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                )}>
                  {formatNPS(sub.nps)} NPS
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Delivery</p>
                  <p className="text-xl font-bold text-white">{formatRating(sub.avg_delivery)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Content</p>
                  <p className="text-xl font-bold text-white">{formatRating(sub.avg_content)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sessions</p>
                  <p className="text-lg font-medium text-white/80">{sub.total_sessions}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Responses</p>
                  <p className="text-lg font-medium text-white/80">{sub.total_responses}</p>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-primary text-primary-foreground rounded-full p-2">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Drilldown Area */}
      <div ref={drilldownRef}>
        <AnimatePresence>
          {selectedSubject && (
            <SubjectDrilldown 
              key={selectedSubject}
              subject={selectedSubject} 
              onClose={() => setSelectedSubject(null)} 
            />
          )}
        </AnimatePresence>
      </div>

      {/* Feedback Sentiment Overview */}
      {feedbackOverview && feedbackOverview.total_useful > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-primary" />
            Feedback Sentiment — All Sessions
          </h2>
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {(["positive", "negative", "suggestion", "neutral"] as const).map((key) => {
                const pct = feedbackOverview.sentiment_percent[key];
                const count = feedbackOverview.sentiment_counts[key];
                const colors: Record<string, string> = {
                  positive: "bg-green-500",
                  negative: "bg-red-500",
                  suggestion: "bg-amber-500",
                  neutral: "bg-gray-500",
                };
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground capitalize flex items-center gap-1">
                        {sentimentIcons[key]} {key}
                      </span>
                      <span className="text-sm font-bold text-white">{pct}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", colors[key])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{count} responses</p>
                  </div>
                );
              })}
            </div>
            {feedbackOverview.top_themes.length > 0 && (
              <div className="border-t border-border/30 pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Top Themes</p>
                <div className="flex flex-wrap gap-2">
                  {feedbackOverview.top_themes.map((t) => (
                    <span key={t.theme} className="px-3 py-1 bg-white/10 rounded-full text-sm text-white/80 font-medium">
                      {t.theme} <span className="text-muted-foreground">×{t.count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cohort Breakdown Table */}
      {cohorts && cohorts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-display font-bold text-white">Cohort Breakdown</h2>
          <div className="overflow-x-auto bg-card border border-border/50 rounded-2xl shadow-xl">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-white/[0.02] border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Cohort</th>
                  <th className="px-6 py-4 font-semibold">Responses</th>
                  <th className="px-6 py-4 font-semibold">Avg Delivery</th>
                  <th className="px-6 py-4 font-semibold">Avg Content</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort, i) => (
                  <tr key={cohort.cohort} className={cn("border-b border-border/20 hover:bg-white/[0.02] transition-colors", i === cohorts.length - 1 && "border-0")}>
                    <td className="px-6 py-4 font-medium text-white">{cohort.cohort}</td>
                    <td className="px-6 py-4 text-muted-foreground">{cohort.total_responses}</td>
                    <td className="px-6 py-4">
                      <span className={cn("font-medium", cohort.avg_delivery >= 4.0 ? "text-green-400" : cohort.avg_delivery < 3.0 ? "text-red-400" : "text-white")}>
                        {formatRating(cohort.avg_delivery)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("font-medium", cohort.avg_content >= 4.0 ? "text-green-400" : cohort.avg_content < 3.0 ? "text-red-400" : "text-white")}>
                        {formatRating(cohort.avg_content)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
