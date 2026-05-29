const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_PATH = path.join(ROOT_DIR, "data.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ leads: [], lastId: 0 }, null, 2), "utf8");
  }
}

async function readData() {
  ensureDataFile();
  const raw = await fsp.readFile(DATA_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeData(data) {
  await fsp.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, statusCode, filePath, contentType) {
  const stream = fs.createReadStream(filePath);
  res.writeHead(statusCode, {
    "Content-Type": contentType
  });
  stream.pipe(res);
}

function contentTypeByExt(ext) {
  const map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
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

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = parsedUrl;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "digital-sme-backend" });
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
    const data = await readData();
    sendJson(res, 200, data.leads);
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/api/leads/")) {
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

  if (req.method === "DELETE" && pathname.startsWith("/api/leads/")) {
    const id = Number(pathname.split("/").pop());
    const data = await readData();
    const before = data.leads.length;
    data.leads = data.leads.filter(item => item.id !== id);
    if (data.leads.length === before) {
      sendJson(res, 404, { message: "Không tìm thấy lead để xóa." });
      return;
    }
    await writeData(data);
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*"
    });
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
});
