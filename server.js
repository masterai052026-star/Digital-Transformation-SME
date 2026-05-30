const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { URL } = require("url");
const { Client } = require("@notionhq/client");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_PATH = path.join(ROOT_DIR, "data.json");
const CHART_DATA_PATH = path.join(ROOT_DIR, "data-chart.json");
const AGENT_STATUS_PATH = path.join(ROOT_DIR, "agents", ".generation-status.json");
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

function applyPasswordEnvToUser(user, password) {
  const passRecord = createPasswordRecord(password);
  user.salt = passRecord.salt;
  user.passwordHash = passRecord.hash;
}

function syncBootstrapPasswordsFromEnv() {
  ensureDataFile();
  const envMap = [
    { username: "admin", envKey: "ADMIN_INITIAL_PASSWORD" },
    { username: "editor", envKey: "EDITOR_INITIAL_PASSWORD" },
    { username: "viewer", envKey: "VIEWER_INITIAL_PASSWORD" }
  ];
  const updates = envMap.filter(item => process.env[item.envKey]);
  if (!updates.length) return;

  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  if (!Array.isArray(data.users)) return;

  updates.forEach(item => {
    const user = data.users.find(u => u.username === item.username);
    if (user) applyPasswordEnvToUser(user, process.env[item.envKey]);
  });

  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  console.log("Bootstrap credentials synced from environment variables.");
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
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8"
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

const REPORT_DEPARTMENTS = {
  sales: { file: path.join("agents", "leader-sales.md"), title: "Kinh doanh" },
  marketing: { file: path.join("agents", "leader-marketing.md"), title: "Marketing" },
  finance: { file: path.join("agents", "leader-finance.md"), title: "Tài chính" }
};

async function readReportFile(department) {
  const meta = REPORT_DEPARTMENTS[department];
  if (!meta) return null;

  const filePath = path.resolve(ROOT_DIR, meta.file);
  if (!filePath.startsWith(path.resolve(ROOT_DIR))) return null;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;

  const content = await fsp.readFile(filePath, "utf8");
  const stat = fs.statSync(filePath);
  return {
    department,
    title: meta.title,
    filename: meta.file,
    content,
    updatedAt: stat.mtime.toISOString()
  };
}

function readAgentGenerationStatus() {
  try {
    if (!fs.existsSync(AGENT_STATUS_PATH)) {
      return { running: false, startedAt: null, completedAt: null, lastError: null, context: null };
    }
    return JSON.parse(fs.readFileSync(AGENT_STATUS_PATH, "utf8"));
  } catch (err) {
    return { running: false, startedAt: null, completedAt: null, lastError: err.message, context: null };
  }
}

function writeAgentGenerationStatus(payload) {
  const agentsDir = path.join(ROOT_DIR, "agents");
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(AGENT_STATUS_PATH, JSON.stringify(payload, null, 2), "utf8");
}

async function triggerN8nAgentWebhook(context, username) {
  const webhookUrl = process.env.N8N_AGENT_WEBHOOK_URL;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context,
      source: "admin",
      triggeredBy: username,
      requestedAt: new Date().toISOString()
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`n8n webhook failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}

function spawnLocalAgentGeneration(context, username) {
  writeAgentGenerationStatus({
    running: true,
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastError: null,
    context,
    triggeredBy: username,
    mode: "local"
  });

  const child = spawn(process.execPath, [path.join(ROOT_DIR, "run-agents.js")], {
    env: { ...process.env, AGENT_MARKET_CONTEXT: context },
    detached: true,
    stdio: "ignore",
    cwd: ROOT_DIR
  });

  child.unref();

  child.on("exit", code => {
    const current = readAgentGenerationStatus();
    writeAgentGenerationStatus({
      ...current,
      running: false,
      completedAt: new Date().toISOString(),
      lastError: code === 0 ? null : `Agent process exited with code ${code}`
    });
  });

  child.on("error", err => {
    const current = readAgentGenerationStatus();
    writeAgentGenerationStatus({
      ...current,
      running: false,
      completedAt: new Date().toISOString(),
      lastError: err.message
    });
  });
}

async function startAgentGeneration(context, username) {
  const status = readAgentGenerationStatus();
  if (status.running) {
    return { ok: false, status: 409, message: "AI Agents đang chạy. Vui lòng đợi hoàn tất." };
  }

  const trimmedContext = String(context || "").trim();
  if (!trimmedContext) {
    return { ok: false, status: 400, message: "Vui lòng nhập yêu cầu/bối cảnh thị trường mới." };
  }

  if (process.env.N8N_AGENT_WEBHOOK_URL) {
    writeAgentGenerationStatus({
      running: true,
      startedAt: new Date().toISOString(),
      completedAt: null,
      lastError: null,
      context: trimmedContext,
      triggeredBy: username,
      mode: "n8n"
    });

    try {
      await triggerN8nAgentWebhook(trimmedContext, username);
      writeAgentGenerationStatus({
        running: false,
        startedAt: readAgentGenerationStatus().startedAt,
        completedAt: new Date().toISOString(),
        lastError: null,
        context: trimmedContext,
        triggeredBy: username,
        mode: "n8n"
      });
      return { ok: true, status: 202, mode: "n8n", message: "Đã gửi yêu cầu tới n8n webhook." };
    } catch (err) {
      writeAgentGenerationStatus({
        running: false,
        startedAt: readAgentGenerationStatus().startedAt,
        completedAt: new Date().toISOString(),
        lastError: err.message,
        context: trimmedContext,
        triggeredBy: username,
        mode: "n8n"
      });
      return { ok: false, status: 502, message: "Không kích hoạt được n8n webhook.", detail: err.message };
    }
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return {
      ok: false,
      status: 503,
      message: "Chưa cấu hình GEMINI_API_KEY hoặc N8N_AGENT_WEBHOOK_URL trên server."
    };
  }

  spawnLocalAgentGeneration(trimmedContext, username);
  return {
    ok: true,
    status: 202,
    mode: "local",
    message: "AI Agents đang chạy ngầm. Quá trình mất khoảng 1-2 phút."
  };
}

const DEFAULT_CHART_DATA = {
  finance: {
    labels: ["Năm 1", "Năm 2", "Năm 3"],
    revenue: [300000000, 550000000, 847058824],
    bep: 847058824
  },
  marketing: {
    labels: ["Facebook", "LinkedIn", "TikTok"],
    leads: [40, 25, 15],
    cost_per_lead: [180000, 320000, 120000]
  }
};

async function readChartData() {
  try {
    const raw = await fsp.readFile(CHART_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      finance: { ...DEFAULT_CHART_DATA.finance, ...(parsed.finance || {}) },
      marketing: { ...DEFAULT_CHART_DATA.marketing, ...(parsed.marketing || {}) }
    };
  } catch (err) {
    if (err.code === "ENOENT") {
      return JSON.parse(JSON.stringify(DEFAULT_CHART_DATA));
    }
    throw err;
  }
}

function parsePercentFromCommand(command) {
  const normalized = String(command || "").toLowerCase();
  const percentMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percentMatch) {
    return parseFloat(percentMatch[1].replace(",", "."));
  }
  const numberMatch = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (numberMatch) {
    return parseFloat(numberMatch[1].replace(",", "."));
  }
  return null;
}

function applyUserCommandToChartData(chartData, userCommand) {
  const command = String(userCommand || "").toLowerCase();
  if (!command.includes("marketing")) {
    throw new Error("Câu lệnh không liên quan đến marketing.");
  }

  const percent = parsePercentFromCommand(command);
  if (percent == null || Number.isNaN(percent)) {
    throw new Error("Không đọc được tỷ lệ phần trăm trong câu lệnh.");
  }

  const baseCosts = [...(chartData.marketing.cost_per_lead || DEFAULT_CHART_DATA.marketing.cost_per_lead)];
  let factor;

  if (command.includes("giảm")) {
    factor = 1 - percent / 100;
  } else if (command.includes("tăng")) {
    factor = 1 + percent / 100;
  } else {
    throw new Error('Câu lệnh marketing cần chứa "tăng" hoặc "giảm".');
  }

  chartData.marketing.cost_per_lead = baseCosts.map(cost => Math.round(cost * factor));
}

function extractUserCommand(body) {
  const raw = body.user_command ?? body.context ?? body.action ?? "";
  return String(raw).trim().replace(/^=+/, "");
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

  if (req.method === "GET" && pathname === "/api/chart-data") {
    try {
      const raw = await fsp.readFile(CHART_DATA_PATH, "utf8");
      sendJson(res, 200, JSON.parse(raw));
    } catch (err) {
      if (err.code === "ENOENT") {
        sendJson(res, 404, { message: "Không tìm thấy file dữ liệu biểu đồ." });
      } else {
        sendJson(res, 500, { message: "Không đọc được dữ liệu biểu đồ.", detail: err.message });
      }
    }
    return;
  }

  if (req.method === "POST" && pathname === "/api/update-charts") {
    try {
      const body = await parseBody(req);
      const userCommand = extractUserCommand(body);

      if (!userCommand) {
        sendJson(res, 400, { message: "Thiếu user_command trong body." });
        return;
      }

      const chartData = await readChartData();
      applyUserCommandToChartData(chartData, userCommand);
      await fsp.writeFile(CHART_DATA_PATH, JSON.stringify(chartData, null, 2), "utf8");
      sendJson(res, 200, { message: "Update success" });
    } catch (err) {
      sendJson(res, 400, { message: err.message || "Không xử lý được câu lệnh." });
    }
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

  if (req.method === "GET" && pathname === "/api/generate-plan/status") {
    sendJson(res, 200, { ok: true, ...readAgentGenerationStatus() });
    return;
  }

  if (req.method === "POST" && pathname === "/api/generate-plan") {
    try {
      const body = await parseBody(req);
      const session = getSession(req);
      const username = session ? session.username : String(body.username || "admin-test").trim() || "admin-test";
      const result = await startAgentGeneration(body.context || body.marketContext, username);
      sendJson(res, result.status, {
        ok: result.ok,
        message: result.message,
        mode: result.mode || null,
        detail: result.detail || null
      });
    } catch (err) {
      sendJson(res, 500, { ok: false, message: "Không kích hoạt được AI Agents.", detail: err.message });
    }
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/reports/")) {
    const session = requireAuth(req, res, "content.read");
    if (!session) return;

    const department = pathname.split("/").pop();
    const wantsPlainText = (req.headers.accept || "").includes("text/plain");

    try {
      const report = await readReportFile(department);
      if (!report) {
        sendJson(res, 404, { message: "Không tìm thấy báo cáo cho phòng ban này." });
        return;
      }

      if (wantsPlainText) {
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        });
        res.end(report.content);
        return;
      }

      sendJson(res, 200, report);
    } catch (err) {
      sendJson(res, 500, { message: "Không đọc được file báo cáo.", detail: err.message });
    }
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
  syncBootstrapPasswordsFromEnv();
  console.log(`Digital SME backend listening on port ${PORT}`);
});
