import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, Clock, Pencil, X } from "lucide-react";
import { useUploadCsv, useGetHistory, usePatchUpload } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, formatRating } from "@/lib/utils";

const uploadSchema = z.object({
  file: z.custom<FileList>()
    .refine((files) => files?.length === 1, "Please select a CSV file.")
    .refine((files) => files?.[0]?.name.endsWith(".csv"), "File must be a CSV."),
  program_name: z.string().min(1, "Program Name is required."),
  session_type: z.string().min(1, "Session Type is required."),
  cohort: z.string().optional(),
  semester: z.string().min(1, "Semester is required."),
  week_number: z.string().min(1, "Week Number is required."),
  instructor: z.string().optional(),
  topic: z.string().optional(),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

function detectFormatB(content: string): boolean {
  const firstLine = content.split("\n")[0].toLowerCase();
  if (
    firstLine.includes("instructor") ||
    firstLine.includes("topic/name") ||
    firstLine.includes("session rating")
  ) return true;
  if (firstLine.includes("overview")) return false;
  const first3 = content.split("\n").slice(0, 3).join("\n").toLowerCase();
  return first3.includes("user name") && first3.includes("email");
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else current += ch;
  }
  result.push(current);
  return result;
}

function extractFormatBDefaults(content: string): { instructor: string; topic: string } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { instructor: "", topic: "" };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());
  const instrIdx = headers.findIndex((h) => h.includes("instructor"));
  const topicIdx = headers.findIndex((h) => h.includes("topic"));
  const instructorCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (instrIdx >= 0 && cols[instrIdx]?.trim()) {
      const v = cols[instrIdx].trim();
      instructorCounts[v] = (instructorCounts[v] || 0) + 1;
    }
    if (topicIdx >= 0 && cols[topicIdx]?.trim()) {
      const v = cols[topicIdx].trim();
      topicCounts[v] = (topicCounts[v] || 0) + 1;
    }
  }
  const instructor = Object.entries(instructorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const topic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return { instructor, topic };
}

interface EditModalProps {
  uploadId: number;
  currentInstructor: string | null;
  currentTopic: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ uploadId, currentInstructor, currentTopic, onClose, onSaved }: EditModalProps) {
  const [instructor, setInstructor] = useState(currentInstructor || "");
  const [topic, setTopic] = useState(currentTopic || "");

  const { mutate: patch, isPending } = usePatchUpload({
    mutation: {
      onSuccess: () => { onSaved(); onClose(); },
    }
  });

  const handleSave = () => {
    patch({
      id: uploadId,
      data: {
        instructor: instructor || null,
        topic: topic || null,
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-white">Edit Session Info</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Update instructor and topic for this session. These fields can be set or changed at any time.</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white">Instructor Name</label>
            <input
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="e.g. Dr. Sharma"
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white">Topic / Chapter</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Decision Trees"
              className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white border border-border hover:border-border/80 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Upload() {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [detectedFormatB, setDetectedFormatB] = useState(false);
  const [editingUpload, setEditingUpload] = useState<{
    id: number;
    instructor: string | null;
    topic: string | null;
  } | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      program_name: "BS Data Science",
      session_type: "Theory",
      cohort: "",
      semester: "",
      week_number: "",
      instructor: "",
      topic: "",
    }
  });

  const selectedFile = watch("file");
  const fileName = selectedFile?.[0]?.name;

  // Client-side Format B detection + pre-fill
  useEffect(() => {
    const file = selectedFile?.[0];
    if (!file) { setDetectedFormatB(false); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;
      const isFormatB = detectFormatB(content);
      setDetectedFormatB(isFormatB);
      if (isFormatB) {
        const { instructor, topic } = extractFormatBDefaults(content);
        if (instructor) setValue("instructor", instructor);
        if (topic) setValue("topic", topic);
      }
    };
    reader.readAsText(file);
  }, [selectedFile, setValue]);

  const { mutate: upload, isPending } = useUploadCsv({
    mutation: {
      onSuccess: (res) => {
        setUploadStatus({ type: 'success', message: `Successfully processed ${res.total_responses} responses for ${res.subject}.` });
        reset();
        setDetectedFormatB(false);
        queryClient.invalidateQueries({ queryKey: ["/api/history"] });
        queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/instructors"] });
        queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err.message || "Failed to upload CSV.";
        setUploadStatus({ type: 'error', message: msg });
      }
    }
  });

  const { data: history, isLoading: historyLoading } = useGetHistory();

  const onSubmit = (data: UploadFormValues) => {
    setUploadStatus(null);
    upload({
      data: {
        file: data.file[0],
        program_name: data.program_name,
        session_type: data.session_type,
        cohort: data.cohort,
        semester: data.semester,
        week_number: data.week_number,
        instructor: data.instructor || undefined,
        topic: data.topic || undefined,
      }
    });
  };

  const handleEditSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/history"] });
    queryClient.invalidateQueries({ queryKey: ["/api/instructors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/topics"] });
    queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      {editingUpload && (
        <EditModal
          uploadId={editingUpload.id}
          currentInstructor={editingUpload.instructor}
          currentTopic={editingUpload.topic}
          onClose={() => setEditingUpload(null)}
          onSaved={handleEditSaved}
        />
      )}

      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-2">Upload Zoom Poll</h1>
        <p className="text-muted-foreground">Import raw CSV reports from Zoom to generate detailed analytics. Supports both Zoom export format and flat CSV format.</p>
      </div>

      <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden relative">
        {uploadStatus && (
          <div className={cn(
            "px-6 py-4 border-b flex items-center gap-3",
            uploadStatus.type === 'success' ? "bg-success/10 border-success/20 text-success" : "bg-destructive/10 border-destructive/20 text-destructive"
          )}>
            {uploadStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="font-medium">{uploadStatus.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-8">
          {/* File Upload Area */}
          <div 
            className={cn(
              "relative group border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all duration-200 text-center min-h-[200px]",
              dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-white/[0.02]",
              errors.file ? "border-destructive bg-destructive/5" : ""
            )}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); }}
          >
            <input 
              type="file" 
              accept=".csv"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              {...register("file")}
            />
            <div className="w-16 h-16 rounded-full bg-background border border-border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              {fileName ? <FileType className="w-8 h-8 text-primary" /> : <UploadCloud className="w-8 h-8 text-muted-foreground" />}
            </div>
            {fileName ? (
              <div>
                <p className="text-lg font-semibold text-white">{fileName}</p>
                <p className="text-sm text-success mt-1">
                  {detectedFormatB ? "Format B detected — instructor & topic auto-filled" : "Ready to upload"}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-semibold text-white">Drag & drop your CSV here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse from your computer</p>
              </div>
            )}
          </div>
          {errors.file && <p className="text-sm text-destructive font-medium mt-1">{errors.file.message as string}</p>}

          {detectedFormatB && (
            <div className="bg-primary/10 border border-primary/20 rounded-xl px-5 py-3 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              <p className="text-sm text-primary font-medium">Format B CSV detected. Instructor and topic have been pre-filled from the file — you can override them below.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Program Name</label>
              <select 
                {...register("program_name")}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
              >
                <option value="BS Data Science">BS Data Science</option>
                <option value="MS Data Science">MS Data Science</option>
                <option value="PhD">PhD</option>
              </select>
              {errors.program_name && <p className="text-xs text-destructive">{errors.program_name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Session Type</label>
              <select 
                {...register("session_type")}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
              >
                <option value="Theory">Theory</option>
                <option value="Practical">Practical</option>
              </select>
              {errors.session_type && <p className="text-xs text-destructive">{errors.session_type.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Semester</label>
              <input 
                {...register("semester")}
                placeholder="e.g. Trimester 1, Semester 2"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {errors.semester && <p className="text-xs text-destructive">{errors.semester.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Week Number</label>
              <input 
                {...register("week_number")}
                placeholder="e.g. 1, 2, Week 3"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              {errors.week_number && <p className="text-xs text-destructive">{errors.week_number.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex items-center justify-between">
                Instructor Name
                <span className="text-xs text-muted-foreground font-normal">Optional</span>
              </label>
              <input 
                {...register("instructor")}
                placeholder="e.g. Dr. Sharma"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white flex items-center justify-between">
                Topic / Chapter
                <span className="text-xs text-muted-foreground font-normal">Optional</span>
              </label>
              <input 
                {...register("topic")}
                placeholder="e.g. Decision Trees, SQL Joins"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground">E.g. Decision Trees, SQL Joins, Linear Regression</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-white flex items-center justify-between">
                Cohort
                <span className="text-xs text-muted-foreground font-normal">Optional - Will auto-detect if left blank</span>
              </label>
              <input 
                {...register("cohort")}
                placeholder="e.g. DS2024"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending || !fileName}
              className="px-8 py-3 bg-primary text-white font-semibold rounded-xl shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  Upload & Analyze
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* History Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xl font-display font-bold text-white">
          <Clock className="w-5 h-5 text-primary" />
          Recent Uploads
        </div>

        <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
          {historyLoading ? (
            <div className="p-10 flex justify-center">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No poll history found. Upload a file above to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-white/[0.02] border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Date Uploaded</th>
                    <th className="px-6 py-4 font-semibold">Subject</th>
                    <th className="px-6 py-4 font-semibold">Program</th>
                    <th className="px-6 py-4 font-semibold">Instructor / Topic</th>
                    <th className="px-6 py-4 font-semibold">Responses</th>
                    <th className="px-6 py-4 font-semibold">Score</th>
                    <th className="px-6 py-4 font-semibold">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, i) => (
                    <tr key={item.id} className={cn("border-b border-border/20 hover:bg-white/[0.02] transition-colors", i === history.length - 1 && "border-0")}>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.upload_timestamp), "MMM d, yyyy • h:mm a")}
                      </td>
                      <td className="px-6 py-4 font-medium text-white">{item.subject}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {item.program_name} <br/>
                        <span className="text-xs opacity-70">Week {item.week_number} • {item.session_type}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {item.instructor ? (
                          <span className="text-white font-medium">{item.instructor}</span>
                        ) : (
                          <span className="italic opacity-50">No instructor</span>
                        )}
                        {item.topic && (
                          <><br/><span className="text-xs opacity-70">{item.topic}</span></>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{item.total_responses}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                          {formatRating(item.avg_combined_rating)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setEditingUpload({ id: item.id, instructor: item.instructor ?? null, topic: item.topic ?? null })}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-all"
                          title="Edit instructor & topic"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
