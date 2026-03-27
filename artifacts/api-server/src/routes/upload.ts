import { Router, type IRouter } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { uploadsTable, pollResponsesTable, studentsTable } from "@workspace/db/schema";
import { parseZoomCsv } from "../services/csvParser.js";
import { classifyFeedback } from "../services/nlp.js";
import { computeAverage, computeNPS } from "../services/metrics.js";
import { eq, sql } from "drizzle-orm";

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
    const instructor_override = (req.body.instructor as string) || "";
    const topic_override = (req.body.topic as string) || "";

    const fileContent = req.file.buffer.toString("utf-8");
    const parsed = parseZoomCsv(fileContent);

    // For Format B, subject/session_type come from the form since the CSV doesn't have them
    if (parsed.format === "FORMAT_B") {
      parsed.subject = (req.body.subject as string) || parsed.subject || "Unknown Subject";
      parsed.session_type = (req.body.session_type as string) || parsed.session_type || "Theory";
    }

    // Allow form overrides for instructor and topic
    const finalInstructor = instructor_override || parsed.instructor || null;
    const finalTopic = topic_override || parsed.topic || null;

    // Duplicate detection
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

    const now = new Date().toISOString();

    // Run NLP on all feedback serially
    const nlpResults = [];
    for (const response of parsed.responses) {
      const nlp = await classifyFeedback(response.feedback_text || "");
      nlpResults.push(nlp);
    }

    // Run NLP on additional feedback (Format B)
    const additionalNlpResults = [];
    for (const response of parsed.responses) {
      if (response.additional_feedback) {
        const nlp = await classifyFeedback(response.additional_feedback);
        additionalNlpResults.push(nlp);
      } else {
        additionalNlpResults.push(null);
      }
    }

    const feedback_count = nlpResults.filter((r) => r.is_useful).length;

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
        format_version: parsed.format === "FORMAT_B" ? "B" : "A",
        instructor: finalInstructor,
        topic: finalTopic,
      })
      .returning();

    // Insert poll responses with NLP results
    for (let i = 0; i < parsed.responses.length; i++) {
      const response = parsed.responses[i];
      const nlp = nlpResults[i];
      const addNlp = additionalNlpResults[i];

      await db.insert(pollResponsesTable).values({
        upload_id: uploadRecord.id,
        student_name: response.student_name,
        student_email: response.student_email,
        cohort: response.cohort,
        submission_time: response.submission_time,
        delivery_rating: response.delivery_rating,
        content_rating: response.content_rating,
        feedback_text: response.feedback_text || null,
        feedback_sentiment: nlp.sentiment,
        feedback_themes: nlp.themes || null,
        is_useful_feedback: nlp.is_useful ? 1 : 0,
        translated_text: nlp.translated_text,
        instructor: response.instructor || finalInstructor,
        topic: response.topic || finalTopic,
        additional_feedback: response.additional_feedback || null,
        additional_sentiment: addNlp?.sentiment || null,
        additional_themes: addNlp?.themes || null,
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
      format: parsed.format,
      instructor: finalInstructor,
      topic: finalTopic,
      message: `Successfully processed ${parsed.responses.length} responses for ${parsed.subject}`,
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Upload error");
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ success: false, error: "PARSE_ERROR", message });
  }
});

// PATCH /api/upload/:id — update instructor and topic for a session
router.patch("/upload/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid upload ID" });
    }

    const instructor = req.body.instructor !== undefined ? (req.body.instructor as string) || null : undefined;
    const topic = req.body.topic !== undefined ? (req.body.topic as string) || null : undefined;

    const updateData: Record<string, string | null> = {};
    if (instructor !== undefined) updateData.instructor = instructor;
    if (topic !== undefined) updateData.topic = topic;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    await db
      .update(uploadsTable)
      .set(updateData)
      .where(eq(uploadsTable.id, id));

    // Also update all poll_responses for this upload
    await db
      .update(pollResponsesTable)
      .set(updateData)
      .where(eq(pollResponsesTable.upload_id, id));

    return res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "Update upload error");
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ success: false, message });
  }
});

export default router;
