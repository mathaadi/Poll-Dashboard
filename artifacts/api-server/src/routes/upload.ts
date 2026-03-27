import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { uploadsTable, pollResponsesTable, studentsTable } from "@workspace/db/schema";
import { parseZoomCsv } from "../services/csvParser.js";
import { isUsefulFeedback, classifySentiment, classifyThemes } from "../services/nlp.js";
import { computeAverage, computeNPS } from "../services/metrics.js";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "NO_FILE", message: "No file uploaded" });
    }

    const program_name = (req.body.program_name as string) || "Unknown Program";
    const semester = (req.body.semester as string) || "";
    const week_number = (req.body.week_number as string) || "";
    const cohort_override = (req.body.cohort as string) || "";

    // Parse CSV
    const fileContent = req.file.buffer.toString("utf-8");
    const parsed = parseZoomCsv(fileContent);

    // Check for duplicate
    const existing = await db
      .select()
      .from(uploadsTable)
      .where(eq(uploadsTable.meeting_id, parsed.meeting_id))
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: "DUPLICATE",
        message: `This poll was already uploaded on ${existing[0].upload_timestamp}`,
        original_upload_date: existing[0].upload_timestamp,
      });
    }

    // Compute metrics
    const deliveryRatings = parsed.responses.map((r) => r.delivery_rating);
    const contentRatings = parsed.responses.map((r) => r.content_rating);

    const avg_delivery = computeAverage(deliveryRatings);
    const avg_content = computeAverage(contentRatings);
    const avg_combined =
      avg_delivery !== null && avg_content !== null
        ? (avg_delivery + avg_content) / 2
        : avg_delivery ?? avg_content ?? null;
    const nps_delivery = computeNPS(deliveryRatings);
    const nps_content = computeNPS(contentRatings);

    const useful_feedbacks = parsed.responses
      .map((r) => r.feedback_text)
      .filter((t) => isUsefulFeedback(t));
    const feedback_count = useful_feedbacks.length;

    const now = new Date().toISOString();

    // Insert upload record
    const [uploadRecord] = await db
      .insert(uploadsTable)
      .values({
        meeting_id: parsed.meeting_id,
        meeting_topic: parsed.meeting_topic,
        subject: parsed.subject,
        session_type: parsed.session_type,
        program_name,
        cohort: cohort_override || null,
        semester,
        week_number,
        session_date: parsed.session_date,
        upload_timestamp: now,
        total_responses: parsed.responses.length,
        avg_delivery_rating: avg_delivery,
        avg_content_rating: avg_content,
        avg_combined_rating: avg_combined,
        feedback_count,
        nps_delivery,
        nps_content,
      })
      .returning();

    // Insert poll responses
    for (const response of parsed.responses) {
      const useful = isUsefulFeedback(response.feedback_text);
      const sentiment = useful ? classifySentiment(response.feedback_text) : null;
      const themes = useful ? classifyThemes(response.feedback_text) : [];

      await db.insert(pollResponsesTable).values({
        upload_id: uploadRecord.id,
        student_name: response.student_name,
        student_email: response.student_email,
        cohort: response.cohort,
        submission_time: response.submission_time,
        delivery_rating: response.delivery_rating,
        content_rating: response.content_rating,
        feedback_text: response.feedback_text || null,
        feedback_sentiment: sentiment,
        feedback_themes: themes.length > 0 ? themes.join(",") : null,
        is_useful_feedback: useful ? 1 : 0,
      });

      // Upsert student record
      if (response.student_email) {
        const existingStudent = await db
          .select()
          .from(studentsTable)
          .where(eq(studentsTable.email, response.student_email))
          .limit(1);

        if (existingStudent.length > 0) {
          await db
            .update(studentsTable)
            .set({
              last_seen: now,
              total_sessions: (existingStudent[0].total_sessions || 0) + 1,
            })
            .where(eq(studentsTable.email, response.student_email));
        } else {
          await db.insert(studentsTable).values({
            email: response.student_email,
            name: response.student_name,
            cohort: response.cohort,
            first_seen: now,
            last_seen: now,
            total_sessions: 1,
          });
        }
      }
    }

    return res.json({
      success: true,
      upload_id: uploadRecord.id,
      subject: parsed.subject,
      total_responses: parsed.responses.length,
      avg_delivery_rating: avg_delivery,
      avg_content_rating: avg_content,
      message: `Successfully processed ${parsed.responses.length} responses for ${parsed.subject}`,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Upload error");
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ success: false, error: "PARSE_ERROR", message });
  }
});

export default router;
