import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, Clock } from "lucide-react";
import { useUploadCsv, useGetHistory } from "@workspace/api-client-react";
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
});

type UploadFormValues = z.infer<typeof uploadSchema>;

export default function Upload() {
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      program_name: "BS Data Science",
      session_type: "Theory",
      cohort: "",
      semester: "",
      week_number: "",
    }
  });

  const selectedFile = watch("file");
  const fileName = selectedFile?.[0]?.name;

  const { mutate: upload, isPending } = useUploadCsv({
    mutation: {
      onSuccess: (res) => {
        setUploadStatus({ type: 'success', message: `Successfully processed ${res.total_responses} responses for ${res.subject}.` });
        reset();
        queryClient.invalidateQueries({ queryKey: ["/api/history"] });
        queryClient.invalidateQueries({ queryKey: ["/api/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/cohorts"] });
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
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20">
      <div>
        <h1 className="text-3xl font-display font-bold text-white mb-2">Upload Zoom Poll</h1>
        <p className="text-muted-foreground">Import raw CSV reports from Zoom to generate detailed analytics.</p>
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
                <p className="text-sm text-success mt-1">Ready to upload</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-semibold text-white">Drag & drop your CSV here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse from your computer</p>
              </div>
            )}
          </div>
          {errors.file && <p className="text-sm text-destructive font-medium mt-1">{errors.file.message as string}</p>}

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
                    <th className="px-6 py-4 font-semibold">Responses</th>
                    <th className="px-6 py-4 font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, i) => (
                    <tr key={item.id} className={cn("border-b border-border/20 hover:bg-white/[0.02] transition-colors", i === history.length - 1 && "border-0")}>
                      <td className="px-6 py-4 text-muted-foreground">
                        {format(new Date(item.upload_timestamp), "MMM d, yyyy • h:mm a")}
                      </td>
                      <td className="px-6 py-4 font-medium text-white">{item.subject}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {item.program_name} <br/>
                        <span className="text-xs opacity-70">Week {item.week_number} • {item.session_type}</span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{item.total_responses}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
                          {formatRating(item.avg_combined_rating)}
                        </span>
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
