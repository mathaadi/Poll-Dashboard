import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Presentation, Star, Award, ChevronRight } from "lucide-react";
import { 
  useGetSummary, 
  useGetSubjects, 
  useGetCohorts 
} from "@workspace/api-client-react";
import { cn, formatRating, formatNPS } from "@/lib/utils";
import { SubjectDrilldown } from "@/components/subject-drilldown";

export default function Dashboard() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const drilldownRef = useRef<HTMLDivElement>(null);

  const { data: summary, isLoading: sumLoading } = useGetSummary();
  const { data: subjects, isLoading: subLoading } = useGetSubjects();
  const { data: cohorts, isLoading: cohLoading } = useGetCohorts();

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

  return (
    <div className="space-y-8 pb-20">
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

      {/* Subject Cards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-display font-bold text-white">Subject Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects?.map((sub, i) => (
            <motion.div
              key={sub.subject}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedSubject(sub.subject)}
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
                  sub.nps > 50 ? "bg-success/20 text-success" : 
                  sub.nps > 20 ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"
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
        {selectedSubject && (
          <SubjectDrilldown subject={selectedSubject} />
        )}
      </div>

      {/* Cohort Heatmap/Table */}
      {cohorts && cohorts.length > 0 && (
        <div className="space-y-4 mt-12">
          <h2 className="text-2xl font-display font-bold text-white">Cohort Breakdown</h2>
          <div className="overflow-x-auto bg-card border border-border/50 rounded-2xl shadow-xl">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-white/[0.02] border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-semibold">Cohort</th>
                  <th className="px-6 py-4 font-semibold">Responses</th>
                  <th className="px-6 py-4 font-semibold">Overall Delivery</th>
                  <th className="px-6 py-4 font-semibold">Overall Content</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((cohort, i) => (
                  <tr key={cohort.cohort} className={cn("border-b border-border/20 hover:bg-white/[0.02] transition-colors", i === cohorts.length - 1 && "border-0")}>
                    <td className="px-6 py-4 font-medium text-white">{cohort.cohort}</td>
                    <td className="px-6 py-4 text-muted-foreground">{cohort.total_responses}</td>
                    <td className="px-6 py-4">
                      <span className={cn("font-medium", cohort.avg_delivery >= 4.0 ? "text-success" : cohort.avg_delivery < 3.0 ? "text-destructive" : "text-white")}>
                        {formatRating(cohort.avg_delivery)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("font-medium", cohort.avg_content >= 4.0 ? "text-success" : cohort.avg_content < 3.0 ? "text-destructive" : "text-white")}>
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
