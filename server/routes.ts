import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { storage, db } from "./storage";

const JWT_SECRET = "zhihuiqiao-jwt-secret-2024";
import { users, demands, orders, teacherProfiles, userPurchases, unlockRecords, demandApplications } from "@shared/schema";
import { sql as dsql, eq as deq, and as dand, gte as dgte, desc as ddesc, count as dcount } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: string;
  }
}

// Matching algorithm
function calculateMatchScore(teacher: any, demand: any): number {
  let score = 0;

  // Skill match (25 points)
  try {
    const skills: string[] = JSON.parse(teacher.profile?.skills || "[]");
    const serviceTypes: string[] = JSON.parse(teacher.profile?.serviceTypes || "[]");
    const demandCategory = demand.serviceCategory || "";
    const specificService = demand.specificService || "";

    if (
      skills.some((s: string) => s.includes(specificService) || specificService.includes(s)) ||
      serviceTypes.some((st: string) => st.includes(demandCategory) || demandCategory.includes(st))
    ) {
      score += 25;
    }
  } catch {}

  // Location match (30 points)
  try {
    const serviceAreas: string[] = JSON.parse(teacher.profile?.serviceAreas || "[]");
    const demandLocation = demand.location || "";
    if (teacher.city && demandLocation && teacher.city === demand.city) {
      score += 30;
    } else if (serviceAreas.some((a: string) => demandLocation.includes(a) || a.includes(demandLocation))) {
      score += 20;
    }
  } catch {}

  // Price match (25 points)
  if (demand.budgetMin && demand.budgetMax && teacher.profile?.hourlyRateMin && teacher.profile?.hourlyRateMax) {
    const teacherMin = teacher.profile.hourlyRateMin;
    const teacherMax = teacher.profile.hourlyRateMax;
    const demandMin = demand.budgetMin;
    const demandMax = demand.budgetMax;
    if (teacherMin <= demandMax && teacherMax >= demandMin) {
      score += 25;
    }
  } else {
    score += 12; // partial score when no budget specified
  }

  // Time availability (20 points)
  try {
    const availableTimes: string[] = JSON.parse(teacher.profile?.availableTimes || "[]");
    const preferredTime: string[] = JSON.parse(demand.preferredTime || "[]");
    if (availableTimes.length > 0 && preferredTime.length > 0) {
      const overlap = availableTimes.some((t: string) => preferredTime.includes(t));
      if (overlap) score += 20;
    } else {
      score += 10;
    }
  } catch {}

  return Math.min(100, score);
}

// Mask education to tier
function maskEducation(education: string | null | undefined): string {
  if (!education) return "本科院校";
  const e = education.toLowerCase();
  const top985 = ["清华", "北大", "复旦", "交大", "浙大", "中科大", "南大", "哈工大", "西交", "人大"];
  if (top985.some(s => education.includes(s))) return "985院校";
  const is211 = ["武大", "华科", "中山", "厦大", "同济", "东南", "北航", "北理", "天大", "南开", "川大", "电子科大"];
  if (is211.some(s => education.includes(s))) return "211院校";
  if (e.includes("985")) return "985院校";
  if (e.includes("211")) return "211院校";
  return "本科院校";
}

// Mask teacher info for non-unlocked view
function maskTeacherInfo(teacher: any, isUnlocked: boolean) {
  if (isUnlocked) return { ...teacher, isUnlocked: true };
  const name = teacher.name && teacher.name.length > 0 ? teacher.name[0] + "**老师" : "**老师";
  return {
    id: teacher.id,
    name,
    city: teacher.city,
    phone: null,
    avatar: null,
    profile: teacher.profile ? {
      education: maskEducation(teacher.profile.education),
      major: null,
      degree: teacher.profile.degree,
      skills: teacher.profile.skills,
      serviceTypes: teacher.profile.serviceTypes,
      hourlyRateMin: teacher.profile.hourlyRateMin,
      hourlyRateMax: teacher.profile.hourlyRateMax,
      ratingAvg: teacher.profile.ratingAvg,
      totalOrders: teacher.profile.totalOrders,
      verified: teacher.profile.verified,
      certificationStatus: teacher.profile.certificationStatus,
      bio: null,
      serviceAreas: teacher.profile.serviceAreas,
      availableTimes: teacher.profile.availableTimes,
      certificates: teacher.profile.certificates,
      demoVideos: teacher.profile.demoVideos,
    } : null,
    isUnlocked: false,
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use(
    session({
      secret: "zhihuiqiao-secret-2024",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 },
    })
  );

  // File upload config for certification materials
  const uploadsDir = path.resolve("uploads/certifications");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const certUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, name);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      cb(null, allowed.includes(file.mimetype));
    },
  });

  // Serve uploaded certification images
  app.use("/uploads/certifications", (req, res, next) => {
    if (!req.session.userId) tryJwtAuth(req);
    if (!req.session.userId) return res.status(401).json({ message: "未登录" });
    next();
  });
  app.use("/uploads/certifications", express.static(uploadsDir));

  const tryJwtAuth = (req: Request) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string };
        req.session.userId = decoded.userId;
        req.session.role = decoded.role;
        return true;
      } catch (e) {
        return false;
      }
    }
    return false;
  };

  const requireAuth = (req: Request, res: Response, next: any) => {
    if (req.session.userId) {
      return next();
    }
    if (tryJwtAuth(req)) {
      return next();
    }
    return res.status(401).json({ message: "未登录，请先登录" });
  };

  const requireAdmin = async (req: Request, res: Response, next: any) => {
    if (!req.session.userId) tryJwtAuth(req);
    if (!req.session.userId) return res.status(401).json({ message: "未登录" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "无权限" });
    next();
  };

  // =========== AUTH ===========
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, role, name, phone, city } = req.body;
      if (!username || !password || !name) {
        return res.status(400).json({ message: "请填写必要信息" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(400).json({ message: "用户名已存在" });

      const user = await storage.createUser({ username, password, role: role || "parent", name, phone, city, status: "active" });

      // Auto-create teacher profile
      if (user.role === "teacher") {
        await storage.createTeacherProfile({
          userId: user.id,
          skills: "[]",
          certificates: "[]",
          demoVideos: "[]",
          serviceAreas: "[]",
          availableTimes: "[]",
          serviceTypes: "[]",
          totalOrders: 0,
          ratingAvg: 0,
          verified: false,
        });
      }

      req.session.userId = user.id;
      req.session.role = user.role;
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...safeUser } = user;
      return res.json({ ...safeUser, token });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "用户名或密码错误" });
      }
      if (user.status !== "active") {
        return res.status(403).json({ message: "账号已被冻结或封禁" });
      }
      req.session.userId = user.id;
      req.session.role = user.role;
      const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...safeUser } = user;
      return res.json({ ...safeUser, token });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "未登录" });
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {});
    return res.json({ message: "已退出登录" });
  });

  // =========== DEMANDS ===========
  app.post("/api/demands", requireAuth, async (req, res) => {
    try {
      const demand = await storage.createDemand({
        ...req.body,
        parentId: req.session.userId!,
        preferredTime: JSON.stringify(req.body.preferredTime || []),
      });

      // Auto-match: notify top 5 verified teachers
      try {
        const teachers = await storage.getAllTeachers();
        const scored = teachers
          .filter(t => t.profile && t.profile.verified)
          .map(t => ({ ...t, matchScore: calculateMatchScore(t, demand) }))
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 5);

        for (const teacher of scored) {
          if (teacher.matchScore > 0) {
            await storage.createNotification({
              userId: teacher.id,
              type: "match_demand",
              title: `新需求匹配：${demand.serviceCategory}`,
              content: `有家长在${demand.location || "未知地区"}寻找${demand.specificService || demand.serviceCategory}老师，孩子${demand.childAge}岁，预算¥${demand.budgetMin || 0}-${demand.budgetMax || "不限"}/小时，匹配度${teacher.matchScore}%`,
              relatedId: demand.id,
              relatedType: "demand",
              matchScore: teacher.matchScore,
              isRead: false,
            });
          }
        }
      } catch (matchErr) {
        // Don't fail demand creation if matching fails
        console.error("Auto-match notification error:", matchErr);
      }

      return res.json(demand);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/demands/my", requireAuth, async (req, res) => {
    const demandList = await storage.getDemandsByParent(req.session.userId!);
    return res.json(demandList);
  });

  app.get("/api/demands/open", requireAuth, async (req, res) => {
    const openDemands = await storage.getOpenDemands();
    return res.json(openDemands);
  });

  app.get("/api/demands/:id", requireAuth, async (req, res) => {
    const demand = await storage.getDemand(parseInt(req.params.id));
    if (!demand) return res.status(404).json({ message: "需求不存在" });
    return res.json(demand);
  });

  app.put("/api/demands/:id", requireAuth, async (req, res) => {
    try {
      const demand = await storage.getDemand(parseInt(req.params.id));
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      if (demand.parentId !== req.session.userId) return res.status(403).json({ message: "无权操作" });
      const updated = await storage.updateDemand(parseInt(req.params.id), req.body);
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/demands/:id", requireAuth, async (req, res) => {
    try {
      const demand = await storage.getDemand(parseInt(req.params.id));
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      if (demand.parentId !== req.session.userId) return res.status(403).json({ message: "无权操作" });
      await storage.updateDemandStatus(parseInt(req.params.id), "cancelled");
      return res.json({ message: "已取消" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== TEACHERS (with masking for parents) ===========
  app.get("/api/teachers", async (req, res) => {
    try {
      if (!req.session.userId) tryJwtAuth(req);
      const teachers = await storage.getAllTeachers();
      const userId = req.session.userId;
      const role = req.session.role;

      // Admin sees full info
      if (role === "admin") {
        return res.json(teachers.map(t => {
          const { password: _, ...safe } = t;
          return { ...safe, isUnlocked: true };
        }));
      }

      // Parent sees masked info unless unlocked
      if (role === "parent" && userId) {
        const results = await Promise.all(teachers.map(async (t) => {
          const { password: _, ...safe } = t;
          const unlocked = await storage.isTeacherUnlocked(userId, t.id);
          return maskTeacherInfo(safe, unlocked);
        }));
        return res.json(results);
      }

      // Teacher viewing other teachers - also masked
      if (role === "teacher" && userId) {
        const results = teachers.map((t) => {
          const { password: _, ...safe } = t;
          // Teacher can see their own full profile
          if (t.id === userId) return { ...safe, isUnlocked: true };
          return maskTeacherInfo(safe, false);
        });
        return res.json(results);
      }

      // Not logged in - masked
      return res.json(teachers.map(t => {
        const { password: _, ...safe } = t;
        return maskTeacherInfo(safe, false);
      }));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/teacher/profile", requireAuth, async (req, res) => {
    const profile = await storage.getTeacherProfile(req.session.userId!);
    return res.json(profile || null);
  });

  app.put("/api/teacher/profile", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getTeacherProfile(req.session.userId!);
      const profileData = {
        ...req.body,
        skills: typeof req.body.skills === "string" ? req.body.skills : JSON.stringify(req.body.skills || []),
        serviceTypes: typeof req.body.serviceTypes === "string" ? req.body.serviceTypes : JSON.stringify(req.body.serviceTypes || []),
        serviceAreas: typeof req.body.serviceAreas === "string" ? req.body.serviceAreas : JSON.stringify(req.body.serviceAreas || []),
        availableTimes: typeof req.body.availableTimes === "string" ? req.body.availableTimes : JSON.stringify(req.body.availableTimes || []),
        certificates: typeof req.body.certificates === "string" ? req.body.certificates : JSON.stringify(req.body.certificates || []),
        demoVideos: typeof req.body.demoVideos === "string" ? req.body.demoVideos : JSON.stringify(req.body.demoVideos || []),
      };

      if (!existing) {
        const profile = await storage.createTeacherProfile({ userId: req.session.userId!, ...profileData });
        return res.json(profile);
      }
      const profile = await storage.updateTeacherProfile(req.session.userId!, profileData);
      return res.json(profile);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/teachers/recommend", requireAuth, async (req, res) => {
    try {
      const { demandId } = req.query;
      if (!demandId) return res.status(400).json({ message: "缺少需求ID" });
      const demand = await storage.getDemand(parseInt(demandId as string));
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      const teachers = await storage.getAllTeachers();
      const scored = teachers
        .filter(t => t.profile)
        .map(t => ({ ...t, matchScore: calculateMatchScore(t, demand) }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 5);
      return res.json(scored);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/teachers/:id", async (req, res) => {
    try {
      if (!req.session.userId) tryJwtAuth(req);
      const teacherUser = await storage.getUser(parseInt(req.params.id));
      if (!teacherUser || teacherUser.role !== "teacher") return res.status(404).json({ message: "老师不存在" });
      const profile = await storage.getTeacherProfile(teacherUser.id);
      const { password: _, ...safeUser } = teacherUser;
      const fullTeacher = { ...safeUser, profile: profile || null };

      const userId = req.session.userId;
      const role = req.session.role;

      // Admin or teacher themselves see full info
      if (role === "admin" || (role === "teacher" && userId === teacherUser.id)) {
        return res.json({ ...fullTeacher, isUnlocked: true });
      }

      // Parent - check unlock status
      if (role === "parent" && userId) {
        const unlocked = await storage.isTeacherUnlocked(userId, teacherUser.id);
        return res.json(maskTeacherInfo(fullTeacher, unlocked));
      }

      // Not logged in or other roles - masked
      return res.json(maskTeacherInfo(fullTeacher, false));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== PACKAGES ===========
  app.get("/api/packages", async (_req, res) => {
    try {
      const packages = await storage.getActivePackages();
      return res.json(packages);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== PURCHASES ===========
  app.post("/api/purchases", requireAuth, async (req, res) => {
    try {
      const { packageId } = req.body;
      const pkg = await storage.getPackage(packageId);
      if (!pkg || !pkg.isActive) return res.status(404).json({ message: "套餐不存在或已下架" });
      const purchase = await storage.createPurchase({
        userId: req.session.userId!,
        packageId: pkg.id,
        amount: pkg.price,
        unlockQuota: null,
        expiresAt: null,
        status: "pending",
        confirmedBy: null,
      });
      return res.json(purchase);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/purchases/my", requireAuth, async (req, res) => {
    try {
      const purchases = await storage.getPurchasesByUser(req.session.userId!);
      return res.json(purchases);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== UNLOCK ===========
  app.get("/api/unlock/status", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const activePurchase = await storage.getActivePurchase(userId);
      const totalUnlocked = await storage.getUnlockCount(userId);
      return res.json({
        hasActivePackage: !!activePurchase,
        remainingUnlocks: activePurchase ? (activePurchase.unlockQuota ?? null) : 0,
        expiresAt: activePurchase?.expiresAt ?? null,
        totalUnlocked,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/unlock/:teacherId", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const teacherId = parseInt(req.params.teacherId);
      const teacherUser = await storage.getUser(teacherId);
      if (!teacherUser || teacherUser.role !== "teacher") {
        return res.status(404).json({ message: "老师不存在" });
      }

      // Already unlocked?
      const alreadyUnlocked = await storage.isTeacherUnlocked(userId, teacherId);
      if (alreadyUnlocked) {
        const profile = await storage.getTeacherProfile(teacherId);
        const { password: _, ...safeUser } = teacherUser;
        return res.json({ ...safeUser, profile: profile || null, isUnlocked: true });
      }

      // Check active purchase
      const activePurchase = await storage.getActivePurchase(userId);
      if (!activePurchase) {
        return res.status(402).json({ message: "没有有效套餐，请先购买" });
      }

      // Deduct quota if not unlimited
      if (activePurchase.unlockQuota !== null) {
        const newQuota = activePurchase.unlockQuota - 1;
        // Use raw update to set new quota
        const { db } = await import("./storage");
        const { userPurchases } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        db.update(userPurchases).set({ unlockQuota: newQuota }).where(eq(userPurchases.id, activePurchase.id)).run();
      }

      // Create unlock record
      await storage.createUnlockRecord({
        parentId: userId,
        teacherId,
        purchaseId: activePurchase.id,
      });

      // Return full teacher info
      const profile = await storage.getTeacherProfile(teacherId);
      const { password: _, ...safeUser } = teacherUser;
      return res.json({ ...safeUser, profile: profile || null, isUnlocked: true });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/unlock/records", requireAuth, async (req, res) => {
    try {
      const records = await storage.getUnlocksByParent(req.session.userId!);
      // Enrich with teacher info
      const enriched = await Promise.all(records.map(async (r) => {
        const teacher = await storage.getUser(r.teacherId);
        const profile = teacher ? await storage.getTeacherProfile(teacher.id) : null;
        return {
          ...r,
          teacher: teacher ? {
            id: teacher.id,
            name: teacher.name,
            city: teacher.city,
            avatar: teacher.avatar,
            profile: profile ? {
              education: profile.education,
              degree: profile.degree,
              skills: profile.skills,
              ratingAvg: profile.ratingAvg,
            } : null,
          } : null,
        };
      }));
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== NOTIFICATIONS ===========
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifs = await storage.getNotificationsByUser(req.session.userId!);
      return res.json(notifs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadCount(req.session.userId!);
      return res.json({ count });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notif = await storage.markAsRead(parseInt(req.params.id));
      if (!notif) return res.status(404).json({ message: "通知不存在" });
      return res.json(notif);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllAsRead(req.session.userId!);
      return res.json({ message: "已全部标记为已读" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== ORDERS ===========
  app.post("/api/orders", requireAuth, async (req, res) => {
    try {
      const { demandId, teacherId, serviceDate, durationHours, totalAmount } = req.body;
      const platformFee = Math.round((totalAmount || 0) * 0.1);
      const teacherIncome = (totalAmount || 0) - platformFee;
      const order = await storage.createOrder({
        demandId,
        parentId: req.session.userId!,
        teacherId,
        serviceDate,
        durationHours,
        totalAmount,
        platformFee,
        teacherIncome,
        paymentStatus: "pending",
        serviceStatus: "scheduled",
      });
      return res.json(order);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/orders/my", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "未登录" });
    let orderList: any[];
    if (user.role === "parent") {
      orderList = await storage.getOrdersByParent(user.id);
    } else if (user.role === "teacher") {
      orderList = await storage.getOrdersByTeacher(user.id);
    } else {
      orderList = await storage.getAllOrders();
    }
    return res.json(orderList);
  });

  app.get("/api/orders/:id", requireAuth, async (req, res) => {
    const order = await storage.getOrder(parseInt(req.params.id));
    if (!order) return res.status(404).json({ message: "订单不存在" });
    return res.json(order);
  });

  app.post("/api/orders/:id/accept", requireAuth, async (req, res) => {
    try {
      const order = await storage.getOrder(parseInt(req.params.id));
      if (!order) return res.status(404).json({ message: "订单不存在" });
      if (order.teacherId !== req.session.userId) return res.status(403).json({ message: "无权操作" });
      const updated = await storage.updateOrderStatus(parseInt(req.params.id), "in_progress", "paid");
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/orders/:id/complete", requireAuth, async (req, res) => {
    try {
      const order = await storage.getOrder(parseInt(req.params.id));
      if (!order) return res.status(404).json({ message: "订单不存在" });
      const updated = await storage.updateOrderStatus(parseInt(req.params.id), "completed");
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/orders/:id/cancel", requireAuth, async (req, res) => {
    try {
      const order = await storage.getOrder(parseInt(req.params.id));
      if (!order) return res.status(404).json({ message: "订单不存在" });
      const updated = await storage.updateOrderStatus(parseInt(req.params.id), "cancelled", "refunded");
      return res.json(updated);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== REVIEWS ===========
  app.post("/api/reviews", requireAuth, async (req, res) => {
    try {
      const review = await storage.createReview({
        ...req.body,
        reviewerId: req.session.userId!,
        photos: JSON.stringify(req.body.photos || []),
      });
      return res.json(review);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      const { teacherId } = req.query;
      if (!teacherId) return res.status(400).json({ message: "缺少老师ID" });
      const reviewList = await storage.getReviewsByTeacher(parseInt(teacherId as string));
      return res.json(reviewList);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== ADMIN ===========
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    return res.json(allUsers.map(({ password: _, ...u }) => u));
  });

  app.put("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const user = await storage.updateUserStatus(parseInt(req.params.id), req.body.status);
      return res.json(user);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/teachers/pending", requireAdmin, async (req, res) => {
    const pending = await storage.getPendingTeachers();
    return res.json(pending.map(({ password: _, ...u }) => u));
  });

  app.post("/api/admin/teachers/:id/verify", requireAdmin, async (req, res) => {
    try {
      const profile = await storage.verifyTeacher(parseInt(req.params.id));
      return res.json(profile);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/orders", requireAdmin, async (req, res) => {
    const orderList = await storage.getAllOrders();
    return res.json(orderList);
  });

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    const stats = await storage.getStats();
    return res.json(stats);
  });

  // Admin purchase management
  app.get("/api/admin/purchases", requireAdmin, async (req, res) => {
    try {
      const purchases = await storage.getAllPurchases();
      // Enrich with user + package info
      const enriched = await Promise.all(purchases.map(async (p) => {
        const user = await storage.getUser(p.userId);
        const pkg = await storage.getPackage(p.packageId);
        return { ...p, userName: user?.name, packageName: pkg?.name };
      }));
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/purchases/pending", requireAdmin, async (req, res) => {
    try {
      const purchases = await storage.getAllPendingPurchases();
      const enriched = await Promise.all(purchases.map(async (p) => {
        const user = await storage.getUser(p.userId);
        const pkg = await storage.getPackage(p.packageId);
        return { ...p, userName: user?.name, packageName: pkg?.name };
      }));
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/purchases/:id/confirm", requireAdmin, async (req, res) => {
    try {
      const purchase = await storage.confirmPurchase(parseInt(req.params.id), req.session.userId!);
      if (!purchase) return res.status(404).json({ message: "购买记录不存在" });
      return res.json(purchase);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/revenue", requireAdmin, async (req, res) => {
    try {
      const allPurchases = await storage.getAllPurchases();
      const confirmed = allPurchases.filter(p => p.status === "confirmed");
      const totalRevenue = confirmed.reduce((sum, p) => sum + p.amount, 0);
      const pendingCount = allPurchases.filter(p => p.status === "pending").length;
      return res.json({ totalRevenue, totalPurchases: allPurchases.length, confirmedCount: confirmed.length, pendingCount });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== ADMIN STATS (DATA DASHBOARD) ===========
  app.get("/api/admin/stats/overview", requireAdmin, async (_req, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const allUsers = db.select().from(users).all();
      const allDemandsList = db.select().from(demands).all();
      const allOrdersList = db.select().from(orders).all();

      const todayUsers = allUsers.filter(u => u.createdAt && new Date(u.createdAt) >= todayStart).length;
      const todayDemands = allDemandsList.filter(d => d.createdAt && new Date(d.createdAt) >= todayStart).length;
      const todayOrders = allOrdersList.filter(o => o.createdAt && new Date(o.createdAt) >= todayStart).length;
      const totalGmv = allOrdersList.filter(o => o.totalAmount).reduce((s, o) => s + (o.totalAmount || 0), 0);
      const totalPlatformFee = allOrdersList.filter(o => o.platformFee).reduce((s, o) => s + (o.platformFee || 0), 0);
      const completedOrders = allOrdersList.filter(o => o.serviceStatus === "completed").length;

      return res.json({
        todayUsers, todayDemands, todayOrders,
        totalGmv, totalPlatformFee, completedOrders,
        totalUsers: allUsers.length,
        totalOrders: allOrdersList.length,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stats/users", requireAdmin, async (_req, res) => {
    try {
      const allUsers = db.select().from(users).all();
      const now = new Date();

      const growth: Record<string, { date: string; parents: number; teachers: number; total: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        growth[key] = { date: key, parents: 0, teachers: 0, total: 0 };
      }
      for (const u of allUsers) {
        if (!u.createdAt) continue;
        const key = new Date(u.createdAt).toISOString().split("T")[0];
        if (growth[key]) {
          growth[key].total++;
          if (u.role === "parent") growth[key].parents++;
          if (u.role === "teacher") growth[key].teachers++;
        }
      }

      const roleDistribution = [
        { role: "家长", count: allUsers.filter(u => u.role === "parent").length },
        { role: "老师", count: allUsers.filter(u => u.role === "teacher").length },
        { role: "管理员", count: allUsers.filter(u => u.role === "admin").length },
      ];

      const cityMap: Record<string, number> = {};
      for (const u of allUsers) {
        if (u.city) cityMap[u.city] = (cityMap[u.city] || 0) + 1;
      }
      const cityDistribution = Object.entries(cityMap)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const profiles = db.select().from(teacherProfiles).all();
      const totalTeachers = profiles.length;
      const certifiedTeachers = profiles.filter(p => p.verified).length;

      return res.json({
        growth: Object.values(growth),
        roleDistribution,
        cityDistribution,
        certificationRate: totalTeachers > 0 ? Math.round((certifiedTeachers / totalTeachers) * 100) : 0,
        totalTeachers,
        certifiedTeachers,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stats/orders", requireAdmin, async (_req, res) => {
    try {
      const allOrdersList = db.select().from(orders).all();
      const allDemandsList = db.select().from(demands).all();
      const now = new Date();

      const trend: Record<string, { date: string; count: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        trend[key] = { date: key, count: 0 };
      }
      for (const o of allOrdersList) {
        if (!o.createdAt) continue;
        const key = new Date(o.createdAt).toISOString().split("T")[0];
        if (trend[key]) trend[key].count++;
      }

      const statusDistribution = [
        { status: "已安排", count: allOrdersList.filter(o => o.serviceStatus === "scheduled").length },
        { status: "进行中", count: allOrdersList.filter(o => o.serviceStatus === "in_progress").length },
        { status: "已完成", count: allOrdersList.filter(o => o.serviceStatus === "completed").length },
        { status: "已取消", count: allOrdersList.filter(o => o.serviceStatus === "cancelled").length },
      ];

      const categoryMap: Record<string, number> = {};
      for (const o of allOrdersList) {
        const demand = allDemandsList.find(d => d.id === o.demandId);
        if (demand) {
          const cat = demand.serviceCategory;
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        }
      }
      const categoryDistribution = Object.entries(categoryMap)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      const amounts = allOrdersList.filter(o => o.totalAmount).map(o => o.totalAmount!);
      const avgAmount = amounts.length > 0 ? Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length) : 0;

      return res.json({
        trend: Object.values(trend),
        statusDistribution,
        categoryDistribution,
        avgAmount,
        totalOrders: allOrdersList.length,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stats/teachers", requireAdmin, async (_req, res) => {
    try {
      const profiles = db.select().from(teacherProfiles).all();
      const allOrdersList = db.select().from(orders).all();
      const allUsers = db.select().from(users).all();

      const ratingBuckets = [
        { range: "5分", count: 0 }, { range: "4-5分", count: 0 },
        { range: "3-4分", count: 0 }, { range: "2-3分", count: 0 },
        { range: "0-2分", count: 0 }, { range: "暂无", count: 0 },
      ];
      for (const p of profiles) {
        const r = p.ratingAvg;
        if (r === 0 && p.totalOrders === 0) ratingBuckets[5].count++;
        else if (r >= 5) ratingBuckets[0].count++;
        else if (r >= 4) ratingBuckets[1].count++;
        else if (r >= 3) ratingBuckets[2].count++;
        else if (r >= 2) ratingBuckets[3].count++;
        else ratingBuckets[4].count++;
      }

      const teacherOrderMap: Record<number, number> = {};
      for (const o of allOrdersList) {
        teacherOrderMap[o.teacherId] = (teacherOrderMap[o.teacherId] || 0) + 1;
      }
      const top10 = Object.entries(teacherOrderMap)
        .map(([tid, count]) => {
          const u = allUsers.find(u => u.id === parseInt(tid));
          return { teacherId: parseInt(tid), name: u?.name || "未知", orderCount: count };
        })
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10);

      const skillMap: Record<string, number> = {};
      for (const p of profiles) {
        try {
          const types: string[] = JSON.parse(p.serviceTypes || "[]");
          for (const t of types) {
            skillMap[t] = (skillMap[t] || 0) + 1;
          }
        } catch {}
      }
      const skillDistribution = Object.entries(skillMap)
        .map(([skill, count]) => ({ skill, count }))
        .sort((a, b) => b.count - a.count);

      return res.json({
        ratingDistribution: ratingBuckets.filter(b => b.count > 0),
        top10Teachers: top10,
        skillDistribution,
        totalTeachers: profiles.length,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== TEACHER CERTIFICATION ===========
  app.post("/api/upload/certification", requireAuth, certUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "请上传图片文件（支持 JPG/PNG/WebP，最大 10MB）" });
      }
      const url = `/uploads/certifications/${req.file.filename}`;
      return res.json({
        url,
        key: req.file.filename,
        size: req.file.size,
        originalName: req.file.originalname,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/teacher/certifications/submit", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user || user.role !== "teacher") {
        return res.status(403).json({ message: "仅老师可提交认证" });
      }

      const profile = await storage.getTeacherProfile(userId);
      if (profile?.certificationStatus === "pending") {
        return res.status(400).json({ message: "当前有审核中的申请，请等待审核结果" });
      }
      if (profile?.certificationStatus === "certified") {
        return res.status(400).json({ message: "您已通过认证，无需重复提交" });
      }

      const { materials, note } = req.body;
      if (!materials || !Array.isArray(materials) || materials.length === 0) {
        return res.status(400).json({ message: "请至少上传一项认证材料" });
      }
      if (materials.length > 5) {
        return res.status(400).json({ message: "最多上传5个文件" });
      }

      const now = new Date();
      const created = [];
      for (const m of materials) {
        const cert = await storage.createCertification({
          teacherId: userId,
          materialType: m.materialType,
          imageUrl: m.imageUrl,
          fileName: m.fileName || null,
          fileSize: m.fileSize || null,
          status: "pending",
          adminNote: note || null,
          reviewedBy: null,
          submittedAt: now,
          reviewedAt: null,
        });
        created.push(cert);
      }

      await storage.updateCertificationStatus(userId, "pending");

      return res.json({ message: "提交成功，请等待审核", certifications: created });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/teacher/certifications/status", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const profile = await storage.getTeacherProfile(userId);
      const certs = await storage.getCertificationsByTeacher(userId);
      return res.json({
        certificationStatus: profile?.certificationStatus || "uncertified",
        certifiedAt: profile?.certifiedAt || null,
        materials: certs,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Admin certification management
  app.get("/api/admin/certifications", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const certs = await storage.getAllCertifications(status);
      // Group by teacher and enrich
      const teacherMap = new Map<number, any>();
      for (const c of certs) {
        if (!teacherMap.has(c.teacherId)) {
          const user = await storage.getUser(c.teacherId);
          const profile = await storage.getTeacherProfile(c.teacherId);
          teacherMap.set(c.teacherId, {
            teacherId: c.teacherId,
            teacherName: user?.name || "未知",
            education: profile?.education || "",
            major: profile?.major || "",
            degree: profile?.degree || "",
            certificationStatus: profile?.certificationStatus || "uncertified",
            materials: [],
          });
        }
        teacherMap.get(c.teacherId)!.materials.push(c);
      }
      return res.json(Array.from(teacherMap.values()));
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/certifications/:id", requireAdmin, async (req, res) => {
    try {
      const cert = await storage.getCertification(parseInt(req.params.id));
      if (!cert) return res.status(404).json({ message: "认证记录不存在" });
      const user = await storage.getUser(cert.teacherId);
      const profile = await storage.getTeacherProfile(cert.teacherId);
      const allCerts = await storage.getCertificationsByTeacher(cert.teacherId);
      return res.json({
        teacherId: cert.teacherId,
        teacherName: user?.name || "未知",
        education: profile?.education || "",
        major: profile?.major || "",
        degree: profile?.degree || "",
        certificationStatus: profile?.certificationStatus || "uncertified",
        materials: allCerts,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/certifications/:id/approve", requireAdmin, async (req, res) => {
    try {
      const cert = await storage.approveCertification(parseInt(req.params.id), req.session.userId!);
      if (!cert) return res.status(404).json({ message: "认证记录不存在" });

      // Send notification to teacher
      await storage.createNotification({
        userId: cert.teacherId,
        type: "system",
        title: "学历认证已通过",
        content: "恭喜！您的学历认证材料已通过审核，您的资料页将展示「已认证」标识。",
        relatedId: cert.id,
        relatedType: "certification",
        matchScore: null,
        isRead: false,
      });

      return res.json({ message: "已通过认证", certification: cert });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/certifications/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "请填写拒绝原因" });
      const cert = await storage.rejectCertification(parseInt(req.params.id), req.session.userId!, reason);
      if (!cert) return res.status(404).json({ message: "认证记录不存在" });

      await storage.createNotification({
        userId: cert.teacherId,
        type: "system",
        title: "学历认证未通过",
        content: `您的学历认证材料未通过审核，原因：${reason}。您可以修改材料后重新提交。`,
        relatedId: cert.id,
        relatedType: "certification",
        matchScore: null,
        isRead: false,
      });

      return res.json({ message: "已拒绝认证", certification: cert });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== DEMAND HALL & APPLICATIONS ===========
  const requireTeacher = async (req: Request, res: Response, next: any) => {
    if (!req.session.userId) tryJwtAuth(req);
    if (!req.session.userId) return res.status(401).json({ message: "未登录" });
    const user = await storage.getUser(req.session.userId);
    if (!user || user.role !== "teacher") return res.status(403).json({ message: "仅老师可访问" });
    next();
  };

  // Demand hall — desensitized list for teachers
  app.get("/api/demand-hall", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.session.userId!;
      const openDemands = await storage.getOpenDemands();
      const { category, city, budgetMin, budgetMax } = req.query;

      let filtered = openDemands;
      if (category) filtered = filtered.filter(d => d.serviceCategory === category);
      if (city) filtered = filtered.filter(d => (d.location || "").includes(city as string));
      if (budgetMin) filtered = filtered.filter(d => (d.budgetMax || Infinity) >= parseInt(budgetMin as string));
      if (budgetMax) filtered = filtered.filter(d => (d.budgetMin || 0) <= parseInt(budgetMax as string));

      const result = await Promise.all(filtered.map(async (d) => {
        const appCount = await storage.getApplicationCountByDemand(d.id);
        const myApp = await storage.getApplicationByDemandAndTeacher(d.id, teacherId);
        return {
          id: d.id,
          childAge: d.childAge,
          childGender: d.childGender,
          serviceCategory: d.serviceCategory,
          specificService: d.specificService,
          serviceType: d.serviceType,
          location: d.location,
          preferredTime: d.preferredTime,
          budgetMin: d.budgetMin,
          budgetMax: d.budgetMax,
          specialRequirements: d.specialRequirements,
          createdAt: d.createdAt,
          applicationCount: appCount,
          myApplicationStatus: myApp?.status || null,
          myApplicationId: myApp?.id || null,
        };
      }));
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Demand hall — single demand detail (desensitized)
  app.get("/api/demand-hall/:demandId", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.session.userId!;
      const demand = await storage.getDemand(parseInt(req.params.demandId));
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      if (demand.status !== "open") return res.status(400).json({ message: "该需求已关闭" });
      const appCount = await storage.getApplicationCountByDemand(demand.id);
      const myApp = await storage.getApplicationByDemandAndTeacher(demand.id, teacherId);
      return res.json({
        id: demand.id,
        childAge: demand.childAge,
        childGender: demand.childGender,
        serviceCategory: demand.serviceCategory,
        specificService: demand.specificService,
        serviceType: demand.serviceType,
        location: demand.location,
        preferredTime: demand.preferredTime,
        budgetMin: demand.budgetMin,
        budgetMax: demand.budgetMax,
        specialRequirements: demand.specialRequirements,
        createdAt: demand.createdAt,
        applicationCount: appCount,
        myApplicationStatus: myApp?.status || null,
        myApplicationId: myApp?.id || null,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Teacher apply to demand
  app.post("/api/demand-hall/:demandId/apply", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.session.userId!;
      const demandId = parseInt(req.params.demandId);
      const { introduction, quotedPrice } = req.body;

      if (!introduction || introduction.length < 1 || introduction.length > 500) {
        return res.status(400).json({ message: "自我介绍需在1-500字之间" });
      }
      if (!quotedPrice || quotedPrice <= 0 || !Number.isInteger(quotedPrice)) {
        return res.status(400).json({ message: "请填写有效的报价（正整数，元/小时）" });
      }

      const demand = await storage.getDemand(demandId);
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      if (demand.status !== "open") return res.status(400).json({ message: "该需求已关闭，无法申请" });

      const existing = await storage.getApplicationByDemandAndTeacher(demandId, teacherId);
      if (existing) return res.status(400).json({ message: "您已申请过该需求" });

      const todayCount = await storage.getTodayApplicationCount(teacherId);
      if (todayCount >= 10) return res.status(429).json({ message: "每日申请上限为10个，请明天再试" });

      const app = await storage.createApplication({
        demandId,
        teacherId,
        introduction,
        quotedPrice,
        status: "pending",
        parentNote: null,
        updatedAt: null,
      });

      // Notify parent
      const parent = await storage.getUser(demand.parentId);
      const teacher = await storage.getUser(teacherId);
      if (parent) {
        await storage.createNotification({
          userId: demand.parentId,
          type: "application",
          title: "有老师申请了您的需求",
          content: `${teacher?.name || "一位老师"}申请了您的「${demand.serviceCategory}」需求，报价 ¥${quotedPrice}/小时。`,
          relatedId: demand.id,
          relatedType: "demand",
          matchScore: null,
          isRead: false,
        });
      }

      return res.json(app);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Teacher withdraw application
  app.delete("/api/demand-applications/:id", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.session.userId!;
      const app = await storage.getApplication(parseInt(req.params.id));
      if (!app) return res.status(404).json({ message: "申请不存在" });
      if (app.teacherId !== teacherId) return res.status(403).json({ message: "无权操作" });
      if (app.status !== "pending") return res.status(400).json({ message: "仅待审核状态可撤回" });
      const updated = await storage.updateApplicationStatus(app.id, "withdrawn");
      return res.json({ message: "已撤回申请", application: updated });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Teacher my applications
  app.get("/api/teacher/my-applications", requireTeacher, async (req, res) => {
    try {
      const teacherId = req.session.userId!;
      const apps = await storage.getApplicationsByTeacher(teacherId);
      const enriched = await Promise.all(apps.map(async (a) => {
        const demand = await storage.getDemand(a.demandId);
        return {
          ...a,
          demand: demand ? {
            id: demand.id,
            serviceCategory: demand.serviceCategory,
            specificService: demand.specificService,
            serviceType: demand.serviceType,
            location: demand.location,
            budgetMin: demand.budgetMin,
            budgetMax: demand.budgetMax,
            childAge: demand.childAge,
            status: demand.status,
          } : null,
        };
      }));
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Parent: view applications for a demand
  app.get("/api/demands/:demandId/applications", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const demandId = parseInt(req.params.demandId);
      const demand = await storage.getDemand(demandId);
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      if (demand.parentId !== userId) return res.status(403).json({ message: "无权查看" });

      const apps = await storage.getApplicationsByDemand(demandId);
      const enriched = await Promise.all(apps.filter(a => a.status !== "withdrawn").map(async (a) => {
        const teacher = await storage.getUser(a.teacherId);
        const profile = teacher ? await storage.getTeacherProfile(teacher.id) : null;
        return {
          ...a,
          teacher: teacher ? {
            id: teacher.id,
            name: teacher.name,
            avatar: teacher.avatar,
            city: teacher.city,
            profile: profile ? {
              education: profile.education,
              degree: profile.degree,
              ratingAvg: profile.ratingAvg,
              totalOrders: profile.totalOrders,
              verified: profile.verified,
              certificationStatus: profile.certificationStatus,
              skills: profile.skills,
            } : null,
          } : null,
        };
      }));
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Parent: accept application
  app.post("/api/demand-applications/:id/accept", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const app = await storage.getApplication(parseInt(req.params.id));
      if (!app) return res.status(404).json({ message: "申请不存在" });
      const demand = await storage.getDemand(app.demandId);
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      if (demand.parentId !== userId) return res.status(403).json({ message: "无权操作" });
      if (app.status !== "pending") return res.status(400).json({ message: "该申请不在待审核状态" });
      if (demand.status !== "open") return res.status(400).json({ message: "该需求已关闭" });

      // Accept this application
      await storage.updateApplicationStatus(app.id, "accepted");
      // Reject all other pending applications
      await storage.rejectOtherApplications(app.demandId, app.id);
      // Update demand status
      await storage.updateDemandStatus(app.demandId, "matched");

      // Auto-create order
      const durationHours = 2;
      const totalAmount = app.quotedPrice * durationHours;
      const platformFee = Math.round(totalAmount * 0.1);
      const teacherIncome = totalAmount - platformFee;
      const order = await storage.createOrder({
        demandId: app.demandId,
        parentId: userId,
        teacherId: app.teacherId,
        serviceDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        durationHours,
        totalAmount,
        platformFee,
        teacherIncome,
        paymentStatus: "pending",
        serviceStatus: "scheduled",
      });

      // Notify accepted teacher
      await storage.createNotification({
        userId: app.teacherId,
        type: "application",
        title: "申请已被接受",
        content: `您对「${demand.serviceCategory}」需求的申请已被家长接受，订单已自动创建。`,
        relatedId: order.id,
        relatedType: "order",
        matchScore: null,
        isRead: false,
      });

      // Notify rejected teachers
      const allApps = await storage.getApplicationsByDemand(app.demandId);
      for (const other of allApps) {
        if (other.id !== app.id && other.status === "rejected") {
          await storage.createNotification({
            userId: other.teacherId,
            type: "application",
            title: "申请未通过",
            content: `您对「${demand.serviceCategory}」需求的申请未通过，该需求已被其他老师接单。`,
            relatedId: demand.id,
            relatedType: "demand",
            matchScore: null,
            isRead: false,
          });
        }
      }

      return res.json({ message: "已接受申请，订单已创建", order });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Parent: reject application
  app.post("/api/demand-applications/:id/reject", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const app = await storage.getApplication(parseInt(req.params.id));
      if (!app) return res.status(404).json({ message: "申请不存在" });
      const demand = await storage.getDemand(app.demandId);
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      if (demand.parentId !== userId) return res.status(403).json({ message: "无权操作" });
      if (app.status !== "pending") return res.status(400).json({ message: "该申请不在待审核状态" });

      const { reason } = req.body;
      await storage.updateApplicationStatus(app.id, "rejected", reason || null);

      await storage.createNotification({
        userId: app.teacherId,
        type: "application",
        title: "申请未通过",
        content: `您对「${demand.serviceCategory}」需求的申请未通过。${reason ? `原因：${reason}` : ""}`,
        relatedId: demand.id,
        relatedType: "demand",
        matchScore: null,
        isRead: false,
      });

      return res.json({ message: "已拒绝该申请" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // Parent: get application counts for demands (batch)
  app.get("/api/demands/application-counts", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const myDemands = await storage.getDemandsByParent(userId);
      const counts: Record<number, number> = {};
      for (const d of myDemands) {
        counts[d.id] = await storage.getApplicationCountByDemand(d.id);
      }
      return res.json(counts);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== MATCH ===========
  app.post("/api/match/calculate", requireAuth, async (req, res) => {
    try {
      const { demandId, teacherId } = req.body;
      const demand = await storage.getDemand(demandId);
      if (!demand) return res.status(404).json({ message: "需求不存在" });
      const teacherUser = await storage.getUser(teacherId);
      if (!teacherUser) return res.status(404).json({ message: "老师不存在" });
      const profile = await storage.getTeacherProfile(teacherId);
      const score = calculateMatchScore({ ...teacherUser, profile }, demand);
      return res.json({ score });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  // =========== CHAT: WebSocket ===========
  const onlineUsers = new Map<number, WebSocket>();

  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const userIdStr = url.searchParams.get("userId");
    if (!userIdStr) {
      ws.close(4001, "Missing userId");
      return;
    }
    const userId = parseInt(userIdStr);

    storage.getUser(userId).then((user) => {
      if (!user) {
        ws.close(4002, "Invalid user");
        return;
      }
      onlineUsers.set(userId, ws);

      ws.on("message", async (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.type === "message" && data.conversationId && data.content) {
            const conv = await storage.getConversation(data.conversationId);
            if (!conv) return;
            if (conv.parentId !== userId && conv.teacherId !== userId) return;
            if (data.content.length > 1000) return;

            const msg = await storage.createMessage({
              conversationId: conv.id,
              senderId: userId,
              type: "text",
              content: data.content,
              systemRefType: null,
              systemRefId: null,
              isRead: false,
            });
            await storage.updateConversationLastMessage(conv.id, msg.id);

            const recipientRole = conv.parentId === userId ? "teacher" : "parent";
            const recipientId = conv.parentId === userId ? conv.teacherId : conv.parentId;
            await storage.incrementUnreadCount(conv.id, recipientRole);

            const outgoing = JSON.stringify({ type: "message", message: msg, conversationId: conv.id });
            ws.send(outgoing);
            if (onlineUsers.has(recipientId)) {
              onlineUsers.get(recipientId)!.send(outgoing);
            } else {
              const sender = await storage.getUser(userId);
              await storage.createNotification({
                userId: recipientId,
                type: "new_message",
                title: "新消息",
                content: `${sender?.name || "对方"}给您发送了一条消息`,
                relatedId: conv.id,
                relatedType: "conversation",
                matchScore: null,
                isRead: false,
              });
            }
          }

          if (data.type === "read" && data.conversationId) {
            const conv = await storage.getConversation(data.conversationId);
            if (!conv) return;
            const role = conv.parentId === userId ? "parent" : "teacher";
            await storage.markConversationRead(conv.id, userId, role);
          }
        } catch {}
      });

      ws.on("close", () => {
        onlineUsers.delete(userId);
      });
    });
  });

  // =========== CHAT: REST API ===========
  app.post("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "未登录" });

      const { teacherId, parentId } = req.body;
      let pId: number, tId: number;

      if (user.role === "parent") {
        if (!teacherId) return res.status(400).json({ message: "缺少 teacherId" });
        pId = userId;
        tId = teacherId;
      } else if (user.role === "teacher") {
        if (!parentId) return res.status(400).json({ message: "缺少 parentId" });
        pId = parentId;
        tId = userId;
      } else {
        return res.status(403).json({ message: "管理员无法发起聊天" });
      }

      const hasAccess = await storage.checkChatAccess(pId, tId);
      if (!hasAccess) {
        return res.status(403).json({ message: "请先解锁该老师或创建订单后才能发消息" });
      }

      const existing = await storage.getConversationByParticipants(pId, tId);
      if (existing) return res.json(existing);

      const conv = await storage.createConversation({
        parentId: pId,
        teacherId: tId,
        lastMessageId: null,
        parentUnreadCount: 0,
        teacherUnreadCount: 0,
        status: "active",
        updatedAt: new Date(),
      });
      return res.json(conv);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "未登录" });

      const convs = await storage.getConversationsByUser(userId, user.role);
      const enriched = await Promise.all(convs.map(async (c) => {
        const otherId = user.role === "parent" ? c.teacherId : c.parentId;
        const other = await storage.getUser(otherId);
        let lastMessage = null;
        if (c.lastMessageId) {
          const msgs = await storage.getMessagesByConversation(c.id, undefined, 1);
          lastMessage = msgs[0] || null;
        }
        return {
          ...c,
          otherUser: other ? { id: other.id, name: other.name, avatar: other.avatar, role: other.role } : null,
          lastMessage,
          unreadCount: user.role === "parent" ? c.parentUnreadCount : c.teacherUnreadCount,
        };
      }));
      return res.json(enriched);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/conversations/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "未登录" });
      const count = await storage.getUnreadConversationCount(userId, user.role);
      return res.json({ count });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const convId = parseInt(req.params.id);
      const conv = await storage.getConversation(convId);
      if (!conv) return res.status(404).json({ message: "会话不存在" });
      if (conv.parentId !== userId && conv.teacherId !== userId) {
        return res.status(403).json({ message: "无权访问" });
      }
      const before = req.query.before ? parseInt(req.query.before as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      const msgs = await storage.getMessagesByConversation(convId, before, Math.min(limit, 50));
      return res.json(msgs);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const convId = parseInt(req.params.id);
      const conv = await storage.getConversation(convId);
      if (!conv) return res.status(404).json({ message: "会话不存在" });
      if (conv.parentId !== userId && conv.teacherId !== userId) {
        return res.status(403).json({ message: "无权操作" });
      }
      const { content } = req.body;
      if (!content || content.length > 1000) {
        return res.status(400).json({ message: "消息内容不能为空且不超过1000字" });
      }
      const msg = await storage.createMessage({
        conversationId: convId,
        senderId: userId,
        type: "text",
        content,
        systemRefType: null,
        systemRefId: null,
        isRead: false,
      });
      await storage.updateConversationLastMessage(convId, msg.id);
      const recipientRole = conv.parentId === userId ? "teacher" : "parent";
      const recipientId = conv.parentId === userId ? conv.teacherId : conv.parentId;
      await storage.incrementUnreadCount(convId, recipientRole);

      if (onlineUsers.has(recipientId)) {
        onlineUsers.get(recipientId)!.send(JSON.stringify({
          type: "message", message: msg, conversationId: convId,
        }));
      }
      return res.json(msg);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/conversations/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const convId = parseInt(req.params.id);
      const conv = await storage.getConversation(convId);
      if (!conv) return res.status(404).json({ message: "会话不存在" });
      if (conv.parentId !== userId && conv.teacherId !== userId) {
        return res.status(403).json({ message: "无权操作" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "未登录" });
      await storage.markConversationRead(convId, userId, user.role);
      return res.json({ message: "已标记为已读" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
