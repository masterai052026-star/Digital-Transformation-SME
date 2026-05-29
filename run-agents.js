const fs = require("fs");
const path = require("path");

// Tự động load file .env nếu có
function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    console.log("ℹ️ Đang đọc cấu hình từ file .env...");
    const content = fs.readFileSync(envPath, "utf8");
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const index = trimmed.indexOf("=");
      if (index > 0) {
        const key = trimmed.slice(0, index).trim();
        let val = trimmed.slice(index + 1).trim();
        // Bỏ dấu nháy kép hoặc đơn ở đầu/cuối giá trị nếu có
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

// Lấy API Key từ các nguồn khác nhau
let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// Nếu truyền API key qua đối số dòng lệnh: node run-agents.js KEY
if (process.argv[2] && !process.argv[2].startsWith("-")) {
  apiKey = process.argv[2];
}

if (!apiKey) {
  console.error("\n❌ LỖI: Không tìm thấy Gemini API Key!");
  console.error("Vui lòng thực hiện một trong hai cách sau:");
  console.error("Cách 1: Tạo file `.env` ở thư mục gốc của dự án với nội dung:");
  console.error("   GEMINI_API_KEY=your_actual_api_key");
  console.error("Cách 2: Chạy lệnh trực tiếp kèm API key:");
  console.error("   node run-agents.js AIzaSyYourKeyHere\n");
  process.exit(1);
}

// Cấu hình Model
const MODEL_NAME = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

/**
 * Hàm gọi Gemini API trực tiếp bằng REST
 */
async function callGemini(systemInstruction, prompt, temperature = 0.7) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: 8192
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      throw new Error("Không có kết quả trả về từ Gemini API (có thể bị chặn filter).");
    }

    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("❌ Lỗi khi kết nối với Gemini API:", error.message);
    throw error;
  }
}

// Bối cảnh doanh nghiệp "Digital SME" từ server.js
const BUSINESS_CONTEXT = `
Bối cảnh Doanh nghiệp tư vấn: "Digital SME"
- Lĩnh vực: Tư vấn chiến lược & thiết kế kiến trúc CNTT / Chuyển đổi số cho doanh nghiệp vừa và nhỏ (SME) Việt Nam.
- Tầm nhìn: Giúp SME thoát khỏi quản lý thủ công, làm chủ dòng dữ liệu và mở rộng quy mô an toàn mà không cần đội ngũ IT khổng lồ.
- Nỗi đau chính của SME Việt: Dữ liệu không thống nhất giữa các phòng ban (Sales, Marketing, Kế toán chạy riêng rẽ), lãnh đạo quyết định muộn và thiếu chính xác dựa trên cảm tính, tốn kém chi phí mua phần mềm nhưng không dùng hiệu quả.
- Phương châm: "Có một kiến trúc dữ liệu mà ban lãnh đạo tin được trước khi bỏ ngân sách vào phần mềm mới".
`;

function buildFullContext() {
  const extra = (process.env.AGENT_MARKET_CONTEXT || "").trim();
  if (!extra) return BUSINESS_CONTEXT;
  return `${BUSINESS_CONTEXT}

--- YÊU CẦU/BỐI CẢNH MỚI TỪ BAN LÃNH ĐẠO ---
${extra}
---`;
}

const FULL_CONTEXT = buildFullContext();
const AGENT_STATUS_PATH = path.join(__dirname, "agents", ".generation-status.json");
const CHART_DATA_PATH = path.join(__dirname, "data-chart.json");

function writeJobStatus(patch) {
  const agentsDir = path.join(__dirname, "agents");
  if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
  let current = {};
  if (fs.existsSync(AGENT_STATUS_PATH)) {
    try {
      current = JSON.parse(fs.readFileSync(AGENT_STATUS_PATH, "utf8"));
    } catch (err) {
      current = {};
    }
  }
  fs.writeFileSync(
    AGENT_STATUS_PATH,
    JSON.stringify({ ...current, ...patch, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

function readChartData() {
  if (!fs.existsSync(CHART_DATA_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CHART_DATA_PATH, "utf8"));
  } catch (err) {
    return {};
  }
}

function writeChartData(data) {
  fs.writeFileSync(
    CHART_DATA_PATH,
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

function parseAgentJson(raw) {
  const trimmed = String(raw || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

function normalizeMarketingMetrics(raw) {
  return {
    target_leads: Math.round(Number(raw.target_leads)),
    cost_per_lead: Math.round(Number(raw.cost_per_lead))
  };
}

function normalizeFinanceMetrics(raw) {
  const projection = Array.isArray(raw.revenue_projection)
    ? raw.revenue_projection.map(value => Math.round(Number(value)))
    : [];
  if (projection.length !== 3 || projection.some(Number.isNaN)) {
    throw new Error("revenue_projection phải là mảng 3 số.");
  }
  return {
    revenue_projection: projection,
    bep: Math.round(Number(raw.bep))
  };
}

async function extractKeyMetrics(department, reportMarkdown) {
  const extractors = {
    marketing: {
      system: `Bạn là chuyên gia trích xuất dữ liệu KPI Marketing.
Chỉ trả về JSON thuần, không markdown, không giải thích.`,
      prompt: `Đọc báo cáo Marketing Leader dưới đây và trích xuất:
- target_leads: số leads mục tiêu (số nguyên)
- cost_per_lead: chi phí trung bình mỗi lead (VND, số nguyên)

Báo cáo:
---
${reportMarkdown}
---

Trả về ĐÚNG định dạng JSON:
{"target_leads": 80, "cost_per_lead": 250000}`,
      normalize: normalizeMarketingMetrics
    },
    finance: {
      system: `Bạn là chuyên gia trích xuất dữ liệu tài chính.
Chỉ trả về JSON thuần, không markdown, không giải thích.`,
      prompt: `Đọc báo cáo Finance Leader (CFO) dưới đây và trích xuất:
- revenue_projection: mảng 3 số dự phóng doanh thu theo năm (đơn vị: triệu VND)
- bep: điểm hòa vốn doanh thu (VND, số nguyên)

Báo cáo:
---
${reportMarkdown}
---

Trả về ĐÚNG định dạng JSON:
{"revenue_projection": [300, 500, 847], "bep": 847058824}`,
      normalize: normalizeFinanceMetrics
    }
  };

  const config = extractors[department];
  if (!config) throw new Error(`Không hỗ trợ trích xuất metrics cho: ${department}`);

  const raw = await callGemini(config.system, config.prompt, 0.1);
  const parsed = parseAgentJson(raw);
  return config.normalize(parsed);
}

async function saveDepartmentChartMetrics(department, reportMarkdown) {
  const metrics = await extractKeyMetrics(department, reportMarkdown);
  const chartData = readChartData();
  chartData[department] = metrics;
  writeChartData(chartData);
  console.log(`   📊 Đã cập nhật key-metrics ${department} → data-chart.json`);
}

// ==========================================
// ĐỊNH NGHĨA CÁC AGENT (PROMPTS & SYSTEM INSTRUCTIONS)
// ==========================================

const agents = {
  salesStaff: {
    system: `Bạn là chuyên viên nghiên cứu thị trường và thiết kế giải pháp (Sales Staff) tại công ty tư vấn chuyển đổi số "Digital SME" Việt Nam.
Công việc của bạn là phân tích sâu các nỗi đau chuyển đổi số của SME Việt Nam và lập kế hoạch tính năng chi tiết cho 3 gói cước dịch vụ chính để trình lên Trưởng phòng Sales.
Hãy thể hiện sự hiểu biết sâu sắc về doanh nghiệp Việt (ví dụ: thói quen quản lý bằng Excel/Zalo, ngân sách eo hẹp, ngại thay đổi quy trình).`,
    prompt: `Dựa trên bối cảnh:
${FULL_CONTEXT}

Nhiệm vụ của bạn:
1. Nghiên cứu & mô tả chi tiết 3 nỗi đau lớn nhất của SME Việt Nam khi tự chuyển đổi số.
2. Thiết kế chi tiết tính năng kỹ thuật và quy trình triển khai cho 3 phân khúc dịch vụ:
   - Gói Cơ Bản (Dành cho doanh nghiệp siêu nhỏ/hộ kinh doanh muốn số hóa bước đầu).
   - Gói Nâng Cao (Dành cho SME bắt đầu tăng trưởng, cần chuẩn hóa quy trình và tích hợp dữ liệu cơ bản).
   - Gói May Đo Riêng (Dành cho SME quy mô vừa, cần kiến trúc dữ liệu tùy biến sâu và tối ưu hóa hệ thống).
3. Đề xuất các giá trị cốt lõi (Value Proposition) cho mỗi gói.

Hãy viết báo cáo chi tiết dưới định dạng Markdown (.md) chuyên nghiệp, có bảng so sánh tính năng rõ ràng để trình cho Trưởng phòng Sales (Sales Leader) duyệt.`
  },

  salesLeader: {
    system: `Bạn là Giám đốc Kinh doanh B2B (Sales Leader) với 15 năm kinh nghiệm thực chiến trong mảng chuyển đổi số doanh nghiệp tại Việt Nam.
Bạn chịu trách nhiệm duyệt cuối, đóng gói sản phẩm và định phí dịch vụ. Bạn cực kỳ khắt khe về tính thực tế, tính khả thi của tính năng và ngân sách của SME Việt.`,
    prompt: (draftContent) => `Dựa trên báo cáo nháp của Sales Staff dưới đây:
---
${draftContent}
---

Nhiệm vụ của bạn làm Sales Leader:
1. Đọc và phản biện nghiêm khắc bản nháp trên: Chỉ ra điểm nào chưa thực tế với SME Việt (ví dụ: tính năng quá cao siêu, quy trình quá phức tạp).
2. Tiến hành đóng gói hoàn chỉnh 3 phân khúc dịch vụ:
   - Gói Cơ Bản (Basic)
   - Gói Nâng Cao (Advanced)
   - Gói May Đo Riêng (Custom)
3. Định phí cụ thể bằng tiền Việt Nam Đồng (VND) cho từng gói (Ví dụ: tính theo tháng, theo dự án, hoặc theo số lượng người dùng) sao cho phù hợp với ngân sách thực tế của từng phân khúc SME Việt Nam. Giải thích rõ vì sao định giá như vậy.
4. Cam kết chất lượng dịch vụ (SLA) và lộ trình bàn giao.

Hãy viết báo cáo chính thức hoàn chỉnh dưới dạng Markdown và lưu ý xuất nội dung sạch đẹp (không kèm lời dẫn cá nhân ngoài lề).`
  },

  marketingStaff: {
    system: `Bạn là Chuyên viên Lập kế hoạch Marketing (Marketing Staff) tại "Digital SME".
Bạn có thế mạnh về sáng tạo nội dung, lên kế hoạch truyền thông đa kênh B2B và viết kịch bản social media, tạo prompt AI sinh ảnh quảng cáo.`,
    prompt: (salesReport) => `Dựa trên báo cáo đóng gói dịch vụ chính thức từ Phòng Sales dưới đây:
---
${salesReport}
---

Nhiệm vụ của bạn:
1. Lên kế hoạch Content Marketing hàng tuần (7 ngày) chi tiết để tiếp cận chủ doanh nghiệp SME, xác định rõ thông điệp truyền thông cốt lõi của "Digital SME".
2. Viết kịch bản chi tiết cho 3 bài viết mạng xã hội (Facebook/LinkedIn) tương ứng với 3 gói cước dịch vụ của Sales. Kịch bản phải có Headline cuốn hút, nội dung đánh trúng nỗi đau và kêu gọi hành động (CTA) rõ ràng.
3. Tạo 3 prompts chi tiết (bằng tiếng Anh) dùng cho các công cụ sinh ảnh AI (như Midjourney, Stable Diffusion) để tạo ra các bức ảnh quảng cáo B2B hiện đại, chuyên nghiệp, phản ánh đúng tinh thần chuyển đổi số đẳng cấp.

Hãy viết báo cáo nháp dưới định dạng Markdown (.md) để nộp cho Trưởng phòng Marketing (CMO) duyệt.`
  },

  marketingLeader: {
    system: `Bạn là Giám đốc Marketing (Marketing Leader / CMO) với 15 năm kinh nghiệm quản lý thương hiệu B2B và kiểm soát chiến dịch truyền thông chuyển đổi số.
Bạn kiểm soát chặt chẽ các KPI hình ảnh, thông điệp truyền thông B2B phải chuyên nghiệp (tránh giật gân rẻ tiền, tập trung vào giá trị bền vững và lòng tin).`,
    prompt: (draftContent) => `Dựa trên bản kế hoạch nháp của Marketing Staff dưới đây:
---
${draftContent}
---

Nhiệm vụ của bạn làm CMO:
1. Phản biện và hiệu chỉnh bản nháp: Kiểm soát thông điệp truyền thông B2B xem đã đủ tin cậy, thực tế và đánh trúng tâm lý chủ doanh nghiệp chưa.
2. Tinh chỉnh các kịch bản social media sao cho chuyên nghiệp, sắc bén và thuyết phục hơn.
3. Rà soát, chuẩn hóa các Prompts sinh ảnh AI để đảm bảo chất lượng hình ảnh đầu ra (KPIs hình ảnh số: bố cục, màu sắc thương hiệu, tính chuyên nghiệp).
4. Thiết lập các KPIs đo lường hiệu quả chiến dịch Marketing này (ví dụ: lượt tiếp cận, tỷ lệ click, số leads thu về).
5. Cuối báo cáo, bắt buộc có mục "## KEY METRICS" nêu rõ:
   - Target Leads (số leads mục tiêu trong kỳ)
   - Cost Per Lead (chi phí VND/lead)

Hãy viết báo cáo Marketing chính thức hoàn chỉnh dưới dạng Markdown.`
  },

  financeStaff: {
    system: `Bạn là Chuyên viên Phân tích Tài chính (Finance Staff) tại "Digital SME".
Bạn có khả năng tính toán, lập bảng dự phóng doanh thu, phân tích chi phí vận hành (OPEX) chi tiết.`,
    prompt: (salesReport, marketingReport) => `Dựa trên Báo cáo Sales chính thức:
---
${salesReport}
---
Và Báo cáo Marketing chính thức:
---
${marketingReport}
---

Nhiệm vụ của bạn:
1. Lập dự phóng doanh thu trong vòng 3 năm tới. Hãy đưa ra giả định số lượng khách hàng mua các gói cước (Cơ bản, Nâng cao, May đo) theo từng năm một cách thực tế và tăng trưởng hợp lý.
2. Phân tích chi phí vận hành (OPEX) tối ưu cho hoạt động tư vấn chuyển đổi số này, bao gồm:
   - Chi phí SaaS/hạ tầng công nghệ.
   - Chi phí nhân sự (lương chuyên gia, tư vấn viên).
   - Chi phí hoa hồng Sales (commission % trên hợp đồng).
   - Chi phí Marketing chạy quảng cáo và truyền thông.
3. Tạo bảng cơ cấu chi phí và dòng tiền dự phóng 3 năm.

Hãy viết báo cáo nháp dưới định dạng Markdown (.md) có bảng biểu số liệu rõ ràng để nộp cho Trưởng phòng Tài chính (CFO) thẩm định.`
  },

  financeLeader: {
    system: `Bạn là Giám đốc Tài chính (Finance Leader / CFO) với 10 năm kinh nghiệm thẩm định dòng tiền dự án B2B và quản trị rủi ro tài chính doanh nghiệp.
Bạn chịu trách nhiệm thẩm định các giả định tài chính, tính toán điểm hòa vốn và ROI để đảm bảo an toàn tài chính tối đa cho doanh nghiệp.`,
    prompt: (draftContent) => `Dựa trên bản phân tích tài chính nháp của Finance Staff dưới đây:
---
${draftContent}
---

Nhiệm vụ của bạn làm CFO:
1. Thẩm định khắt khe dòng tiền dự phóng 3 năm của nhân viên (phê bình các giả định quá lạc quan, chỉ ra rủi ro dòng tiền âm hoặc thiếu vốn lưu động).
2. Tính toán cụ thể Điểm hòa vốn (Break-Even Point - BEP):
   - Doanh thu hòa vốn mỗi năm.
   - Số lượng hợp đồng tối thiểu của từng gói cước cần đạt để đạt điểm hòa vốn.
3. Tính toán tỷ suất sinh lời (ROI) dự kiến của dự án đầu tư hệ thống này sau 3 năm.
4. Đưa ra các khuyến nghị tài chính chiến lược để tối ưu hóa dòng tiền và dự phòng rủi ro.
5. Cuối báo cáo, bắt buộc có mục "## KEY METRICS" nêu rõ:
   - Dự phóng doanh thu 3 năm (triệu VND): Năm 1, Năm 2, Năm 3
   - BEP — Doanh thu hòa vốn (VND)

Hãy viết báo cáo tài chính chính thức hoàn chỉnh dưới dạng Markdown.`
  }
};

// ==========================================
// LUỒNG VẬN HÀNH TUẦN TỰ (SEQUENTIAL WORKFLOW)
// ==========================================

async function runWorkflow() {
  console.log("\n========================================================");
  console.log("🚀 KÍCH HOẠT HỆ THỐNG MULTI-AGENT (HIERARCHICAL WORKFLOW)");
  if (process.env.AGENT_MARKET_CONTEXT) {
    console.log("📌 Bối cảnh mới từ Admin:", process.env.AGENT_MARKET_CONTEXT.slice(0, 120) + "...");
  }
  console.log("========================================================\n");

  const startTime = Date.now();
  const agentsDir = path.join(__dirname, "agents");

  writeJobStatus({
    running: true,
    startedAt: new Date().toISOString(),
    completedAt: null,
    lastError: null,
    context: process.env.AGENT_MARKET_CONTEXT || null,
    mode: "local"
  });

  try {
    // Tạo thư mục agents nếu chưa tồn tại
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    // ----------------------------------------------------
    // PHÒNG 1: SALES
    // ----------------------------------------------------
    console.log("📂 [PHÒNG SALES] - BẮT ĐẦU HOẠT ĐỘNG");
    
    // Bước 1: Sales Staff chạy nháp
    console.log("👉 1/6: Sales Staff đang nghiên cứu thị trường & lập tính năng...");
    const draftSales = await callGemini(agents.salesStaff.system, agents.salesStaff.prompt, 0.7);
    fs.writeFileSync(path.join(agentsDir, "staff-sales.md"), draftSales, "utf8");
    console.log("   ✅ Đã xuất file: agents/staff-sales.md");

    // Bước 2: Sales Leader duyệt và ra báo cáo cuối
    console.log("👉 2/6: Sales Leader đang phản biện, đóng gói cước & định giá...");
    const reportSales = await callGemini(agents.salesLeader.system, agents.salesLeader.prompt(draftSales), 0.3);
    fs.writeFileSync(path.join(agentsDir, "leader-sales.md"), reportSales, "utf8");
    console.log("   ✅ Đã xuất file: agents/leader-sales.md");
    console.log("--------------------------------------------------------\n");

    // ----------------------------------------------------
    // PHÒNG 2: MARKETING
    // ----------------------------------------------------
    console.log("📂 [PHÒNG MARKETING] - BẮT ĐẦU HOẠT ĐỘNG");

    // Bước 3: Marketing Staff chạy nháp
    console.log("👉 3/6: Marketing Staff đang lập Content Plan & Prompts...");
    const draftMarketing = await callGemini(agents.marketingStaff.system, agents.marketingStaff.prompt(reportSales), 0.7);
    fs.writeFileSync(path.join(agentsDir, "staff-marketing.md"), draftMarketing, "utf8");
    console.log("   ✅ Đã xuất file: agents/staff-marketing.md");

    // Bước 4: Marketing Leader duyệt và ra báo cáo cuối
    console.log("👉 4/6: Marketing Leader (CMO) đang duyệt thông điệp, KPIs & tinh chỉnh...");
    const reportMarketing = await callGemini(agents.marketingLeader.system, agents.marketingLeader.prompt(draftMarketing), 0.3);
    fs.writeFileSync(path.join(agentsDir, "leader-marketing.md"), reportMarketing, "utf8");
    console.log("   ✅ Đã xuất file: agents/leader-marketing.md");
    console.log("   📊 Marketing Leader — trích xuất key-metrics...");
    await saveDepartmentChartMetrics("marketing", reportMarketing);
    console.log("--------------------------------------------------------\n");

    // ----------------------------------------------------
    // PHÒNG 3: FINANCE (TAÌ CHÍNH)
    // ----------------------------------------------------
    console.log("📂 [PHÒNG FINANCE] - BẮT ĐẦU HOẠT ĐỘNG");

    // Bước 5: Finance Staff chạy nháp
    console.log("👉 5/6: Finance Staff đang dự phóng doanh thu & phân tích OPEX...");
    const draftFinance = await callGemini(agents.financeStaff.system, agents.financeStaff.prompt(reportSales, reportMarketing), 0.6);
    fs.writeFileSync(path.join(agentsDir, "staff-finance.md"), draftFinance, "utf8");
    console.log("   ✅ Đã xuất file: agents/staff-finance.md");

    // Bước 6: Finance Leader duyệt và ra báo cáo cuối
    console.log("👉 6/6: Finance Leader (CFO) đang thẩm định dòng tiền, tính BEP & ROI...");
    const reportFinance = await callGemini(agents.financeLeader.system, agents.financeLeader.prompt(draftFinance), 0.2);
    fs.writeFileSync(path.join(agentsDir, "leader-finance.md"), reportFinance, "utf8");
    console.log("   ✅ Đã xuất file: agents/leader-finance.md");
    console.log("   📊 Finance Leader — trích xuất key-metrics...");
    await saveDepartmentChartMetrics("finance", reportFinance);

    fs.writeFileSync(path.join(__dirname, "report-sales.md"), reportSales, "utf8");
    fs.writeFileSync(path.join(__dirname, "report-marketing.md"), reportMarketing, "utf8");
    fs.writeFileSync(path.join(__dirname, "report-finance.md"), reportFinance, "utf8");
    console.log("   ✅ Đã xuất file: report-sales.md, report-marketing.md, report-finance.md");
    console.log("   ✅ Đã cập nhật: data-chart.json");
    console.log("--------------------------------------------------------\n");

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("========================================================");
    console.log(`🎉 HỆ THỐNG ĐÃ HOÀN THÀNH TOÀN BỘ WORKFLOW TRONG ${duration}s!`);
    console.log("Các báo cáo chính thức hiện đã có sẵn tại thư mục agents:");
    console.log(" 📝 agents/leader-sales.md");
    console.log(" 📝 agents/leader-marketing.md");
    console.log(" 📝 agents/leader-finance.md");
    console.log("========================================================\n");

    writeJobStatus({
      running: false,
      completedAt: new Date().toISOString(),
      lastError: null
    });

  } catch (error) {
    console.error("\n❌ LỖI VẬN HÀNH HỆ THỐNG AGENTS:", error.message);
    writeJobStatus({
      running: false,
      completedAt: new Date().toISOString(),
      lastError: error.message
    });
    process.exit(1);
  }
}

if (require.main === module) {
  runWorkflow();
}

module.exports = { runWorkflow, extractKeyMetrics, saveDepartmentChartMetrics };
