# BÁO CÁO NGHIÊN CỨU THỊ TRƯỜNG & PHÁT TRIỂN GÓI DỊCH VỤ (NHÁP)
**Người lập:** Sales_Staff
**Bộ phận:** Phòng Sales - Digital SME Việt Nam
**Ngày lập:** 30/05/2026

---

## 1. Phân tích 3 nỗi đau lớn nhất của SME Việt Nam khi chuyển đổi số

Qua khảo sát thực tế các doanh nghiệp vừa và nhỏ (SME) tại Việt Nam, chúng tôi nhận thấy 3 rào cản/nỗi đau cốt lõi khiến họ thất bại khi tự thực hiện chuyển đổi số:

### Nỗi đau 1: "Silo dữ liệu" - Dữ liệu rời rạc và cát cứ bộ phận
- **Hiện trạng:** Nhân viên kinh doanh quản lý leads bằng Excel cá nhân hoặc group Zalo chat. Kế toán dùng phần mềm MISA riêng. Marketing chạy quảng cáo Facebook xuất file CSV riêng.
- **Hệ quả:** Dữ liệu không đồng bộ, ban lãnh đạo không có một "nguồn sự thật duy nhất" (Single Source of Truth). Báo cáo doanh thu và chi phí luôn lệch nhau, việc ra quyết định bị chậm trễ và mang tính cảm tính.

### Nỗi đau 2: Lãng phí ngân sách vào các phần mềm "may sẵn"
- **Hiện trạng:** Doanh nghiệp thường vội vã mua các phần mềm CRM, ERP lớn (như Salesforce, SAP hoặc các giải pháp Việt Nam đóng gói sẵn) theo trào lưu mà không đánh giá đúng năng lực vận hành của nhân sự.
- **Hệ quả:** Tỷ lệ bỏ cuộc sau 3-6 tháng lên tới 70% vì hệ thống quá phức tạp, nhân viên ngại nhập liệu, dẫn đến lãng phí hàng trăm triệu đồng tiền bản quyền nhưng hiệu quả thu về gần như bằng không.

### Nỗi đau 3: Thiếu hụt năng lực thiết kế kiến trúc hệ thống gốc
- **Hiện trạng:** Các SME không có vị trí CTO hay Chuyên viên Kiến trúc Dữ liệu để quy hoạch luồng thông tin ngay từ đầu.
- **Hệ quả:** Khi quy mô doanh nghiệp tăng lên, các phần mềm rời rạc không thể kết nối hoặc tích hợp với nhau qua API. Hệ thống trở thành một đống chắp vá, chi phí nâng cấp và tích hợp sau này tăng phi mã.

---

## 2. Đề xuất tính năng chi tiết cho 3 phân khúc dịch vụ của "Digital SME"

Để giải quyết triệt để các nỗi đau trên, chúng tôi đề xuất 3 gói dịch vụ tư vấn kiến trúc hệ thống và chuyển đổi số thực chiến:

### Gói 1: Gói Cơ Bản (Số hóa nền tảng)
*   **Đối tượng:** Doanh nghiệp siêu nhỏ (Micro-SME), hộ kinh doanh cá thể hoặc doanh nghiệp mới thành lập (< 10 nhân sự).
*   **Mục tiêu:** Thoát khỏi Excel thủ công, đưa dữ liệu lên đám mây và đồng bộ quy trình liên hệ cơ bản.
*   **Tính năng chi tiết:**
    *   Khảo sát và chuẩn hóa quy trình tiếp nhận khách hàng (Leads) thành sơ đồ luồng chuẩn.
    *   Thiết lập cơ sở dữ liệu CRM đơn giản trên Notion hoặc Google Sheets Cloud cho phép phân quyền nhân sự.
    *   Tự động hóa thông báo có khách hàng mới từ Website/Fanpage về nhóm chat Telegram/Zalo thông qua Make hoặc Zapier (tối đa 2 luồng tự động hóa).
    *   Đào tạo 1 buổi hướng dẫn nhân viên cách nhập liệu và duy trì tính sạch của dữ liệu.

### Gói 2: Gói Nâng Cao (Vận hành liên thông)
*   **Đối tượng:** Doanh nghiệp SME đang tăng trưởng nóng (10 - 50 nhân sự), có nhiều bộ phận (Sales, Marketing, CSKH).
*   **Mục tiêu:** Kết nối các silo dữ liệu, tự động hóa luồng vận hành liên phòng ban.
*   **Tính năng chi tiết:**
    *   Xây dựng Kiến trúc dữ liệu tích hợp (Integrated Data Schema) liên kết Sales CRM $\leftrightarrow$ Marketing Ads $\leftrightarrow$ Chăm sóc khách hàng.
    *   Tích hợp hệ thống đặt lịch tự động (như Calendly) đồng bộ trực tiếp về Notion/CRM và gửi SMS/Zalo ZNS nhắc lịch cho khách hàng.
    *   Xây dựng Dashboard theo dõi chỉ số sức khỏe doanh nghiệp (Doanh thu thực tế, chi phí quảng cáo, giá trị vòng đời khách hàng LTV) cập nhật thời gian thực (Real-time).
    *   Đào tạo chuyển giao công nghệ cho đội ngũ nội bộ trong 3 buổi.

### Gói 3: Gói May Đo Riêng (Kiến trúc & Tự động hóa toàn diện)
*   **Đối tượng:** Doanh nghiệp SME quy mô trung bình (50 - 200 nhân sự) hoặc các doanh nghiệp có quy trình vận hành đặc thù (Sản xuất, chuỗi bán lẻ, logistics).
*   **Mục tiêu:** Thiết kế bản thiết kế (Blueprint) kiến trúc hệ thống độc quyền, tích hợp API tùy biến sâu và tối ưu hóa chi phí công nghệ dài hạn.
*   **Tính năng chi tiết:**
    *   Đánh giá toàn diện kiến trúc IT hiện tại và lập bản đồ kiến trúc mục tiêu (Target Enterprise Architecture).
    *   Thiết kế và triển khai cổng kết nối API tùy biến giữa các phần mềm đặc thù của doanh nghiệp (như phần mềm sản xuất ERP, Kế toán MISA, CRM chuyên biệt).
    *   Xây dựng kho dữ liệu tập trung (Data Warehouse đơn giản trên BigQuery/PostgreSQL) và hệ thống báo cáo BI (PowerBI/Looker Studio) đa chiều.
    *   Đồng hành giám sát triển khai và bảo hành kiến trúc hệ thống trong vòng 6 tháng.

---

## 3. Bảng so sánh sơ bộ 3 phân khúc dịch vụ

| Tiêu chí | Gói Cơ Bản | Gói Nâng Cao | Gói May Đo Riêng |
| :--- | :--- | :--- | :--- |
| **Quy mô phù hợp** | < 10 nhân sự | 10 - 50 nhân sự | 50 - 200 nhân sự |
| **Công nghệ lõi** | Notion / Google Sheet / Zapier | CRM chuyên dụng / Make / Calendly | Custom API / PostgreSQL / BI Tools |
| **Luồng tự động hóa** | Tối đa 2 luồng | Không giới hạn trong CRM | Tích hợp sâu đa hệ thống |
| **Thời gian triển khai**| 2 tuần | 4 - 6 tuần | 8 - 12 tuần |
| **Hỗ trợ sau bàn giao**| 1 tháng qua email | 3 tháng qua Group hỗ trợ | 6 tháng đồng hành, cam kết SLA |
