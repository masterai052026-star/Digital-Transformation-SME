const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { Client } = require("@notionhq/client");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_PATH = path.join(ROOT_DIR, "data.json");
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const sessions = new Map();

const DEFAULT_CONTENT = {
  siteName: "Digital SME",
  heroBadge: "Dành riêng cho doanh nghiệp SME",
  heroTitle: "Kiến trúc hệ thống vững —",
  heroTitleHighlight: "Chuyển đổi số bền vững",
  heroDescription:
    "Tư vấn chiến lược & thiết kế kiến trúc CNTT giúp SME thoát khỏi quản lý thủ công, làm chủ dòng dữ liệu và mở rộng quy mô an toàn — không cần đội ngũ IT khổng lồ.",
  heroCtaPrimary: "Đặt lịch tư vấn 30 phút miễn phí",
  heroCtaSecondary: "Xem giải pháp",
  statProjects: "50+",
  statProjectsLabel: "Dự án SME",
  statDuration: "30'",
  statDurationLabel: "Buổi tư vấn đầu",
  statPrice: "0đ",
  statPriceLabel: "Phí buổi đầu",
  painTitle: "Nỗi đau của SME",
  painIntro:
    "Khi doanh nghiệp vượt quy mô “chạy bằng kinh nghiệm”, chi phí ẩn lớn nhất không phải phần mềm — mà là dữ liệu không nói cùng một ngôn ngữ giữa các phòng ban, khiến lãnh đạo quyết định muộn và sai lệch.",
  solutionsTitle: "Giải pháp tư vấn",
  solutionsIntro:
    "Gói tư vấn thực chiến — từ đánh giá hiện trạng đến blueprint kiến trúc có thể triển khai ngay với đối tác hoặc đội nội bộ.",
  expertTitle: "Kết hợp chiều sâu kỹ thuật & tư duy điều hành",
  expertDescription:
    "Tôi làm việc với SME ở giao điểm kiến trúc hệ thống và chiến lược vận hành — không chỉ vẽ sơ đồ đẹp mà đảm bảo lộ trình chuyển đổi số khả thi với nguồn lực và ngân sách thực tế của doanh nghiệp vừa và nhỏ.",
  expertQuote:
    "Mục tiêu của tôi: giúp bạn có một kiến trúc dữ liệu mà ban lãnh đạo tin được — trước khi bỏ ngân sách vào phần mềm mới.",
  registerTitle: "Đăng ký tư vấn 30 phút miễn phí",
  registerDescription: "Chọn khung giờ phù hợp trực tiếp trên Calendly để xác nhận lịch tự động.",
  calendlyUrl: "https://calendly.com/masterai052026",
  contactEmail: "hello@digitalsme.vn",
  footerText: "© 2026 Digital SME — Tư vấn Kiến trúc Hệ thống & Chuyển đổi số"
};

const CONTENT_RULES = {
  siteName: { max: 30, hint: "Tên ngắn trên menu. Khuyến nghị ≤ 20 ký tự." },
  heroBadge: { max: 55, hint: "Nhãn nhỏ phía trên tiêu đề. Giữ trong 1 dòng." },
  heroTitle: { max: 45, hint: "Dòng tiêu đề chính. Tránh quá dài — dễ xuống 2-3 dòng trên mobile." },
  heroTitleHighlight: { max: 35, hint: "Cụm từ nổi bật (gradient). Nên 3-6 từ." },
  heroDescription: { max: 220, hint: "Mô tả hero: 2-3 câu. Quá dài sẽ đẩy nút CTA xuống." },
  heroCtaPrimary: { max: 42, hint: "Text nút chính. Ngắn gọn, ≤ 35 ký tự." },
  heroCtaSecondary: { max: 25, hint: "Text nút phụ. 2-4 từ." },
  statProjects: { max: 10, hint: "Số liệu ngắn. VD: 50+, 100+" },
  statProjectsLabel: { max: 22, hint: "Nhãn dưới số liệu. 2-4 từ." },
  statDuration: { max: 10, hint: "VD: 30', 45 phút" },
  statDurationLabel: { max: 22, hint: "Nhãn thời lượng." },
  statPrice: { max: 10, hint: "VD: 0đ, Miễn phí" },
  statPriceLabel: { max: 22, hint: "Nhãn phí." },
  painTitle: { max: 40, hint: "Tiêu đề section. 3-6 từ." },
  painIntro: { max: 280, hint: "Đoạn mở đầu section. Tối đa ~2-3 câu." },
  solutionsTitle: { max: 40, hint: "Tiêu đề section giải pháp." },
  solutionsIntro: { max: 200, hint: "Mô tả ngắn dưới tiêu đề." },
  expertTitle: { max: 55, hint: "Tiêu đề chuyên gia. Tránh quá 2 dòng." },
  expertDescription: { max: 320, hint: "Mô tả profile. 3-4 câu là hợp lý." },
  expertQuote: { max: 180, hint: "Trích dẫn ngắn, 1-2 câu." },
  registerTitle: { max: 45, hint: "Tiêu đề form đặt lịch." },
  registerDescription: { max: 160, hint: "Mô tả ngắn dưới tiêu đề đăng ký." },
  calendlyUrl: { max: 200, hint: "URL đầy đủ bắt đầu bằng https://", type: "url" },
  contactEmail: { max: 80, hint: "Email hợp lệ. VD: hello@congty.vn", type: "email" },
  footerText: { max: 90, hint: "Dòng copyright footer. 1 dòng." }
};

function validateContent(body) {
  const errors = [];
  const sanitized = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const urlPattern = /^https:\/\/.+/i;

  Object.keys(CONTENT_RULES).forEach(key => {
    const rule = CONTENT_RULES[key];
    const raw = body[key];
    if (raw === undefined || raw === null) return;
    const value = String(raw).trim();
    if (!value) {
      errors.push({ field: key, message: "Không được để trống." });
      return;
    }
    if (value.length > rule.max) {
      errors.push({ field: key, message: `Vượt quá ${rule.max} ký tự (hiện ${value.length}).` });
    }
    if (rule.type === "email" && !emailPattern.test(value)) {
      errors.push({ field: key, message: "Email không đúng định dạng." });
    }
    if (rule.type === "url" && !urlPattern.test(value)) {
      errors.push({ field: key, message: "URL phải bắt đầu bằng https://" });
    }
    sanitized[key] = value;
  });

  if (errors.length) return { ok: false, errors };
  return { ok: true, content: sanitized };
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: hashPassword(password, salt) };
}

function verifyPassword(password, salt, hash) {
  return hashPassword(password, salt) === hash;
}

function resolveBootstrapPassword(role) {
  const envKeys = {
    admin: "ADMIN_INITIAL_PASSWORD",
    editor: "EDITOR_INITIAL_PASSWORD",
    viewer: "VIEWER_INITIAL_PASSWORD"
  };
  const fromEnv = process.env[envKeys[role]];
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    return crypto.randomBytes(24).toString("base64url");
  }

  const devDefaults = {
    admin: "admin123",
    editor: "editor123",
    viewer: "viewer123"
  };
  return devDefaults[role];
}

function createDefaultData() {
  const adminPass = createPasswordRecord(resolveBootstrapPassword("admin"));
  const editorPass = createPasswordRecord(resolveBootstrapPassword("editor"));
  const viewerPass = createPasswordRecord(resolveBootstrapPassword("viewer"));

  return {
    leads: [],
    lastId: 0,
    users: [
      {
        id: 1,
        username: "admin",
        displayName: "Quản trị viên",
        role: "admin",
        salt: adminPass.salt,
        passwordHash: adminPass.hash
      },
      {
        id: 2,
        username: "editor",
        displayName: "Biên tập viên",
        role: "editor",
        salt: editorPass.salt,
        passwordHash: editorPass.hash
      },
      {
        id: 3,
        username: "viewer",
        displayName: "Nhân viên xem",
        role: "viewer",
        salt: viewerPass.salt,
        passwordHash: viewerPass.hash
      }
    ],
    content: { ...DEFAULT_CONTENT },
    lastUserId: 3,
    updatedAt: new Date().toISOString()
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(createDefaultData(), null, 2), "utf8");
    if (process.env.NODE_ENV === "production" && !process.env.ADMIN_INITIAL_PASSWORD) {
      console.warn("Bootstrap data created. Set ADMIN_INITIAL_PASSWORD on Render before the next fresh deploy to control the admin password.");
    }
  }
}

async function readData() {
  ensureDataFile();
  const raw = await fsp.readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!data.users) data.users = createDefaultData().users;
  if (!data.content) data.content = { ...DEFAULT_CONTENT };
  if (!data.lastUserId) data.lastUserId = Math.max(0, ...data.users.map(u => u.id));
  return data;
}

async function writeData(data) {
  data.updatedAt = new Date().toISOString();
  await fsp.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  const cookies = parseCookies(req);
  return cookies.session || null;
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSession(req) {
  const token = getToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function destroySession(req) {
  const token = getToken(req);
  if (token) sessions.delete(token);
}

function hasPermission(role, action) {
  const matrix = {
    viewer: ["leads.read", "content.read"],
    editor: ["leads.read", "leads.write", "content.read", "content.write"],
    admin: ["leads.read", "leads.write", "content.read", "content.write", "users.read", "users.write"]
  };
  return (matrix[role] || []).includes(action);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, statusCode, filePath, contentType) {
  const stream = fs.createReadStream(filePath);
  res.writeHead(statusCode, { "Content-Type": contentType });
  stream.pipe(res);
}

function contentTypeByExt(ext) {
  const map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function requireAuth(req, res, action) {
  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { message: "Vui lòng đăng nhập." });
    return null;
  }
  if (!hasPermission(session.role, action)) {
    sendJson(res, 403, { message: "Bạn không có quyền thực hiện thao tác này." });
    return null;
  }
  return session;
}

const NOTION_PROPERTY_ALIASES = {
  full_name: [
    "Họ tên", "Ho ten", "Name", "Full Name", "Full name", "Tên",
    "Invitee Name", "Guest Name", "Attendee Name", "Client Name"
  ],
  work_email: [
    "Email", "Work Email", "Email công việc", "Email cong viec",
    "Invitee Email", "Guest Email", "Email Address", "Email address"
  ],
  phone_number: [
    "Số điện thoại", "So dien thoai", "Phone", "Phone Number", "Điện thoại",
    "Invitee Phone", "Guest Phone", "Text Phone Number", "Mobile"
  ],
  company_name: [
    "Doanh nghiệp", "Doanh nghiep", "Company", "Company Name", "Công ty",
    "Organization", "Invitee Company", "Business Name"
  ],
  preferred_time: [
    "Khung giờ", "Khung gio", "Preferred Time", "Event Time", "Start Time", "Thời gian", "Lịch hẹn",
    "Event Start Time", "Meeting Time", "Scheduled At", "When", "Date", "Start", "End Time"
  ],
  source: [
    "Nguồn", "Nguon", "Source", "Event Type", "Calendly Event", "Meeting Type", "Event Name"
  ],
  pain_points: [
    "Pain Points", "Ghi chú", "Ghi chu", "Notes", "Nỗi đau", "Question", "Questions", "Answer"
  ]
};

function getNotionClient() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return null;
  return new Client({
    auth: apiKey,
    notionVersion: "2025-09-03"
  });
}

function extractNotionText(property) {
  if (!property) return "";
  switch (property.type) {
    case "title":
      return (property.title || []).map(item => item.plain_text).join("").trim();
    case "rich_text":
      return (property.rich_text || []).map(item => item.plain_text).join("").trim();
    case "email":
      return property.email || "";
    case "phone_number":
      return property.phone_number || "";
    case "select":
      return property.select?.name || "";
    case "multi_select":
      return (property.multi_select || []).map(item => item.name).join(", ");
    case "url":
      return property.url || "";
    case "number":
      return property.number != null ? String(property.number) : "";
    case "date":
      if (!property.date) return "";
      return property.date.end
        ? `${property.date.start} → ${property.date.end}`
        : property.date.start || "";
    case "checkbox":
      return property.checkbox ? "Có" : "Không";
    case "status":
      return property.status?.name || "";
    default:
      return "";
  }
}

function findNotionProperty(properties, aliases) {
  const keys = Object.keys(properties || {});
  for (const alias of aliases) {
    const exact = keys.find(key => key === alias);
    if (exact) return properties[exact];
    const ci = keys.find(key => key.toLowerCase() === alias.toLowerCase());
    if (ci) return properties[ci];
    const partial = keys.find(key => key.toLowerCase().includes(alias.toLowerCase()));
    if (partial) return properties[partial];
  }
  return null;
}

function findFirstNotionPropertyByType(properties, type) {
  return Object.values(properties || {}).find(property => property.type === type) || null;
}

function normalizeNotionDatabaseId(rawId) {
  return String(rawId || "").replace(/-/g, "").trim();
}

function parseNotionLead(page, index) {
  const props = page.properties || {};
  const titleProp = Object.values(props).find(p => p.type === "title");
  const emailProp =
    findNotionProperty(props, NOTION_PROPERTY_ALIASES.work_email) ||
    findFirstNotionPropertyByType(props, "email");
  const phoneProp =
    findNotionProperty(props, NOTION_PROPERTY_ALIASES.phone_number) ||
    findFirstNotionPropertyByType(props, "phone_number");
  const timeProp =
    findNotionProperty(props, NOTION_PROPERTY_ALIASES.preferred_time) ||
    findFirstNotionPropertyByType(props, "date");
  const fullName =
    extractNotionText(findNotionProperty(props, NOTION_PROPERTY_ALIASES.full_name)) ||
    extractNotionText(titleProp);

  return {
    id: page.id,
    notion_id: page.id,
    full_name: fullName,
    work_email: extractNotionText(emailProp),
    company_name: extractNotionText(findNotionProperty(props, NOTION_PROPERTY_ALIASES.company_name)),
    phone_number: extractNotionText(phoneProp),
    preferred_time: extractNotionText(timeProp),
    source: extractNotionText(findNotionProperty(props, NOTION_PROPERTY_ALIASES.source)) || "notion",
    pain_points: extractNotionText(findNotionProperty(props, NOTION_PROPERTY_ALIASES.pain_points)),
    created_at: page.created_time || "",
    updated_at: page.last_edited_time || "",
    row_number: index + 1
  };
}

async function resolveNotionDataSourceId(notion, databaseId) {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  const sources = database.data_sources || [];
  if (!sources.length) {
    const err = new Error("Notion Database không có data source để truy vấn.");
    err.code = "NOTION_NO_DATA_SOURCE";
    throw err;
  }
  return sources[0].id;
}

async function fetchNotionLeads() {
  const databaseId = normalizeNotionDatabaseId(process.env.NOTION_DATABASE_ID);
  const notion = getNotionClient();

  if (!notion || !databaseId) {
    const err = new Error("Thiếu cấu hình NOTION_API_KEY hoặc NOTION_DATABASE_ID.");
    err.code = "NOTION_CONFIG_MISSING";
    throw err;
  }

  const dataSourceId = await resolveNotionDataSourceId(notion, databaseId);
  const leads = [];
  let cursor;

  do {
    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      sorts: [{ timestamp: "created_time", direction: "descending" }]
    });

    response.results.forEach((page, idx) => {
      if (page.object === "page") {
        leads.push(parseNotionLead(page, leads.length + idx));
      }
    });

    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return leads;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = parsedUrl;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "digital-sme-backend" });
    return;
  }

  if (req.method === "GET" && pathname === "/api/content") {
    const data = await readData();
    sendJson(res, 200, data.content);
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    try {
      const body = await parseBody(req);
      const { username, password } = body;
      const data = await readData();
      const user = data.users.find(u => u.username === String(username || "").trim());
      if (!user || !verifyPassword(password || "", user.salt, user.passwordHash)) {
        sendJson(res, 401, { message: "Sai tên đăng nhập hoặc mật khẩu." });
        return;
      }
      const token = createSession(user);
      sendJson(res, 200, { token, user: sanitizeUser(user) }, {
        "Set-Cookie": `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}`
      });
      return;
    } catch (err) {
      sendJson(res, 400, { message: "JSON không hợp lệ." });
      return;
    }
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    destroySession(req);
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0"
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { message: "Chưa đăng nhập." });
      return;
    }
    sendJson(res, 200, {
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        role: session.role
      },
      permissions: {
        canViewLeads: hasPermission(session.role, "leads.read"),
        canEditLeads: hasPermission(session.role, "leads.write"),
        canEditContent: hasPermission(session.role, "content.write"),
        canViewUsers: hasPermission(session.role, "users.read"),
        canManageUsers: hasPermission(session.role, "users.write")
      }
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/content/rules") {
    sendJson(res, 200, CONTENT_RULES);
    return;
  }

  if (req.method === "PUT" && pathname === "/api/content") {
    const session = requireAuth(req, res, "content.write");
    if (!session) return;
    try {
      const body = await parseBody(req);
      const validation = validateContent(body);
      if (!validation.ok) {
        sendJson(res, 400, { message: "Dữ liệu không hợp lệ.", errors: validation.errors });
        return;
      }
      const data = await readData();
      data.content = { ...data.content, ...validation.content };
      await writeData(data);
      sendJson(res, 200, { ok: true, message: "Lưu thành công.", content: data.content });
      return;
    } catch (err) {
      sendJson(res, 400, { message: "JSON không hợp lệ." });
      return;
    }
  }

  if (req.method === "GET" && pathname === "/api/users") {
    const session = requireAuth(req, res, "users.read");
    if (!session) return;
    const data = await readData();
    sendJson(res, 200, data.users.map(sanitizeUser));
    return;
  }

  if (req.method === "POST" && pathname === "/api/users") {
    const session = requireAuth(req, res, "users.write");
    if (!session) return;
    try {
      const body = await parseBody(req);
      const username = String(body.username || "").trim().toLowerCase();
      const displayName = String(body.displayName || "").trim();
      const password = String(body.password || "");
      const role = String(body.role || "").trim();

      if (!username || !displayName || !password) {
        sendJson(res, 400, { message: "Username, tên hiển thị và mật khẩu là bắt buộc." });
        return;
      }
      if (!/^[a-z0-9_]{3,30}$/.test(username)) {
        sendJson(res, 400, { message: "Username chỉ gồm chữ thường, số, gạch dưới (3-30 ký tự)." });
        return;
      }
      if (password.length < 6) {
        sendJson(res, 400, { message: "Mật khẩu tối thiểu 6 ký tự." });
        return;
      }
      if (!["viewer", "editor", "admin"].includes(role)) {
        sendJson(res, 400, { message: "Quyền phải là viewer, editor hoặc admin." });
        return;
      }

      const data = await readData();
      if (data.users.some(u => u.username === username)) {
        sendJson(res, 409, { message: "Username đã tồn tại." });
        return;
      }

      const passRecord = createPasswordRecord(password);
      const id = data.lastUserId + 1;
      const user = {
        id,
        username,
        displayName,
        role,
        salt: passRecord.salt,
        passwordHash: passRecord.hash
      };
      data.lastUserId = id;
      data.users.push(user);
      await writeData(data);
      sendJson(res, 201, { ok: true, message: "Tạo tài khoản thành công.", user: sanitizeUser(user) });
      return;
    } catch (err) {
      sendJson(res, 400, { message: "JSON không hợp lệ." });
      return;
    }
  }

  if (req.method === "PUT" && pathname.startsWith("/api/users/")) {
    const session = requireAuth(req, res, "users.write");
    if (!session) return;
    try {
      const id = Number(pathname.split("/").pop());
      const body = await parseBody(req);
      const data = await readData();
      const user = data.users.find(u => u.id === id);
      if (!user) {
        sendJson(res, 404, { message: "Không tìm thấy tài khoản." });
        return;
      }
      if (body.displayName) user.displayName = String(body.displayName).trim();
      if (body.role) {
        const role = String(body.role).trim();
        if (!["viewer", "editor", "admin"].includes(role)) {
          sendJson(res, 400, { message: "Quyền không hợp lệ." });
          return;
        }
        if (user.id === session.userId && role !== "admin") {
          sendJson(res, 400, { message: "Không thể tự hạ quyền admin của chính mình." });
          return;
        }
        user.role = role;
      }
      if (body.password) {
        const password = String(body.password);
        if (password.length < 6) {
          sendJson(res, 400, { message: "Mật khẩu mới tối thiểu 6 ký tự." });
          return;
        }
        const passRecord = createPasswordRecord(password);
        user.salt = passRecord.salt;
        user.passwordHash = passRecord.hash;
      }
      await writeData(data);
      sendJson(res, 200, { ok: true, message: "Cập nhật tài khoản thành công.", user: sanitizeUser(user) });
      return;
    } catch (err) {
      sendJson(res, 400, { message: "JSON không hợp lệ." });
      return;
    }
  }

  if (req.method === "POST" && pathname === "/api/leads") {
    try {
      const body = await parseBody(req);
      const { fullName, workEmail, companyName, phoneNumber, preferredTime, source } = body;
      if (!fullName || !workEmail) {
        sendJson(res, 400, { message: "fullName và workEmail là bắt buộc." });
        return;
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(workEmail)) {
        sendJson(res, 400, { message: "Email không hợp lệ." });
        return;
      }
      const data = await readData();
      const id = data.lastId + 1;
      const lead = {
        id,
        full_name: String(fullName).trim(),
        work_email: String(workEmail).trim(),
        company_name: String(companyName || "").trim(),
        phone_number: String(phoneNumber || "").trim(),
        preferred_time: String(preferredTime || "").trim(),
        source: String(source || "website").trim(),
        created_at: new Date().toISOString()
      };
      data.lastId = id;
      data.leads.unshift(lead);
      await writeData(data);
      sendJson(res, 201, lead);
      return;
    } catch (err) {
      sendJson(res, 400, { message: "JSON không hợp lệ." });
      return;
    }
  }

  if (req.method === "GET" && pathname === "/api/leads") {
    const session = requireAuth(req, res, "leads.read");
    if (!session) return;
    try {
      const leads = await fetchNotionLeads();
      sendJson(res, 200, leads);
    } catch (err) {
      console.error("Notion leads fetch error:", err.code || err.message);
      const status = err.code === "NOTION_CONFIG_MISSING" ? 503 : 502;
      sendJson(res, status, {
        message: err.code === "NOTION_CONFIG_MISSING"
          ? "Chưa cấu hình Notion. Thiết lập NOTION_API_KEY và NOTION_DATABASE_ID trên server."
          : "Không thể tải dữ liệu từ Notion. Kiểm tra API key, Database ID và quyền kết nối.",
        detail: err.message
      });
    }
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/leads/")) {
    const session = requireAuth(req, res, "leads.read");
    if (!session) return;
    const id = Number(pathname.split("/").pop());
    const data = await readData();
    const lead = data.leads.find(item => item.id === id);
    if (!lead) {
      sendJson(res, 404, { message: "Không tìm thấy lead." });
      return;
    }
    sendJson(res, 200, lead);
    return;
  }

  if (req.method === "PUT" && pathname.startsWith("/api/leads/")) {
    const session = requireAuth(req, res, "leads.write");
    if (!session) return;
    try {
      const id = Number(pathname.split("/").pop());
      const body = await parseBody(req);
      const data = await readData();
      const index = data.leads.findIndex(item => item.id === id);
      if (index === -1) {
        sendJson(res, 404, { message: "Không tìm thấy lead." });
        return;
      }
      data.leads[index] = {
        ...data.leads[index],
        full_name: String(body.fullName ?? data.leads[index].full_name).trim(),
        work_email: String(body.workEmail ?? data.leads[index].work_email).trim(),
        company_name: String(body.companyName ?? data.leads[index].company_name).trim(),
        phone_number: String(body.phoneNumber ?? data.leads[index].phone_number).trim(),
        preferred_time: String(body.preferredTime ?? data.leads[index].preferred_time).trim(),
        source: String(body.source ?? data.leads[index].source).trim()
      };
      await writeData(data);
      sendJson(res, 200, data.leads[index]);
      return;
    } catch (err) {
      sendJson(res, 400, { message: "JSON không hợp lệ." });
      return;
    }
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/leads/")) {
    const session = requireAuth(req, res, "leads.write");
    if (!session) return;
    const id = Number(pathname.split("/").pop());
    const data = await readData();
    const before = data.leads.length;
    data.leads = data.leads.filter(item => item.id !== id);
    if (data.leads.length === before) {
      sendJson(res, 404, { message: "Không tìm thấy lead để xóa." });
      return;
    }
    await writeData(data);
    res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
    res.end();
    return;
  }

  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(ROOT_DIR, normalizedPath);

  if (!filePath.startsWith(ROOT_DIR)) {
    sendJson(res, 403, { message: "Forbidden" });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendJson(res, 404, { message: "Not found" });
    return;
  }

  sendFile(res, 200, filePath, contentTypeByExt(path.extname(filePath)));
});

server.listen(PORT, () => {
  console.log(`Digital SME backend listening on port ${PORT}`);
});
