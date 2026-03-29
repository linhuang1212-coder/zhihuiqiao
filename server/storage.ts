import {
  type User, type InsertUser, users,
  type TeacherProfile, type InsertTeacherProfile, teacherProfiles,
  type Demand, type InsertDemand, demands,
  type Order, type InsertOrder, orders,
  type Review, type InsertReview, reviews,
  type MatchLog, type InsertMatchLog, matchLogs,
  type UnlockPackage, type InsertUnlockPackage, unlockPackages,
  type UserPurchase, type InsertUserPurchase, userPurchases,
  type UnlockRecord, type InsertUnlockRecord, unlockRecords,
  type Notification, type InsertNotification, notifications,
  type TeacherCertification, type InsertTeacherCertification, teacherCertifications,
  type DemandApplication, type InsertDemandApplication, demandApplications,
  type Conversation, type InsertConversation, conversations,
  type Message, type InsertMessage, messages,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, sql, gte, ne, or, lt } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'parent',
    name TEXT NOT NULL,
    phone TEXT,
    avatar TEXT,
    city TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS teacher_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    bio TEXT,
    education TEXT,
    major TEXT,
    degree TEXT,
    skills TEXT NOT NULL DEFAULT '[]',
    certificates TEXT NOT NULL DEFAULT '[]',
    demo_videos TEXT NOT NULL DEFAULT '[]',
    hourly_rate_min INTEGER,
    hourly_rate_max INTEGER,
    service_areas TEXT NOT NULL DEFAULT '[]',
    available_times TEXT NOT NULL DEFAULT '[]',
    total_orders INTEGER NOT NULL DEFAULT 0,
    rating_avg REAL NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    service_types TEXT NOT NULL DEFAULT '[]',
    certification_status TEXT NOT NULL DEFAULT 'uncertified',
    certified_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS demands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL REFERENCES users(id),
    child_age INTEGER NOT NULL,
    child_gender TEXT,
    service_category TEXT NOT NULL,
    specific_service TEXT,
    service_type TEXT NOT NULL,
    location TEXT,
    preferred_time TEXT NOT NULL DEFAULT '[]',
    budget_min INTEGER,
    budget_max INTEGER,
    special_requirements TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    demand_id INTEGER NOT NULL REFERENCES demands(id),
    parent_id INTEGER NOT NULL REFERENCES users(id),
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    service_date TEXT,
    duration_hours REAL,
    total_amount INTEGER,
    platform_fee INTEGER,
    teacher_income INTEGER,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    service_status TEXT NOT NULL DEFAULT 'scheduled',
    created_at INTEGER,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    reviewee_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL,
    comment TEXT,
    photos TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS match_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    demand_id INTEGER NOT NULL REFERENCES demands(id),
    match_score INTEGER NOT NULL DEFAULT 0,
    action_type TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'success',
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS unlock_packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    unlock_count INTEGER,
    duration_days INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    package_id INTEGER NOT NULL REFERENCES unlock_packages(id),
    amount REAL NOT NULL,
    unlock_quota INTEGER,
    expires_at INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    confirmed_by INTEGER,
    created_at INTEGER,
    confirmed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS unlock_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL REFERENCES users(id),
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    purchase_id INTEGER NOT NULL REFERENCES user_purchases(id),
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS demand_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    demand_id INTEGER NOT NULL REFERENCES demands(id),
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    introduction TEXT NOT NULL,
    quoted_price INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    parent_note TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(demand_id, teacher_id)
  );

  CREATE INDEX IF NOT EXISTS idx_demand_applications_demand ON demand_applications(demand_id, status);
  CREATE INDEX IF NOT EXISTS idx_demand_applications_teacher ON demand_applications(teacher_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS teacher_certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    material_type TEXT NOT NULL,
    image_url TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    reviewed_by INTEGER,
    submitted_at INTEGER,
    reviewed_at INTEGER,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL REFERENCES users(id),
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    last_message_id INTEGER,
    parent_unread_count INTEGER NOT NULL DEFAULT 0,
    teacher_unread_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER,
    updated_at INTEGER,
    UNIQUE(parent_id, teacher_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    system_ref_type TEXT,
    system_ref_id INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    related_id INTEGER,
    related_type TEXT,
    match_score INTEGER,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER
  );

  INSERT OR IGNORE INTO unlock_packages (id, name, description, price, unlock_count, duration_days, is_active, sort_order)
  VALUES
  (1, '单次解锁', '解锁3位老师的完整资料', 19.9, 3, NULL, 1, 1),
  (2, '精选解锁', '解锁5位老师的完整资料', 39.9, 5, NULL, 1, 2),
  (3, '季度卡', '3个月内无限解锁老师资料', 99.0, NULL, 90, 1, 3),
  (4, '年度卡', '12个月内无限解锁老师资料', 249.0, NULL, 365, 1, 4);

  -- Seed default admin account
  INSERT OR IGNORE INTO users (id, username, password, role, name, phone, city, status, created_at)
  VALUES
  (1, 'admin', 'admin123', 'admin', '管理员', '13800000000', '北京', 'active', 1700000000000);
`);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Teacher Profiles
  getTeacherProfile(userId: number): Promise<TeacherProfile | undefined>;
  getTeacherProfileById(id: number): Promise<TeacherProfile | undefined>;
  createTeacherProfile(profile: InsertTeacherProfile): Promise<TeacherProfile>;
  updateTeacherProfile(userId: number, profile: Partial<InsertTeacherProfile>): Promise<TeacherProfile | undefined>;
  getAllTeachers(): Promise<(User & { profile: TeacherProfile | null })[]>;

  // Demands
  createDemand(demand: InsertDemand): Promise<Demand>;
  getDemand(id: number): Promise<Demand | undefined>;
  getDemandsByParent(parentId: number): Promise<Demand[]>;
  getOpenDemands(): Promise<Demand[]>;
  updateDemand(id: number, data: Partial<InsertDemand>): Promise<Demand | undefined>;
  updateDemandStatus(id: number, status: string): Promise<Demand | undefined>;

  // Orders
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByParent(parentId: number): Promise<Order[]>;
  getOrdersByTeacher(teacherId: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  updateOrderStatus(id: number, serviceStatus: string, paymentStatus?: string): Promise<Order | undefined>;

  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getReviewsByTeacher(teacheeId: number): Promise<Review[]>;

  // Match Logs
  createMatchLog(log: InsertMatchLog): Promise<MatchLog>;

  // Unlock Packages
  getAllPackages(): Promise<UnlockPackage[]>;
  getActivePackages(): Promise<UnlockPackage[]>;
  getPackage(id: number): Promise<UnlockPackage | undefined>;
  createPackage(pkg: InsertUnlockPackage): Promise<UnlockPackage>;
  updatePackage(id: number, data: Partial<InsertUnlockPackage>): Promise<UnlockPackage | undefined>;

  // User Purchases
  createPurchase(purchase: InsertUserPurchase): Promise<UserPurchase>;
  getPurchase(id: number): Promise<UserPurchase | undefined>;
  getPurchasesByUser(userId: number): Promise<UserPurchase[]>;
  getActivePurchase(userId: number): Promise<UserPurchase | undefined>;
  confirmPurchase(id: number, adminId: number): Promise<UserPurchase | undefined>;
  getAllPendingPurchases(): Promise<UserPurchase[]>;
  getAllPurchases(): Promise<UserPurchase[]>;

  // Unlock Records
  createUnlockRecord(record: InsertUnlockRecord): Promise<UnlockRecord>;
  getUnlocksByParent(parentId: number): Promise<UnlockRecord[]>;
  isTeacherUnlocked(parentId: number, teacherId: number): Promise<boolean>;
  getUnlockCount(parentId: number): Promise<number>;

  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  getUnreadCount(userId: number): Promise<number>;
  markAsRead(id: number): Promise<Notification | undefined>;
  markAllAsRead(userId: number): Promise<void>;

  // Demand Applications
  createApplication(app: InsertDemandApplication): Promise<DemandApplication>;
  getApplication(id: number): Promise<DemandApplication | undefined>;
  getApplicationsByDemand(demandId: number): Promise<DemandApplication[]>;
  getApplicationsByTeacher(teacherId: number): Promise<DemandApplication[]>;
  getApplicationByDemandAndTeacher(demandId: number, teacherId: number): Promise<DemandApplication | undefined>;
  getTodayApplicationCount(teacherId: number): Promise<number>;
  getApplicationCountByDemand(demandId: number): Promise<number>;
  updateApplicationStatus(id: number, status: string, parentNote?: string): Promise<DemandApplication | undefined>;
  rejectOtherApplications(demandId: number, acceptedId: number): Promise<void>;

  // Teacher Certifications
  createCertification(cert: InsertTeacherCertification): Promise<TeacherCertification>;
  getCertificationsByTeacher(teacherId: number): Promise<TeacherCertification[]>;
  getCertification(id: number): Promise<TeacherCertification | undefined>;
  getPendingCertifications(): Promise<TeacherCertification[]>;
  getAllCertifications(status?: string): Promise<TeacherCertification[]>;
  approveCertification(id: number, adminId: number): Promise<TeacherCertification | undefined>;
  rejectCertification(id: number, adminId: number, reason: string): Promise<TeacherCertification | undefined>;
  updateCertificationStatus(teacherId: number, status: string): Promise<TeacherProfile | undefined>;

  // Conversations & Messages
  createConversation(conv: InsertConversation): Promise<Conversation>;
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationByParticipants(parentId: number, teacherId: number): Promise<Conversation | undefined>;
  getConversationsByUser(userId: number, role: string): Promise<Conversation[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  getMessagesByConversation(conversationId: number, before?: number, limit?: number): Promise<Message[]>;
  markConversationRead(conversationId: number, userId: number, role: string): Promise<void>;
  getUnreadConversationCount(userId: number, role: string): Promise<number>;
  updateConversationLastMessage(conversationId: number, messageId: number): Promise<void>;
  incrementUnreadCount(conversationId: number, recipientRole: string): Promise<void>;
  checkChatAccess(parentId: number, teacherId: number): Promise<boolean>;

  // Stats
  getStats(): Promise<{
    totalUsers: number;
    totalTeachers: number;
    totalParents: number;
    totalOrders: number;
    totalDemands: number;
    completedOrders: number;
    gmv: number;
    totalRevenue: number;
    totalUnlocks: number;
    pendingPurchases: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    return db.insert(users).values({
      ...insertUser,
      createdAt: new Date(),
    }).returning().get();
  }

  async updateUserStatus(id: number, status: string): Promise<User | undefined> {
    return db.update(users).set({ status }).where(eq(users.id, id)).returning().get();
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt)).all();
  }

  // Teacher Profiles
  async getTeacherProfile(userId: number): Promise<TeacherProfile | undefined> {
    return db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).get();
  }

  async getTeacherProfileById(id: number): Promise<TeacherProfile | undefined> {
    return db.select().from(teacherProfiles).where(eq(teacherProfiles.id, id)).get();
  }

  async createTeacherProfile(profile: InsertTeacherProfile): Promise<TeacherProfile> {
    return db.insert(teacherProfiles).values(profile).returning().get();
  }

  async updateTeacherProfile(userId: number, profile: Partial<InsertTeacherProfile>): Promise<TeacherProfile | undefined> {
    return db.update(teacherProfiles).set(profile).where(eq(teacherProfiles.userId, userId)).returning().get();
  }

  async getAllTeachers(): Promise<(User & { profile: TeacherProfile | null })[]> {
    const teacherUsers = db.select().from(users).where(eq(users.role, "teacher")).all();
    return Promise.all(teacherUsers.map(async (u) => {
      const profile = await this.getTeacherProfile(u.id);
      return { ...u, profile: profile || null };
    }));
  }


  // Demands
  async createDemand(demand: InsertDemand): Promise<Demand> {
    return db.insert(demands).values({
      ...demand,
      createdAt: new Date(),
    }).returning().get();
  }

  async getDemand(id: number): Promise<Demand | undefined> {
    return db.select().from(demands).where(eq(demands.id, id)).get();
  }

  async getDemandsByParent(parentId: number): Promise<Demand[]> {
    return db.select().from(demands).where(eq(demands.parentId, parentId)).orderBy(desc(demands.createdAt)).all();
  }

  async getOpenDemands(): Promise<Demand[]> {
    return db.select().from(demands).where(eq(demands.status, "open")).orderBy(desc(demands.createdAt)).all();
  }

  async updateDemand(id: number, data: Partial<InsertDemand>): Promise<Demand | undefined> {
    return db.update(demands).set(data).where(eq(demands.id, id)).returning().get();
  }

  async updateDemandStatus(id: number, status: string): Promise<Demand | undefined> {
    return db.update(demands).set({ status }).where(eq(demands.id, id)).returning().get();
  }

  // Orders
  async createOrder(order: InsertOrder): Promise<Order> {
    return db.insert(orders).values({
      ...order,
      createdAt: new Date(),
    }).returning().get();
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return db.select().from(orders).where(eq(orders.id, id)).get();
  }

  async getOrdersByParent(parentId: number): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.parentId, parentId)).orderBy(desc(orders.createdAt)).all();
  }

  async getOrdersByTeacher(teacherId: number): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.teacherId, teacherId)).orderBy(desc(orders.createdAt)).all();
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt)).all();
  }

  async updateOrderStatus(id: number, serviceStatus: string, paymentStatus?: string): Promise<Order | undefined> {
    const updateData: any = { serviceStatus };
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (serviceStatus === "completed") updateData.completedAt = new Date();
    return db.update(orders).set(updateData).where(eq(orders.id, id)).returning().get();
  }

  // Reviews
  async createReview(review: InsertReview): Promise<Review> {
    const created = await db.insert(reviews).values({
      ...review,
      createdAt: new Date(),
    }).returning().get();
    // Update teacher's average rating
    const teacherReviews = await this.getReviewsByTeacher(review.revieweeId);
    if (teacherReviews.length > 0) {
      const avg = teacherReviews.reduce((sum, r) => sum + r.rating, 0) / teacherReviews.length;
      await db.update(teacherProfiles).set({ ratingAvg: avg }).where(eq(teacherProfiles.userId, review.revieweeId)).run();
    }
    return created;
  }

  async getReviewsByTeacher(revieweeId: number): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.revieweeId, revieweeId)).orderBy(desc(reviews.createdAt)).all();
  }

  // Match Logs
  async createMatchLog(log: InsertMatchLog): Promise<MatchLog> {
    return db.insert(matchLogs).values({
      ...log,
      createdAt: new Date(),
    }).returning().get();
  }

  // Unlock Packages
  async getAllPackages(): Promise<UnlockPackage[]> {
    return db.select().from(unlockPackages).orderBy(unlockPackages.sortOrder).all();
  }

  async getActivePackages(): Promise<UnlockPackage[]> {
    return db.select().from(unlockPackages).where(eq(unlockPackages.isActive, true)).orderBy(unlockPackages.sortOrder).all();
  }

  async getPackage(id: number): Promise<UnlockPackage | undefined> {
    return db.select().from(unlockPackages).where(eq(unlockPackages.id, id)).get();
  }

  async createPackage(pkg: InsertUnlockPackage): Promise<UnlockPackage> {
    return db.insert(unlockPackages).values(pkg).returning().get();
  }

  async updatePackage(id: number, data: Partial<InsertUnlockPackage>): Promise<UnlockPackage | undefined> {
    return db.update(unlockPackages).set(data).where(eq(unlockPackages.id, id)).returning().get();
  }

  // User Purchases
  async createPurchase(purchase: InsertUserPurchase): Promise<UserPurchase> {
    return db.insert(userPurchases).values({
      ...purchase,
      createdAt: new Date(),
    }).returning().get();
  }

  async getPurchase(id: number): Promise<UserPurchase | undefined> {
    return db.select().from(userPurchases).where(eq(userPurchases.id, id)).get();
  }

  async getPurchasesByUser(userId: number): Promise<UserPurchase[]> {
    return db.select().from(userPurchases).where(eq(userPurchases.userId, userId)).orderBy(desc(userPurchases.createdAt)).all();
  }

  async getActivePurchase(userId: number): Promise<UserPurchase | undefined> {
    const purchases = db.select().from(userPurchases)
      .where(and(eq(userPurchases.userId, userId), eq(userPurchases.status, "confirmed")))
      .orderBy(desc(userPurchases.createdAt))
      .all();
    const now = new Date();
    return purchases.find(p => {
      if (p.expiresAt && p.expiresAt < now) return false;
      if (p.unlockQuota !== null && p.unlockQuota <= 0) return false;
      return true;
    });
  }

  async confirmPurchase(id: number, adminId: number): Promise<UserPurchase | undefined> {
    const purchase = await this.getPurchase(id);
    if (!purchase) return undefined;
    const pkg = await this.getPackage(purchase.packageId);
    if (!pkg) return undefined;
    const expiresAt = pkg.durationDays ? new Date(Date.now() + pkg.durationDays * 86400000) : null;
    return db.update(userPurchases).set({
      status: "confirmed",
      confirmedBy: adminId,
      confirmedAt: new Date(),
      unlockQuota: pkg.unlockCount ?? null,
      expiresAt,
    }).where(eq(userPurchases.id, id)).returning().get();
  }

  async getAllPendingPurchases(): Promise<UserPurchase[]> {
    return db.select().from(userPurchases).where(eq(userPurchases.status, "pending")).orderBy(desc(userPurchases.createdAt)).all();
  }

  async getAllPurchases(): Promise<UserPurchase[]> {
    return db.select().from(userPurchases).orderBy(desc(userPurchases.createdAt)).all();
  }

  // Unlock Records
  async createUnlockRecord(record: InsertUnlockRecord): Promise<UnlockRecord> {
    return db.insert(unlockRecords).values({
      ...record,
      createdAt: new Date(),
    }).returning().get();
  }

  async getUnlocksByParent(parentId: number): Promise<UnlockRecord[]> {
    return db.select().from(unlockRecords).where(eq(unlockRecords.parentId, parentId)).orderBy(desc(unlockRecords.createdAt)).all();
  }

  async isTeacherUnlocked(parentId: number, teacherId: number): Promise<boolean> {
    const record = db.select().from(unlockRecords)
      .where(and(eq(unlockRecords.parentId, parentId), eq(unlockRecords.teacherId, teacherId)))
      .get();
    return !!record;
  }

  async getUnlockCount(parentId: number): Promise<number> {
    const records = db.select().from(unlockRecords).where(eq(unlockRecords.parentId, parentId)).all();
    return records.length;
  }

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    return db.insert(notifications).values({
      ...notification,
      createdAt: new Date(),
    }).returning().get();
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).all();
  }

  async getUnreadCount(userId: number): Promise<number> {
    const unread = db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .all();
    return unread.length;
  }

  async markAsRead(id: number): Promise<Notification | undefined> {
    return db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id)).returning().get();
  }

  async markAllAsRead(userId: number): Promise<void> {
    db.update(notifications).set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .run();
  }

  // Demand Applications
  async createApplication(app: InsertDemandApplication): Promise<DemandApplication> {
    return db.insert(demandApplications).values({
      ...app,
      createdAt: new Date(),
    }).returning().get();
  }

  async getApplication(id: number): Promise<DemandApplication | undefined> {
    return db.select().from(demandApplications).where(eq(demandApplications.id, id)).get();
  }

  async getApplicationsByDemand(demandId: number): Promise<DemandApplication[]> {
    return db.select().from(demandApplications)
      .where(eq(demandApplications.demandId, demandId))
      .orderBy(desc(demandApplications.createdAt)).all();
  }

  async getApplicationsByTeacher(teacherId: number): Promise<DemandApplication[]> {
    return db.select().from(demandApplications)
      .where(eq(demandApplications.teacherId, teacherId))
      .orderBy(desc(demandApplications.createdAt)).all();
  }

  async getApplicationByDemandAndTeacher(demandId: number, teacherId: number): Promise<DemandApplication | undefined> {
    return db.select().from(demandApplications)
      .where(and(eq(demandApplications.demandId, demandId), eq(demandApplications.teacherId, teacherId)))
      .get();
  }

  async getTodayApplicationCount(teacherId: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows = db.select().from(demandApplications)
      .where(and(
        eq(demandApplications.teacherId, teacherId),
        gte(demandApplications.createdAt, today),
      )).all();
    return rows.length;
  }

  async getApplicationCountByDemand(demandId: number): Promise<number> {
    const rows = db.select().from(demandApplications)
      .where(and(
        eq(demandApplications.demandId, demandId),
        ne(demandApplications.status, "withdrawn"),
      )).all();
    return rows.length;
  }

  async updateApplicationStatus(id: number, status: string, parentNote?: string): Promise<DemandApplication | undefined> {
    const data: any = { status, updatedAt: new Date() };
    if (parentNote !== undefined) data.parentNote = parentNote;
    return db.update(demandApplications).set(data).where(eq(demandApplications.id, id)).returning().get();
  }

  async rejectOtherApplications(demandId: number, acceptedId: number): Promise<void> {
    db.update(demandApplications).set({ status: "rejected", updatedAt: new Date() })
      .where(and(
        eq(demandApplications.demandId, demandId),
        eq(demandApplications.status, "pending"),
        ne(demandApplications.id, acceptedId),
      )).run();
  }

  // Teacher Certifications
  async createCertification(cert: InsertTeacherCertification): Promise<TeacherCertification> {
    return db.insert(teacherCertifications).values({
      ...cert,
      createdAt: new Date(),
    }).returning().get();
  }

  async getCertificationsByTeacher(teacherId: number): Promise<TeacherCertification[]> {
    return db.select().from(teacherCertifications)
      .where(eq(teacherCertifications.teacherId, teacherId))
      .orderBy(desc(teacherCertifications.createdAt)).all();
  }

  async getCertification(id: number): Promise<TeacherCertification | undefined> {
    return db.select().from(teacherCertifications).where(eq(teacherCertifications.id, id)).get();
  }

  async getPendingCertifications(): Promise<TeacherCertification[]> {
    return db.select().from(teacherCertifications)
      .where(eq(teacherCertifications.status, "pending"))
      .orderBy(teacherCertifications.submittedAt).all();
  }

  async getAllCertifications(status?: string): Promise<TeacherCertification[]> {
    if (status) {
      return db.select().from(teacherCertifications)
        .where(eq(teacherCertifications.status, status))
        .orderBy(desc(teacherCertifications.createdAt)).all();
    }
    return db.select().from(teacherCertifications)
      .orderBy(desc(teacherCertifications.createdAt)).all();
  }

  async approveCertification(id: number, adminId: number): Promise<TeacherCertification | undefined> {
    const cert = await this.getCertification(id);
    if (!cert) return undefined;
    const now = new Date();
    // Update all pending certs for this teacher in same batch
    const certs = await this.getCertificationsByTeacher(cert.teacherId);
    const pendingIds = certs.filter(c => c.status === "pending").map(c => c.id);
    for (const pid of pendingIds) {
      db.update(teacherCertifications).set({
        status: "approved",
        reviewedBy: adminId,
        reviewedAt: now,
      }).where(eq(teacherCertifications.id, pid)).run();
    }
    // Update teacher profile
    db.update(teacherProfiles).set({
      verified: true,
      certificationStatus: "certified",
      certifiedAt: now,
    }).where(eq(teacherProfiles.userId, cert.teacherId)).run();
    return this.getCertification(id);
  }

  async rejectCertification(id: number, adminId: number, reason: string): Promise<TeacherCertification | undefined> {
    const cert = await this.getCertification(id);
    if (!cert) return undefined;
    const now = new Date();
    const certs = await this.getCertificationsByTeacher(cert.teacherId);
    const pendingIds = certs.filter(c => c.status === "pending").map(c => c.id);
    for (const pid of pendingIds) {
      db.update(teacherCertifications).set({
        status: "rejected",
        adminNote: reason,
        reviewedBy: adminId,
        reviewedAt: now,
      }).where(eq(teacherCertifications.id, pid)).run();
    }
    db.update(teacherProfiles).set({
      verified: false,
      certificationStatus: "rejected",
    }).where(eq(teacherProfiles.userId, cert.teacherId)).run();
    return this.getCertification(id);
  }

  async updateCertificationStatus(teacherId: number, status: string): Promise<TeacherProfile | undefined> {
    return db.update(teacherProfiles).set({
      certificationStatus: status,
    }).where(eq(teacherProfiles.userId, teacherId)).returning().get();
  }

  // Conversations & Messages
  async createConversation(conv: InsertConversation): Promise<Conversation> {
    return db.insert(conversations).values({
      ...conv,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning().get();
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return db.select().from(conversations).where(eq(conversations.id, id)).get();
  }

  async getConversationByParticipants(parentId: number, teacherId: number): Promise<Conversation | undefined> {
    return db.select().from(conversations)
      .where(and(eq(conversations.parentId, parentId), eq(conversations.teacherId, teacherId)))
      .get();
  }

  async getConversationsByUser(userId: number, role: string): Promise<Conversation[]> {
    if (role === "parent") {
      return db.select().from(conversations)
        .where(eq(conversations.parentId, userId))
        .orderBy(desc(conversations.updatedAt)).all();
    }
    return db.select().from(conversations)
      .where(eq(conversations.teacherId, userId))
      .orderBy(desc(conversations.updatedAt)).all();
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    return db.insert(messages).values({
      ...msg,
      createdAt: new Date(),
    }).returning().get();
  }

  async getMessagesByConversation(conversationId: number, before?: number, limit: number = 30): Promise<Message[]> {
    if (before) {
      return db.select().from(messages)
        .where(and(eq(messages.conversationId, conversationId), lt(messages.id, before)))
        .orderBy(desc(messages.id))
        .limit(limit).all().reverse();
    }
    return db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.id))
      .limit(limit).all().reverse();
  }

  async markConversationRead(conversationId: number, userId: number, role: string): Promise<void> {
    if (role === "parent") {
      db.update(conversations).set({ parentUnreadCount: 0 }).where(eq(conversations.id, conversationId)).run();
    } else {
      db.update(conversations).set({ teacherUnreadCount: 0 }).where(eq(conversations.id, conversationId)).run();
    }
    const conv = await this.getConversation(conversationId);
    if (!conv) return;
    db.update(messages).set({ isRead: true })
      .where(and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderId, userId),
        eq(messages.isRead, false),
      )).run();
  }

  async getUnreadConversationCount(userId: number, role: string): Promise<number> {
    const convs = await this.getConversationsByUser(userId, role);
    let total = 0;
    for (const c of convs) {
      total += role === "parent" ? c.parentUnreadCount : c.teacherUnreadCount;
    }
    return total;
  }

  async updateConversationLastMessage(conversationId: number, messageId: number): Promise<void> {
    db.update(conversations).set({ lastMessageId: messageId, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId)).run();
  }

  async incrementUnreadCount(conversationId: number, recipientRole: string): Promise<void> {
    if (recipientRole === "parent") {
      db.update(conversations)
        .set({ parentUnreadCount: sql`parent_unread_count + 1` })
        .where(eq(conversations.id, conversationId)).run();
    } else {
      db.update(conversations)
        .set({ teacherUnreadCount: sql`teacher_unread_count + 1` })
        .where(eq(conversations.id, conversationId)).run();
    }
  }

  async checkChatAccess(parentId: number, teacherId: number): Promise<boolean> {
    const unlocked = await this.isTeacherUnlocked(parentId, teacherId);
    if (unlocked) return true;
    const orderList = db.select().from(orders)
      .where(and(eq(orders.parentId, parentId), eq(orders.teacherId, teacherId)))
      .all();
    return orderList.length > 0;
  }

  // Stats
  async getStats() {
    const allUsers = await this.getAllUsers();
    const totalUsers = allUsers.length;
    const totalTeachers = allUsers.filter(u => u.role === "teacher").length;
    const totalParents = allUsers.filter(u => u.role === "parent").length;
    const allOrders = await this.getAllOrders();
    const totalOrders = allOrders.length;
    const completedOrders = allOrders.filter(o => o.serviceStatus === "completed").length;
    const gmv = allOrders.filter(o => o.totalAmount).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const allDemands = db.select().from(demands).all();
    const totalDemands = allDemands.length;

    const confirmedPurchases = db.select().from(userPurchases).where(eq(userPurchases.status, "confirmed")).all();
    const totalRevenue = confirmedPurchases.reduce((sum, p) => sum + p.amount, 0);
    const totalUnlocks = db.select().from(unlockRecords).all().length;
    const pendingPurchases = db.select().from(userPurchases).where(eq(userPurchases.status, "pending")).all().length;

    return { totalUsers, totalTeachers, totalParents, totalOrders, completedOrders, gmv, totalDemands, totalRevenue, totalUnlocks, pendingPurchases };
  }
}

export const storage = new DatabaseStorage();
