const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

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

function createDefaultData() {
  const adminPass = createPasswordRecord("admin123");
  const editorPass = createPasswordRecord("editor123");
  const viewerPass = createPasswordRecord("viewer123");

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
    updatedAt: new Date().toISOString()
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(createDefaultData(), null, 2), "utf8");
  }
}

async function readData() {
  ensureDataFile();
  const raw = await fsp.readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);
  if (!data.users) data.users = createDefaultData().users;
  if (!data.content) data.content = { ...DEFAULT_CONTENT };
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
    admin: ["leads.read", "leads.write", "content.read", "content.write", "users.read"]
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
        canViewUsers: hasPermission(session.role, "users.read")
      }
    });
    return;
  }

  if (req.method === "PUT" && pathname === "/api/content") {
    const session = requireAuth(req, res, "content.write");
    if (!session) return;
    try {
      const body = await parseBody(req);
      const data = await readData();
      data.content = { ...data.content, ...body };
      await writeData(data);
      sendJson(res, 200, data.content);
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
    const data = await readData();
    sendJson(res, 200, data.leads);
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
  console.log(`Server running at http://localhost:${PORT}`);
  console.log("Default accounts: admin/admin123, editor/editor123, viewer/viewer123");
});
