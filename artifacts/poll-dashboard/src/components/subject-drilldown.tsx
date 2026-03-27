import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell 
} from "recharts";
import { ThumbsDown, ThumbsUp, Lightbulb, MessageSquare, TrendingUp, BarChart2 } from "lucide-react";
import { 
  useGetTrends, 
  useGetDistribution, 
  useGetFeedback 
} from "@workspace/api-client-react";
import { cn, formatRating } from "@/lib/utils";

type TabType = "trends" | "distribution" | "feedback";

export function SubjectDrilldown({ subject }: { subject: string }) {
  const [activeTab, setActiveTab] = useState<TabType>("trends");

  const { data: trends, isLoading: loadingTrends } = useGetTrends({ subject });
  const { data: distDelivery, isLoading: loadingDistD } = useGetDistribution({ subject, type: "delivery" });
  const { data: distContent, isLoading: loadingDistC } = useGetDistribution({ subject, type: "content" });
  const { data: feedback, isLoading: loadingFeedback } = useGetFeedback({ subject });

  const loading = loadingTrends || loadingDistD || loadingDistC || loadingFeedback;

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center border border-border rounded-2xl bg-card">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground animate-pulse">Analyzing {subject}...</p>
        </div>
      </div>
    );
  }

  const distData = [
    { name: "1 Star", delivery: distDelivery?.["1"] || 0, content: distContent?.["1"] || 0 },
    { name: "2 Stars", delivery: distDelivery?.["2"] || 0, content: distContent?.["2"] || 0 },
    { name: "3 Stars", delivery: distDelivery?.["3"] || 0, content: distContent?.["3"] || 0 },
    { name: "4 Stars", delivery: distDelivery?.["4"] || 0, content: distContent?.["4"] || 0 },
    { name: "5 Stars", delivery: distDelivery?.["5"] || 0, content: distContent?.["5"] || 0 },
  ];

  const pieData = feedback ? [
    { name: "Positive", value: feedback.sentiment.positive, color: "hsl(var(--success))" },
    { name: "Negative", value: feedback.sentiment.negative, color: "hsl(var(--destructive))" },
    { name: "Suggestion", value: feedback.sentiment.suggestion, color: "hsl(var(--warning))" },
    { name: "Neutral", value: feedback.sentiment.neutral, color: "hsl(var(--muted-foreground))" },
  ] : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 border border-border/50 rounded-2xl bg-card overflow-hidden shadow-2xl shadow-black/50"
    >
      <div className="border-b border-border/50 bg-white/[0.02] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2 h-6 rounded-full bg-primary inline-block" />
            {subject} Drill-down
          </h3>
          <p className="text-sm text-muted-foreground mt-1 ml-4">
            Detailed performance & sentiment analysis
          </p>
        </div>
        
        <div className="flex bg-background p-1 rounded-xl border border-border shadow-inner">
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
        <AnimatePresence mode="wait">
          {activeTab === "trends" && (
            <motion.div 
              key="trends"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="h-[400px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends || []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis domain={[0, 5]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" name="Delivery Rating" dataKey="avg_delivery" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" name="Content Rating" dataKey="avg_content" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {activeTab === "distribution" && (
            <motion.div 
              key="dist"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="h-[400px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
                  <RechartsTooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="delivery" name="Delivery" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="content" name="Content" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
              </div>

              <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-5">
                  <h4 className="flex items-center gap-2 text-destructive font-semibold mb-3">
                    <ThumbsDown className="w-4 h-4" /> Top Negative Themes
                  </h4>
                  <ul className="space-y-2">
                    {feedback.top_negative.length > 0 ? feedback.top_negative.map((text, i) => (
                      <li key={i} className="text-sm text-foreground/80 leading-relaxed border-l-2 border-destructive/50 pl-3 py-1">
                        {text}
                      </li>
                    )) : (
                      <li className="text-sm text-muted-foreground italic">No negative feedback found.</li>
                    )}
                  </ul>
                </div>

                <div className="bg-warning/5 border border-warning/20 rounded-xl p-5">
                  <h4 className="flex items-center gap-2 text-warning font-semibold mb-3">
                    <Lightbulb className="w-4 h-4" /> Suggestions for Improvement
                  </h4>
                  <ul className="space-y-2">
                    {feedback.top_suggestions.length > 0 ? feedback.top_suggestions.map((text, i) => (
                      <li key={i} className="text-sm text-foreground/80 leading-relaxed border-l-2 border-warning/50 pl-3 py-1">
                        {text}
                      </li>
                    )) : (
                      <li className="text-sm text-muted-foreground italic">No suggestions provided.</li>
                    )}
                  </ul>
                </div>

                <div className="md:col-span-2 bg-success/5 border border-success/20 rounded-xl p-5">
                  <h4 className="flex items-center gap-2 text-success font-semibold mb-3">
                    <ThumbsUp className="w-4 h-4" /> What's Working Well
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {feedback.top_positive.length > 0 ? feedback.top_positive.map((text, i) => (
                      <li key={i} className="text-sm text-foreground/80 leading-relaxed border-l-2 border-success/50 pl-3 py-1">
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
      </div>
    </motion.div>
  );
}
