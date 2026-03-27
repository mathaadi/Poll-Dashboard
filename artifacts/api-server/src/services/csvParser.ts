export interface ParsedSession {
  meeting_id: string;
  meeting_topic: string;
  subject: string;
  session_type: string;
  session_date: string;
  format: "FORMAT_A" | "FORMAT_B";
  instructor: string | null;
  topic: string | null;
  responses: ParsedResponse[];
}

export interface ParsedResponse {
  student_name: string;
  student_email: string;
  submission_time: string;
  delivery_rating: number | null;
  content_rating: number | null;
  feedback_text: string;
  cohort: string;
  instructor: string | null;
  topic: string | null;
  additional_feedback: string | null;
}

function detectCohort(email: string): string {
  const lower = email.toLowerCase();
  if (lower.startsWith("b25bs")) return "2025-BS";
  if (lower.startsWith("b24bs")) return "2024-BS";
  if (lower.startsWith("b23bs")) return "2023-BS";
  return "External/Unknown";
}

function parseRating(val: string): number | null {
  const trimmed = val?.trim();
  if (!trimmed) return null;
  const num = parseInt(trimmed, 10);
  if (isNaN(num) || num < 1 || num > 5) return null;
  return num;
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function detectCSVFormat(fileContent: string): "FORMAT_A" | "FORMAT_B" {
  const firstLine = fileContent.split("\n")[0].toLowerCase();

  if (
    firstLine.includes("instructor") ||
    firstLine.includes("topic/name") ||
    firstLine.includes("session rating")
  ) {
    return "FORMAT_B";
  }

  if (firstLine.includes("overview")) {
    return "FORMAT_A";
  }

  const first3Lines = fileContent.split("\n").slice(0, 3).join("\n").toLowerCase();
  if (first3Lines.includes("user name") && first3Lines.includes("email")) {
    return "FORMAT_B";
  }

  return "FORMAT_A";
}

function parseFormatA(content: string): ParsedSession {
  const cleaned = content.replace(/^\uFEFF/, "");
  const rawLines = cleaned.split(/\r?\n/);

  const metaRow = parseLine(rawLines[2] || "");
  const rawMeetingId = metaRow[2]?.trim() || "";
  const rawMeetingTopic = metaRow[1]?.trim() || "";
  const rawStartTime = metaRow[3]?.trim() || "";

  let subject = rawMeetingTopic;
  let session_type = "Unknown";
  if (rawMeetingTopic.includes("||")) {
    const parts = rawMeetingTopic.split("||");
    subject = parts[0].trim();
    session_type = parts[1].trim();
    session_type = session_type.replace(/\s+Session$/i, "").trim();
  }

  let session_date = rawStartTime;
  if (rawStartTime) {
    const parts = rawStartTime.split(" ")[0].split("-");
    if (parts.length === 3) {
      session_date = `${parts[2]}-${parts[0]}-${parts[1]}`;
    }
  }

  let headerRowIndex = -1;
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].includes("User Name") && rawLines[i].includes("Email Address")) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error("Could not find header row in CSV. Expected row with 'User Name' and 'Email Address'.");
  }

  const responses: ParsedResponse[] = [];

  for (let i = headerRowIndex + 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line || !line.trim()) continue;

    const cols = parseLine(line);
    const studentName = cols[1]?.trim();
    if (!studentName) break;

    if (studentName.toLowerCase().startsWith("avg") || studentName === "#") continue;

    const studentEmail = cols[2]?.trim() || "";
    const submissionTime = cols[3]?.trim() || "";
    const deliveryRating = parseRating(cols[4] || "");
    const contentRating = parseRating(cols[5] || "");
    const feedbackText = cols[6]?.trim() || "";
    const cohort = detectCohort(studentEmail);

    responses.push({
      student_name: studentName,
      student_email: studentEmail,
      submission_time: submissionTime,
      delivery_rating: deliveryRating,
      content_rating: contentRating,
      feedback_text: feedbackText,
      cohort,
      instructor: null,
      topic: null,
      additional_feedback: null,
    });
  }

  return {
    meeting_id: rawMeetingId,
    meeting_topic: rawMeetingTopic,
    subject,
    session_type,
    session_date,
    format: "FORMAT_A",
    instructor: null,
    topic: null,
    responses,
  };
}

function parseFormatB(content: string): ParsedSession {
  const cleaned = content.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim());

  const idx = {
    userName: headers.findIndex((h) => h.includes("user name")),
    email: headers.findIndex((h) => h.includes("email")),
    submitted: headers.findIndex((h) => h.includes("submitted")),
    collected: headers.findIndex((h) => h.includes("collected")),
    topic: headers.findIndex((h) => h.includes("topic")),
    meetingId: headers.findIndex((h) => h.includes("meeting")),
    sessionRating: headers.findIndex(
      (h) => h.includes("session rating") || (h.includes("rating") && !h.includes("additional"))
    ),
    instructor: headers.findIndex((h) => h.includes("instructor")),
    feedback: headers.findIndex((h) => h.includes("how was")),
    additionalFeedback: headers.findIndex((h) => h.includes("additional")),
  };

  let meetingId: string | null = null;
  let sessionDate: string | null = null;

  const responses: ParsedResponse[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (!cols || cols.length < 3) continue;

    const rowMeetingId = idx.meetingId >= 0 ? cols[idx.meetingId]?.trim() : null;
    if (!meetingId && rowMeetingId) meetingId = rowMeetingId;

    const rowSessionDate =
      idx.collected >= 0
        ? cols[idx.collected]?.trim()
        : idx.submitted >= 0
        ? cols[idx.submitted]?.trim()
        : null;
    if (!sessionDate && rowSessionDate) sessionDate = rowSessionDate;

    const ratingRaw = idx.sessionRating >= 0 ? cols[idx.sessionRating]?.trim() : null;
    const rating = ratingRaw ? parseRating(ratingRaw) : null;

    const instructor = idx.instructor >= 0 ? cols[idx.instructor]?.trim() || null : null;
    const topic = idx.topic >= 0 ? cols[idx.topic]?.trim() || null : null;
    const studentEmail = idx.email >= 0 ? cols[idx.email]?.trim() || "" : "";

    responses.push({
      student_name: idx.userName >= 0 ? cols[idx.userName]?.trim() || "" : "",
      student_email: studentEmail,
      submission_time: idx.submitted >= 0 ? cols[idx.submitted]?.trim() || "" : "",
      delivery_rating: rating,
      content_rating: rating,
      feedback_text: idx.feedback >= 0 ? cols[idx.feedback]?.trim() || "" : "",
      additional_feedback:
        idx.additionalFeedback >= 0 ? cols[idx.additionalFeedback]?.trim() || null : null,
      instructor,
      topic,
      cohort: detectCohort(studentEmail),
    });
  }

  const instructorCounts: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  for (const r of responses) {
    if (r.instructor) instructorCounts[r.instructor] = (instructorCounts[r.instructor] || 0) + 1;
    if (r.topic) topicCounts[r.topic] = (topicCounts[r.topic] || 0) + 1;
  }

  const dominantInstructor =
    Object.entries(instructorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const dominantTopic =
    Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  if (!meetingId) {
    throw new Error("Could not determine Meeting ID from Format B CSV.");
  }

  return {
    meeting_id: meetingId,
    meeting_topic: dominantTopic || "Unknown Topic",
    subject: "",
    session_type: "Theory",
    session_date: sessionDate || "",
    format: "FORMAT_B",
    instructor: dominantInstructor,
    topic: dominantTopic,
    responses,
  };
}

export function parseZoomCsv(content: string): ParsedSession {
  const format = detectCSVFormat(content);
  if (format === "FORMAT_B") {
    return parseFormatB(content);
  }
  return parseFormatA(content);
}
