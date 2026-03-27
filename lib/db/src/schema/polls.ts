import { pgTable, serial, text, integer, real, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const uploadsTable = pgTable("uploads", {
  id: serial("id").primaryKey(),
  meeting_id: text("meeting_id").notNull(),
  meeting_topic: text("meeting_topic"),
  subject: text("subject").notNull(),
  session_type: text("session_type").notNull(),
  program_name: text("program_name").notNull(),
  cohort: text("cohort"),
  semester: text("semester"),
  week_number: text("week_number"),
  session_date: text("session_date"),
  upload_timestamp: text("upload_timestamp"),
  total_responses: integer("total_responses").default(0),
  avg_delivery_rating: real("avg_delivery_rating"),
  avg_content_rating: real("avg_content_rating"),
  avg_combined_rating: real("avg_combined_rating"),
  feedback_count: integer("feedback_count").default(0),
  nps_delivery: real("nps_delivery"),
  nps_content: real("nps_content"),
}, (table) => [
  unique().on(table.meeting_id),
]);

export const pollResponsesTable = pgTable("poll_responses", {
  id: serial("id").primaryKey(),
  upload_id: integer("upload_id").references(() => uploadsTable.id),
  student_name: text("student_name"),
  student_email: text("student_email"),
  cohort: text("cohort"),
  submission_time: text("submission_time"),
  delivery_rating: integer("delivery_rating"),
  content_rating: integer("content_rating"),
  feedback_text: text("feedback_text"),
  feedback_sentiment: text("feedback_sentiment"),
  feedback_themes: text("feedback_themes"),
  is_useful_feedback: integer("is_useful_feedback").default(0),
});

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  name: text("name"),
  cohort: text("cohort"),
  first_seen: text("first_seen"),
  last_seen: text("last_seen"),
  total_sessions: integer("total_sessions").default(0),
});

export const insertUploadSchema = createInsertSchema(uploadsTable).omit({ id: true });
export const insertPollResponseSchema = createInsertSchema(pollResponsesTable).omit({ id: true });
export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true });

export type Upload = typeof uploadsTable.$inferSelect;
export type InsertUpload = z.infer<typeof insertUploadSchema>;
export type PollResponse = typeof pollResponsesTable.$inferSelect;
export type InsertPollResponse = z.infer<typeof insertPollResponseSchema>;
export type Student = typeof studentsTable.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
