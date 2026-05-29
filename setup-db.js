/**
 * Tạo MỚI một Notion Database — không sửa/xóa database cũ.
 * API databases.create luôn tạo bảng mới; database Calendly/n8n hiện có giữ nguyên.
 */
const { Client } = require("@notionhq/client");

function normalizeNotionId(rawId) {
  const id = String(rawId || "").replace(/-/g, "").trim();
  if (id.length !== 32) return String(rawId || "").trim();
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  const pageId = process.env.NOTION_PAGE_ID;
  const dbTitle = process.env.NOTION_DB_TITLE || "Quản lý Leads (CRM)";

  if (!apiKey) {
    console.error("Thiếu NOTION_API_KEY. Thiết lập biến môi trường trước khi chạy.");
    process.exit(1);
  }

  if (!pageId) {
    console.error("Thiếu NOTION_PAGE_ID. Dán ID trang Notion nơi bạn muốn đặt bảng MỚI.");
    console.error("Gợi ý: tạo một trang con trống (vd. 'CRM Leads') để tách khỏi database Calendly cũ.");
    process.exit(1);
  }

  const notion = new Client({
    auth: apiKey,
    notionVersion: "2025-09-03"
  });

  console.log("=== Tạo Notion Database MỚI (không ghi đè bảng cũ) ===");
  console.log("Tên bảng:", dbTitle);
  console.log("Trang cha (Page ID):", normalizeNotionId(pageId));
  console.log("");

  const database = await notion.databases.create({
    parent: {
      type: "page_id",
      page_id: normalizeNotionId(pageId)
    },
    title: [
      {
        type: "text",
        text: { content: dbTitle }
      }
    ],
    initial_data_source: {
      properties: {
        "Họ và tên": {
          title: {}
        },
        Email: {
          email: {}
        },
        "Số điện thoại": {
          phone_number: {}
        },
        "Trạng thái chăm sóc": {
          select: {
            options: [
              { name: "Mới", color: "blue" },
              { name: "Đang tư vấn", color: "yellow" },
              { name: "Đã chốt", color: "green" }
            ]
          }
        },
        "Ngày đăng ký": {
          date: {}
        },
        "Ghi chú": {
          rich_text: {}
        }
      }
    }
  });

  const dataSourceId = database.data_sources?.[0]?.id || "(không có)";

  console.log("Tạo bảng mới thành công!\n");
  console.log("URL:", database.url);
  console.log("Database ID (bảng MỚI):", database.id);
  console.log("Data Source ID:", dataSourceId);
  console.log("\nCác cột đã tạo:");
  console.log("  1. Họ và tên (Title)");
  console.log("  2. Email (Email)");
  console.log("  3. Số điện thoại (Phone)");
  console.log("  4. Trạng thái chăm sóc (Select: Mới, Đang tư vấn, Đã chốt)");
  console.log("  5. Ngày đăng ký (Date)");
  console.log("  6. Ghi chú (Rich Text)");
  console.log("\n--- Lưu ý quan trọng ---");
  console.log("- Database Calendly/n8n CŨ vẫn giữ nguyên, script này không xóa hay sửa bảng cũ.");
  console.log("- Chưa cần đổi NOTION_DATABASE_ID trên Render nếu bạn vẫn muốn Admin đọc bảng cũ.");
  console.log("- Khi sẵn sàng chuyển sang bảng mới, đổi NOTION_DATABASE_ID trên Render = Database ID ở trên.");
  console.log("- Hoặc lưu ID bảng mới riêng để dùng sau (copy Database ID ở trên).");
}

main().catch(err => {
  console.error("\nLỗi khi tạo database:", err.message);
  if (err.code === "object_not_found") {
    console.error("Kiểm tra NOTION_PAGE_ID và quyền Integration (Can edit) trên trang cha.");
  }
  process.exit(1);
});
