export interface ParsedSession {
  meeting_id: string;
  meeting_topic: string;
  subject: string;
  session_type: string;
  session_date: string;
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

export function parseZoomCsv(content: string): ParsedSession {
  // Remove BOM if present
  const cleaned = content.replace(/^\uFEFF/, "");

  // Split into lines (handle CRLF and LF)
  const rawLines = cleaned.split(/\r?\n/);

  // Parse CSV line respecting quoted fields
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

  // Row 3 (index 2) contains meeting metadata
  const metaRow = parseLine(rawLines[2] || "");

  // Generate Time is col 0, Meeting Topic col 1, Meeting ID col 2, Actual Start Time col 3
  const rawMeetingId = metaRow[2]?.trim() || "";
  const rawMeetingTopic = metaRow[1]?.trim() || "";
  const rawStartTime = metaRow[3]?.trim() || "";

  // Parse subject and session_type from meeting topic
  // Format: "ATA || Practical Session" or "LANA || Theory Session"
  let subject = rawMeetingTopic;
  let session_type = "Unknown";
  if (rawMeetingTopic.includes("||")) {
    const parts = rawMeetingTopic.split("||");
    subject = parts[0].trim();
    session_type = parts[1].trim();
    // Remove " Session" suffix if present
    session_type = session_type.replace(/\s+Session$/i, "").trim();
  }

  // Parse session date - format MM-DD-YYYY HH:mm
  let session_date = rawStartTime;
  if (rawStartTime) {
    // Try to format as YYYY-MM-DD
    const parts = rawStartTime.split(" ")[0].split("-");
    if (parts.length === 3) {
      // MM-DD-YYYY
      session_date = `${parts[2]}-${parts[0]}-${parts[1]}`;
    }
  }

  // Find the header row (row 10, index 9) - it contains "User Name"
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

  // Parse data rows starting after header
  const responses: ParsedResponse[] = [];

  for (let i = headerRowIndex + 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line || !line.trim()) continue;

    const cols = parseLine(line);

    // Col B (index 1) = student name - stop if empty
    const studentName = cols[1]?.trim();
    if (!studentName) break;

    // Skip if it looks like a summary row
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
    });
  }

  return {
    meeting_id: rawMeetingId,
    meeting_topic: rawMeetingTopic,
    subject,
    session_type,
    session_date,
    responses,
  };
}
