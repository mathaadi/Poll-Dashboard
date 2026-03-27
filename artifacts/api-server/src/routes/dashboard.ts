import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { uploadsTable, pollResponsesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { computeDistribution, computeNPS } from "../services/metrics.js";

const router: IRouter = Router();

// GET /api/summary
router.get("/summary", async (_req, res) => {
  const uploads = await db.select().from(uploadsTable);

  if (uploads.length === 0) {
    return res.json({
      total_sessions: 0,
      total_responses: 0,
      avg_delivery: 0,
      avg_content: 0,
      avg_combined: 0,
      subjects: [],
      programs: [],
      date_range: { from: "", to: "" },
    });
  }

  const total_responses = uploads.reduce((s, u) => s + (u.total_responses || 0), 0);
  const validDelivery = uploads.filter((u) => u.avg_delivery_rating !== null);
  const validContent = uploads.filter((u) => u.avg_content_rating !== null);

  const avg_delivery =
    validDelivery.length > 0
      ? validDelivery.reduce((s, u) => s + (u.avg_delivery_rating || 0), 0) / validDelivery.length
      : 0;
  const avg_content =
    validContent.length > 0
      ? validContent.reduce((s, u) => s + (u.avg_content_rating || 0), 0) / validContent.length
      : 0;
  const avg_combined = (avg_delivery + avg_content) / 2;

  const subjects = [...new Set(uploads.map((u) => u.subject))];
  const programs = [...new Set(uploads.map((u) => u.program_name))];

  const dates = uploads
    .filter((u) => u.session_date)
    .map((u) => u.session_date!)
    .sort();

  return res.json({
    total_sessions: uploads.length,
    total_responses,
    avg_delivery: Math.round(avg_delivery * 100) / 100,
    avg_content: Math.round(avg_content * 100) / 100,
    avg_combined: Math.round(avg_combined * 100) / 100,
    subjects,
    programs,
    date_range: {
      from: dates[0] || "",
      to: dates[dates.length - 1] || "",
    },
  });
});

// GET /api/subjects
router.get("/subjects", async (_req, res) => {
  const uploads = await db.select().from(uploadsTable);

  const subjectMap = new Map<string, typeof uploads>();
  for (const u of uploads) {
    if (!subjectMap.has(u.subject)) subjectMap.set(u.subject, []);
    subjectMap.get(u.subject)!.push(u);
  }

  const result = await Promise.all(
    [...subjectMap.entries()].map(async ([subject, sessions]) => {
      const responses = await db
        .select()
        .from(pollResponsesTable)
        .where(
          sql`${pollResponsesTable.upload_id} IN (${sql.join(
            sessions.map((s) => sql`${s.id}`),
            sql`, `
          )})`
        );

      const deliveryRatings = responses.map((r) => r.delivery_rating);
      const contentRatings = responses.map((r) => r.content_rating);

      const validDelivery = deliveryRatings.filter((r): r is number => r !== null);
      const validContent = contentRatings.filter((r): r is number => r !== null);

      const avg_delivery =
        validDelivery.length > 0
          ? validDelivery.reduce((a, b) => a + b, 0) / validDelivery.length
          : 0;
      const avg_content =
        validContent.length > 0
          ? validContent.reduce((a, b) => a + b, 0) / validContent.length
          : 0;

      const nps = computeNPS(deliveryRatings);

      const sortedSessions = sessions.sort((a, b) =>
        (a.session_date || "").localeCompare(b.session_date || "")
      );
      const trend = sortedSessions.map((s, idx) => ({
        week: s.week_number || String(idx + 1),
        delivery: Math.round((s.avg_delivery_rating || 0) * 100) / 100,
        content: Math.round((s.avg_content_rating || 0) * 100) / 100,
      }));

      return {
        subject,
        total_sessions: sessions.length,
        total_responses: responses.length,
        avg_delivery: Math.round(avg_delivery * 100) / 100,
        avg_content: Math.round(avg_content * 100) / 100,
        nps,
        trend,
      };
    })
  );

  return res.json(result);
});

// GET /api/subject-sessions?subject=X
router.get("/subject-sessions", async (req, res) => {
  const subject = req.query.subject as string;
  if (!subject) return res.status(400).json({ error: "subject is required" });

  const uploads = await db
    .select()
    .from(uploadsTable)
    .where(eq(uploadsTable.subject, subject));

  const result = uploads
    .sort((a, b) => (a.session_date || "").localeCompare(b.session_date || ""))
    .map((u) => ({
      upload_id: u.id,
      session_date: u.session_date || "",
      week_number: u.week_number || "",
      total_responses: u.total_responses || 0,
      avg_delivery: Math.round((u.avg_delivery_rating || 0) * 100) / 100,
      avg_content: Math.round((u.avg_content_rating || 0) * 100) / 100,
    }));

  return res.json(result);
});

// GET /api/cohorts
router.get("/cohorts", async (_req, res) => {
  const responses = await db.select().from(pollResponsesTable);
  const uploads = await db.select().from(uploadsTable);

  const uploadMap = new Map(uploads.map((u) => [u.id, u]));

  const cohortMap = new Map<string, typeof responses>();
  for (const r of responses) {
    const cohort = r.cohort || "External/Unknown";
    if (!cohortMap.has(cohort)) cohortMap.set(cohort, []);
    cohortMap.get(cohort)!.push(r);
  }

  const result = [...cohortMap.entries()].map(([cohort, cohortResponses]) => {
    const validDelivery = cohortResponses
      .map((r) => r.delivery_rating)
      .filter((r): r is number => r !== null);
    const validContent = cohortResponses
      .map((r) => r.content_rating)
      .filter((r): r is number => r !== null);

    const avg_delivery =
      validDelivery.length > 0
        ? validDelivery.reduce((a, b) => a + b, 0) / validDelivery.length
        : 0;
    const avg_content =
      validContent.length > 0
        ? validContent.reduce((a, b) => a + b, 0) / validContent.length
        : 0;

    const subjectMap = new Map<string, { delivery: number[]; content: number[] }>();
    for (const r of cohortResponses) {
      const upload = uploadMap.get(r.upload_id || -1);
      if (!upload) continue;
      const subj = upload.subject;
      if (!subjectMap.has(subj)) subjectMap.set(subj, { delivery: [], content: [] });
      if (r.delivery_rating !== null) subjectMap.get(subj)!.delivery.push(r.delivery_rating);
      if (r.content_rating !== null) subjectMap.get(subj)!.content.push(r.content_rating);
    }

    const by_subject: Record<string, { avg_delivery: number; avg_content: number }> = {};
    for (const [subj, ratings] of subjectMap.entries()) {
      by_subject[subj] = {
        avg_delivery:
          ratings.delivery.length > 0
            ? Math.round((ratings.delivery.reduce((a, b) => a + b, 0) / ratings.delivery.length) * 100) / 100
            : 0,
        avg_content:
          ratings.content.length > 0
            ? Math.round((ratings.content.reduce((a, b) => a + b, 0) / ratings.content.length) * 100) / 100
            : 0,
      };
    }

    return {
      cohort,
      total_responses: cohortResponses.length,
      avg_delivery: Math.round(avg_delivery * 100) / 100,
      avg_content: Math.round(avg_content * 100) / 100,
      by_subject,
    };
  });

  return res.json(result);
});

// GET /api/trends?subject=X
router.get("/trends", async (req, res) => {
  const subject = req.query.subject as string | undefined;

  let uploads = await db.select().from(uploadsTable);
  if (subject) {
    uploads = uploads.filter((u) => u.subject === subject);
  }

  const result = uploads
    .sort((a, b) => (a.session_date || "").localeCompare(b.session_date || ""))
    .map((u) => ({
      session_date: u.session_date || "",
      week: u.week_number || "",
      avg_delivery: Math.round((u.avg_delivery_rating || 0) * 100) / 100,
      avg_content: Math.round((u.avg_content_rating || 0) * 100) / 100,
      responses: u.total_responses || 0,
      subject: u.subject,
    }));

  return res.json(result);
});

// Helper: get responses filtered by upload_id or subject
async function getFilteredResponses(
  subject?: string,
  upload_id?: number
): Promise<Awaited<ReturnType<typeof db.select>>["0"][]> {
  if (upload_id) {
    return db.select().from(pollResponsesTable).where(eq(pollResponsesTable.upload_id, upload_id));
  }

  let uploads = await db.select().from(uploadsTable);
  if (subject) {
    uploads = uploads.filter((u) => u.subject === subject);
  }

  if (uploads.length === 0) return [];

  const uploadIds = uploads.map((u) => u.id);
  if (uploadIds.length === 1) {
    return db.select().from(pollResponsesTable).where(eq(pollResponsesTable.upload_id, uploadIds[0]));
  }
  return db.select().from(pollResponsesTable).where(
    sql`${pollResponsesTable.upload_id} IN (${sql.join(uploadIds.map((id) => sql`${id}`), sql`, `)})`
  );
}

// GET /api/distribution?subject=X&type=delivery|content&upload_id=N
router.get("/distribution/overall", async (_req, res) => {
  const responses = await db.select().from(pollResponsesTable);

  const deliveryRatings = responses.map((r) => r.delivery_rating);
  const contentRatings = responses.map((r) => r.content_rating);

  const deliveryDist = computeDistribution(deliveryRatings);
  const contentDist = computeDistribution(contentRatings);

  const total_responses = responses.filter((r) => r.delivery_rating !== null || r.content_rating !== null).length;

  return res.json({
    delivery: deliveryDist,
    content: contentDist,
    total_responses,
    nps_delivery: computeNPS(deliveryRatings),
    nps_content: computeNPS(contentRatings),
  });
});

router.get("/distribution", async (req, res) => {
  const subject = req.query.subject as string | undefined;
  const type = (req.query.type as string) || "delivery";
  const upload_id = req.query.upload_id ? Number(req.query.upload_id) : undefined;

  const responses = await getFilteredResponses(subject, upload_id);

  if (responses.length === 0) {
    return res.json({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, total: 0, nps: 0 });
  }

  const ratings = responses.map((r) =>
    type === "content" ? r.content_rating : r.delivery_rating
  );

  const dist = computeDistribution(ratings);
  const total = ratings.filter((r) => r !== null).length;
  const nps = computeNPS(ratings);

  return res.json({ ...dist, total, nps });
});

// GET /api/feedback/overview
router.get("/feedback/overview", async (_req, res) => {
  const usefulResponses = await db
    .select()
    .from(pollResponsesTable)
    .where(eq(pollResponsesTable.is_useful_feedback, 1));

  const total_useful = usefulResponses.length;
  const sentiment_counts = { positive: 0, negative: 0, suggestion: 0, neutral: 0 };
  const themeCount = new Map<string, number>();

  for (const r of usefulResponses) {
    const s = r.feedback_sentiment as keyof typeof sentiment_counts;
    if (s && s in sentiment_counts) sentiment_counts[s]++;
    if (r.feedback_themes) {
      for (const t of r.feedback_themes.split(",")) {
        const trimmed = t.trim();
        if (trimmed) themeCount.set(trimmed, (themeCount.get(trimmed) || 0) + 1);
      }
    }
  }

  const total = total_useful || 1;
  const sentiment_percent = {
    positive: Math.round((sentiment_counts.positive / total) * 100),
    negative: Math.round((sentiment_counts.negative / total) * 100),
    suggestion: Math.round((sentiment_counts.suggestion / total) * 100),
    neutral: Math.round((sentiment_counts.neutral / total) * 100),
  };

  const top_themes = [...themeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([theme, count]) => ({ theme, count }));

  return res.json({ total_useful, sentiment_counts, sentiment_percent, top_themes });
});

// GET /api/feedback?subject=X&upload_id=N
router.get("/feedback", async (req, res) => {
  const subject = req.query.subject as string | undefined;
  const upload_id = req.query.upload_id ? Number(req.query.upload_id) : undefined;

  const responses = await getFilteredResponses(subject, upload_id);

  if (responses.length === 0) {
    return res.json({
      total_feedback: 0,
      useful_feedback: 0,
      sentiment: { positive: 0, negative: 0, suggestion: 0, neutral: 0 },
      themes: [],
      top_negative: [],
      top_suggestions: [],
      top_positive: [],
    });
  }

  const withFeedback = responses.filter((r) => r.feedback_text);
  const usefulResponses = responses.filter((r) => r.is_useful_feedback === 1);

  const sentiment = { positive: 0, negative: 0, suggestion: 0, neutral: 0 };
  for (const r of usefulResponses) {
    const s = r.feedback_sentiment as keyof typeof sentiment;
    if (s && s in sentiment) sentiment[s]++;
  }

  const themeCount = new Map<string, number>();
  for (const r of usefulResponses) {
    if (r.feedback_themes) {
      for (const t of r.feedback_themes.split(",")) {
        const trimmed = t.trim();
        if (trimmed) themeCount.set(trimmed, (themeCount.get(trimmed) || 0) + 1);
      }
    }
  }
  const themes = [...themeCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([theme, count]) => ({ theme, count }));

  // Show translated text where available, otherwise original
  const displayText = (r: typeof usefulResponses[0]) =>
    r.translated_text || r.feedback_text || "";

  const top_negative = usefulResponses
    .filter((r) => r.feedback_sentiment === "negative")
    .map(displayText)
    .slice(0, 5);

  const top_suggestions = usefulResponses
    .filter((r) => r.feedback_sentiment === "suggestion")
    .map(displayText)
    .slice(0, 5);

  const top_positive = usefulResponses
    .filter((r) => r.feedback_sentiment === "positive")
    .map(displayText)
    .slice(0, 5);

  return res.json({
    total_feedback: withFeedback.length,
    useful_feedback: usefulResponses.length,
    sentiment,
    themes,
    top_negative,
    top_suggestions,
    top_positive,
  });
});

// GET /api/history
router.get("/history", async (_req, res) => {
  const uploads = await db
    .select()
    .from(uploadsTable)
    .orderBy(sql`${uploadsTable.upload_timestamp} DESC`);

  return res.json(
    uploads.map((u) => ({
      id: u.id,
      subject: u.subject,
      session_date: u.session_date || "",
      program_name: u.program_name,
      week_number: u.week_number || "",
      total_responses: u.total_responses || 0,
      avg_combined_rating: Math.round((u.avg_combined_rating || 0) * 100) / 100,
      upload_timestamp: u.upload_timestamp || "",
      session_type: u.session_type,
      meeting_topic: u.meeting_topic || "",
    }))
  );
});

export default router;
