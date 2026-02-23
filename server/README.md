# KOC Revenue Management System - Backend

Backend API cho hệ thống quản lý doanh thu YouTube & KOC.

## 🚀 Tech Stack

- **Node.js** với **TypeScript**
- **Express.js** - Web framework
- **Prisma** - ORM cho PostgreSQL
- **PostgreSQL** - Database
- **JWT** - Authentication
- **Social Blade API** - Lấy thống kê kênh YouTube
- **i18next** - Đa ngôn ngữ
- **Winston** - Logging

## 📋 Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Social Blade API credentials (https://socialblade.com/developers)

## 🛠️ Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Cập nhật các biến trong `.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/koc?schema=public"

# JWT
JWT_SECRET=your-secret-key-change-me

# Social Blade API
SOCIAL_BLADE_CLIENT_ID=your-client-id      # Lấy từ Social Blade
SOCIAL_BLADE_TOKEN=your-client-secret       # Lấy từ Social Blade
```

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed initial data (Admin user + sample data)
npm run seed
```

**Default Admin:**
- Email: `admin@koc.vn`
- Password: `Admin@123456`

### 4. Start server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

Server chạy tại: `http://localhost:3001`

## 📁 Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middlewares/    # Express middlewares
├── routes/         # API routes
├── services/       # Business logic
├── types/          # TypeScript types
├── locales/        # i18n translations
└── prisma/         # Database schema & seed
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký (Admin only)
- `GET /api/auth/profile` - Lấy thông tin user

### KOC Management
- `GET /api/kocs` - Danh sách KOC
- `GET /api/kocs/active` - KOC đang hoạt động
- `POST /api/kocs` - Tạo KOC mới
- `PUT /api/kocs/:id` - Cập nhật KOC
- `DELETE /api/kocs/:id` - Xóa KOC

### Revenue Cycles
- `GET /api/cycles` - Danh sách chu kỳ
- `POST /api/cycles` - Tạo chu kỳ mới
- `PUT /api/cycles/:id` - Cập nhật chu kỳ
- `POST /api/cycles/:id/lock` - Khóa chu kỳ
- `POST /api/cycles/:id/complete` - Hoàn thành chu kỳ

### Revenue Records
- `GET /api/revenue/cycle/:cycleId` - Bản ghi theo chu kỳ
- `POST /api/revenue` - Tạo bản ghi
- `PUT /api/revenue/:id` - Cập nhật bản ghi
- `DELETE /api/revenue/:id` - Xóa bản ghi
- `POST /api/revenue/:id/approve` - Duyệt bản ghi

### Dashboard & Stats
- `GET /api/dashboard/overview` - Tổng quan
- `GET /api/dashboard/trend` - Xu hướng doanh thu

### Audit Logs
- `GET /api/audit-logs` - Lịch sử thay đổi

## 🔗 Social Blade API

Hệ thống sử dụng Social Blade API để lấy thống kê kênh YouTube (views, subscribers).

**API Documentation:** https://socialblade.com/developers/docs#youtube

**Ví dụ request:**
```bash
curl 'https://matrix.sbapis.com/b/youtube/statistics?query=CHANNEL_ID' \
  -H 'clientid: YOUR_CLIENT_ID' \
  -H 'token: YOUR_TOKEN'
```

## 🗄️ Database Schema

### Models
- **User** - Admin/Accountant
- **KOC** - KOL/Creator
- **RevenueCycle** - Chu kỳ đối soát (monthly)
- **RevenueRecord** - Bản ghi doanh thu
- **ChannelStat** - Thống kê kênh YouTube
- **AuditLog** - Lịch sử thao tác

## 📝 Scripts

```bash
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
npm run seed             # Seed database
```

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRES_IN` | JWT expiration | `7d` |
| `SOCIAL_BLADE_CLIENT_ID` | Social Blade client ID | - |
| `SOCIAL_BLADE_TOKEN` | Social Blade token | - |
| `CORS_ORIGIN` | CORS allowed origin | `http://localhost:5173` |

## 🔐 Authentication

Sử dụng JWT Bearer token:

```bash
Authorization: Bearer <token>
```

## 📊 Logging

Logs được lưu tại:
- Console (development)
- `logs/error.log` - Error logs
- `logs/combined.log` - All logs

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT
