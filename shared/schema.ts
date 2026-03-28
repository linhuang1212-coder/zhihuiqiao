import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("parent"), // parent/teacher/admin
  name: text("name").notNull(),
  phone: text("phone"),
  avatar: text("avatar"),
  city: text("city"),
  status: text("status").notNull().default("active"), // active/frozen/banned
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Teacher Profiles table
export const teacherProfiles = sqliteTable("teacher_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  bio: text("bio"),
  education: text("education"), // school name
  major: text("major"),
  degree: text("degree"), // 本科/硕士/博士
  skills: text("skills").notNull().default("[]"), // JSON array of skill categories
  certificates: text("certificates").notNull().default("[]"), // JSON array
  demoVideos: text("demo_videos").notNull().default("[]"), // JSON array
  hourlyRateMin: integer("hourly_rate_min"),
  hourlyRateMax: integer("hourly_rate_max"),
  serviceAreas: text("service_areas").notNull().default("[]"), // JSON array
  availableTimes: text("available_times").notNull().default("[]"), // JSON array
  totalOrders: integer("total_orders").notNull().default(0),
  ratingAvg: real("rating_avg").notNull().default(0),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  serviceTypes: text("service_types").notNull().default("[]"), // JSON array
  certificationStatus: text("certification_status").notNull().default("uncertified"), // uncertified / pending / certified / rejected
  certifiedAt: integer("certified_at", { mode: "timestamp" }),
});

export const insertTeacherProfileSchema = createInsertSchema(teacherProfiles).omit({
  id: true,
});
export type InsertTeacherProfile = z.infer<typeof insertTeacherProfileSchema>;
export type TeacherProfile = typeof teacherProfiles.$inferSelect;

// Demands table
export const demands = sqliteTable("demands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentId: integer("parent_id").notNull().references(() => users.id),
  childAge: integer("child_age").notNull(),
  childGender: text("child_gender"), // 男/女
  serviceCategory: text("service_category").notNull(), // 音乐陪伴/体育培训/科目辅导/兴趣培养/氛围陪伴/其他
  specificService: text("specific_service"), // e.g. 钢琴, 篮球, 数学
  serviceType: text("service_type").notNull(), // home/center/online
  location: text("location"),
  preferredTime: text("preferred_time").notNull().default("[]"), // JSON array
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  specialRequirements: text("special_requirements"),
  status: text("status").notNull().default("open"), // open/matched/closed/cancelled
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertDemandSchema = createInsertSchema(demands).omit({
  id: true,
  createdAt: true,
});
export type InsertDemand = z.infer<typeof insertDemandSchema>;
export type Demand = typeof demands.$inferSelect;

// Orders table
export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  parentId: integer("parent_id").notNull().references(() => users.id),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  serviceDate: text("service_date"),
  durationHours: real("duration_hours"),
  totalAmount: integer("total_amount"),
  platformFee: integer("platform_fee"),
  teacherIncome: integer("teacher_income"),
  paymentStatus: text("payment_status").notNull().default("pending"), // pending/paid/refunded
  serviceStatus: text("service_status").notNull().default("scheduled"), // scheduled/in_progress/completed/cancelled
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Reviews table
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  reviewerId: integer("reviewer_id").notNull().references(() => users.id),
  revieweeId: integer("reviewee_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  photos: text("photos").notNull().default("[]"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof reviews.$inferSelect;

// Match Logs table
export const matchLogs = sqliteTable("match_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  matchScore: integer("match_score").notNull().default(0),
  actionType: text("action_type").notNull(), // notify/auto_apply
  result: text("result").notNull().default("success"), // success/failed/ignored
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertMatchLogSchema = createInsertSchema(matchLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertMatchLog = z.infer<typeof insertMatchLogSchema>;
export type MatchLog = typeof matchLogs.$inferSelect;

// Unlock Packages table
export const unlockPackages = sqliteTable("unlock_packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  price: real("price").notNull(),
  unlockCount: integer("unlock_count"), // null = unlimited
  durationDays: integer("duration_days"), // null = permanent
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertUnlockPackageSchema = createInsertSchema(unlockPackages).omit({
  id: true,
});
export type InsertUnlockPackage = z.infer<typeof insertUnlockPackageSchema>;
export type UnlockPackage = typeof unlockPackages.$inferSelect;

// User Purchases table
export const userPurchases = sqliteTable("user_purchases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  packageId: integer("package_id").notNull().references(() => unlockPackages.id),
  amount: real("amount").notNull(),
  unlockQuota: integer("unlock_quota"), // null = unlimited
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  status: text("status").notNull().default("pending"), // pending/confirmed/expired/refunded
  confirmedBy: integer("confirmed_by"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  confirmedAt: integer("confirmed_at", { mode: "timestamp" }),
});

export const insertUserPurchaseSchema = createInsertSchema(userPurchases).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
});
export type InsertUserPurchase = z.infer<typeof insertUserPurchaseSchema>;
export type UserPurchase = typeof userPurchases.$inferSelect;

// Unlock Records table
export const unlockRecords = sqliteTable("unlock_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentId: integer("parent_id").notNull().references(() => users.id),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  purchaseId: integer("purchase_id").notNull().references(() => userPurchases.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertUnlockRecordSchema = createInsertSchema(unlockRecords).omit({
  id: true,
  createdAt: true,
});
export type InsertUnlockRecord = z.infer<typeof insertUnlockRecordSchema>;
export type UnlockRecord = typeof unlockRecords.$inferSelect;

// Notifications table
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // match_demand / system / order_update
  title: text("title").notNull(),
  content: text("content").notNull(),
  relatedId: integer("related_id"),
  relatedType: text("related_type"), // demand / order
  matchScore: integer("match_score"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Demand Applications table
export const demandApplications = sqliteTable("demand_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  demandId: integer("demand_id").notNull().references(() => demands.id),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  introduction: text("introduction").notNull(),
  quotedPrice: integer("quoted_price").notNull(),
  status: text("status").notNull().default("pending"), // pending / accepted / rejected / withdrawn
  parentNote: text("parent_note"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const insertDemandApplicationSchema = createInsertSchema(demandApplications).omit({
  id: true,
  createdAt: true,
});
export type InsertDemandApplication = z.infer<typeof insertDemandApplicationSchema>;
export type DemandApplication = typeof demandApplications.$inferSelect;

// Teacher Certifications table
export const teacherCertifications = sqliteTable("teacher_certifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  materialType: text("material_type").notNull(), // student_card / degree_cert / xuexin_screenshot / other
  imageUrl: text("image_url").notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  status: text("status").notNull().default("pending"), // pending / approved / rejected
  adminNote: text("admin_note"),
  reviewedBy: integer("reviewed_by"),
  submittedAt: integer("submitted_at", { mode: "timestamp" }),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertTeacherCertificationSchema = createInsertSchema(teacherCertifications).omit({
  id: true,
  createdAt: true,
});
export type InsertTeacherCertification = z.infer<typeof insertTeacherCertificationSchema>;
export type TeacherCertification = typeof teacherCertifications.$inferSelect;

// Conversations table
export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentId: integer("parent_id").notNull().references(() => users.id),
  teacherId: integer("teacher_id").notNull().references(() => users.id),
  lastMessageId: integer("last_message_id"),
  parentUnreadCount: integer("parent_unread_count").notNull().default(0),
  teacherUnreadCount: integer("teacher_unread_count").notNull().default(0),
  status: text("status").notNull().default("active"), // active / archived
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages table
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  type: text("type").notNull().default("text"), // text / system
  content: text("content").notNull(),
  systemRefType: text("system_ref_type"), // order_created / order_paid / order_completed
  systemRefId: integer("system_ref_id"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
