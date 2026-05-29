# BÁO CÁO PHÂN TÍCH TÀI CHÍNH & DỰ PHÓNG DÒNG TIỀN (NHÁP)
**Người lập:** Finance_Staff
**Bộ phận:** Phòng Tài chính - Digital SME Việt Nam
**Ngày lập:** 30/05/2026

---

## 1. Giả định kinh doanh & Dự phóng Doanh thu 3 năm

Dựa trên biểu phí dịch vụ đã được Phòng Sales phê duyệt tại `report-sales.md` và lượng Leads dự kiến thu về từ Phòng Marketing tại `report-marketing.md`, chúng tôi xây dựng mô hình dự phóng doanh số bán hàng trong 3 năm đầu như sau:

### Các Giả định về Doanh số (Số lượng hợp đồng ký kết):
*   **Năm 1:**
    - Gói S1 (Cơ bản): 40 hợp đồng (Trung bình ~3.3 hợp đồng/tháng).
    - Gói S2 (Nâng cao): 15 hợp đồng (Trung bình ~1.2 hợp đồng/tháng).
    - Gói S3 (May đo): 3 hợp đồng (Dự án lớn).
*   **Năm 2 (Tăng trưởng 50%):**
    - Gói S1 (Cơ bản): 60 hợp đồng.
    - Gói S2 (Nâng cao): 25 hợp đồng.
    - Gói S3 (May đo): 5 hợp đồng.
*   **Năm 3 (Tăng trưởng ổn định):**
    - Gói S1 (Cơ bản): 80 hợp đồng.
    - Gói S2 (Nâng cao): 35 hợp đồng.
    - Gói S3 (May đo): 8 hợp đồng.

### Dự tính Doanh thu (Đơn vị tính: triệu VNĐ):
- Doanh thu Gói S1 = Số lượng hợp đồng * 7.5 triệu VNĐ.
- Doanh thu Gói S2 = Số lượng hợp đồng * 35.0 triệu VNĐ.
- Doanh thu Gói S3 = Số lượng hợp đồng * 90.0 triệu VNĐ (giả định mức giá tối thiểu).

| Kế hoạch Doanh thu | Năm 1 | Năm 2 | Năm 3 |
| :--- | :--- | :--- | :--- |
| **Gói S1 (Cơ bản)** | 300 | 450 | 600 |
| **Gói S2 (Nâng cao)**| 525 | 875 | 1,225 |
| **Gói S3 (May đo)**  | 270 | 450 | 720 |
| **TỔNG DOANH THU**   | **1,095** | **1,775** | **2,545** |

---

## 2. Dự báo Chi phí Vận hành (OPEX) tối ưu

Để triển khai được các gói dịch vụ trên, chúng tôi phân tích các khoản chi phí vận hành thường niên như sau:

### Cơ cấu Chi phí:
1.  **Chi phí Nhân sự trực tiếp (Expert/Consultant):**
    - Đội ngũ chuyên gia setup luồng tự động và triển khai dự án cho khách hàng.
    - Năm 1: 1 Leader (kiêm tư vấn chính) + 2 nhân viên kỹ thuật. Tổng quỹ lương: 480 triệu VNĐ/năm.
    - Năm 2 & 3: Tăng nhân sự theo lượng dự án. Năm 2: 720 triệu VNĐ/năm. Năm 3: 960 triệu VNĐ/năm.
2.  **Chi phí Hoa hồng Sales (Commission):**
    - Áp dụng tỷ lệ hoa hồng **10%** trên giá trị mỗi hợp đồng ký mới để thúc đẩy đội ngũ kinh doanh.
3.  **Chi phí Marketing (MKT Spend):**
    - Dựa trên kế hoạch của Marketing Leader, ngân sách chạy quảng cáo quảng bá dịch vụ.
    - Năm 1: 15 triệu VNĐ/tháng (180 triệu VNĐ/năm).
    - Năm 2: 25 triệu VNĐ/tháng (300 triệu VNĐ/năm).
    - Năm 3: 35 triệu VNĐ/tháng (420 triệu VNĐ/năm).
4.  **Chi phí SaaS & Văn phòng, Quản lý:**
    - Sử dụng các công cụ Make, Notion, các cổng API, chi phí văn phòng chia sẻ.
    - Năm 1: 60 triệu VNĐ/năm.
    - Năm 2: 90 triệu VNĐ/năm.
    - Năm 3: 120 triệu VNĐ/năm.

### Bảng Cơ cấu Chi phí (Đơn vị tính: triệu VNĐ):

| Loại chi phí | Năm 1 | Năm 2 | Năm 3 |
| :--- | :--- | :--- | :--- |
| Chi phí nhân sự | 480 | 720 | 960 |
| Hoa hồng Sales (10%) | 109.5 | 177.5 | 254.5 |
| Chi phí Marketing | 180 | 300 | 420 |
| Chi phí SaaS & Vận hành | 60 | 90 | 120 |
| **TỔNG CHI PHÍ OPEX** | **829.5** | **1,287.5** | **1,754.5** |

---

## 3. Dự phóng Dòng tiền & Lợi nhuận trước thuế

| Chỉ số (triệu VNĐ) | Năm 1 | Năm 2 | Năm 3 |
| :--- | :--- | :--- | :--- |
| **Tổng doanh thu** | 1,095 | 1,775 | 2,545 |
| **Tổng chi phí OPEX**| 829.5 | 1,287.5 | 1,754.5 |
| **Lợi nhuận trước thuế**| **265.5** | **487.5** | **790.5** |
| **Biên lợi nhuận ròng** | **24.2%** | **27.5%** | **31.1%** |

Kính trình Trưởng phòng Tài chính (CFO) xem xét, đánh giá tính khả thi và thẩm định các chỉ số BEP và ROI cụ thể của dự án đầu tư này.
