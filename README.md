# AH-Backend: Hostel Management System API

<p align="center">
  <strong>A modern, scalable NestJS backend for comprehensive hostel booking, management, and payment processing</strong>
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## Overview

**AH-Backend** is a production-ready NestJS backend service powering a hostel booking and management platform. It handles complex operations including multi-method payments (Paystack integration), real-time booking management, user authentication, hostel administration, and comprehensive review/feedback systems.

**Key Capabilities:**

- 🏨 Hostel listing and discovery with geolocation support
- 🛏️ Room inventory and booking management
- 💳 Integrated payment processing via Paystack (GHS 38 access, GHS 70 booking fees)
- 🔐 JWT-based authentication with role-based access control (RBAC)
- 📧 Transactional email notifications via Resend
- 🖼️ Image management with Cloudinary CDN
- 📊 Admin dashboards and analytics
- ⭐ User reviews and moderation workflows
- 🔍 Error tracking with Sentry
- ✅ Production-ready with Docker, Kubernetes, and CI/CD

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ & npm 9+
- PostgreSQL 12+ (via Supabase)
- Docker & Docker Compose (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/ah-backend.git
cd ah-backend

# Install dependencies
npm install

# Configure environment (see .env.example)
cp .env.example .env
# Edit .env with your values

# Start development server
npm run start:dev
```

Server runs on `http://localhost:1000` by default.

### Environment Configuration

Create `.env` file with required variables:

```bash
# Database
SUPABASE_DB_URL=postgresql://user:pass@host:port/database
DB_SYNC=false  # TypeORM auto-sync disabled in production

# Authentication
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRY=24h

# Payment Integration
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_ACCESS_PRICE=3800  # GHS 38 in pesewas
PAYSTACK_BOOKING_FEE=7000   # GHS 70 in pesewas

# Storage & Email
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@example.com

# Monitoring
SENTRY_DSN=your_sentry_dsn

# Server
PORT=1000
NODE_ENV=development
```

---

## 📚 Documentation

This project includes comprehensive professional documentation. **Start here:**

| Document                                                         | Purpose                                    | Best For                          |
| ---------------------------------------------------------------- | ------------------------------------------ | --------------------------------- |
| [START_HERE.md](START_HERE.md)                                   | **Quick navigation & onboarding**          | New team members, quick reference |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)           | System design, ERD, module architecture    | Understanding the system design   |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md)                         | Cheat sheet, commands, endpoints           | Daily development work            |
| [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md)             | 50+ cURL examples, workflow examples       | Building frontend or integrations |
| [DEPLOYMENT_OPERATIONS_GUIDE.md](DEPLOYMENT_OPERATIONS_GUIDE.md) | Docker, Kubernetes, CI/CD, troubleshooting | DevOps & deployment teams         |
| [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)                 | Master navigation guide                    | Finding specific information      |

**👉 New to the project?** Start with [START_HERE.md](START_HERE.md)

---

## ✨ Core Features

### Authentication & Authorization

- JWT-based authentication (24-hour expiry)
- Role-based access control (RBAC): Student, Hostel Admin, Super Admin
- Email verification with secure tokens
- Password reset functionality
- OAuth-ready architecture (Supabase integration)

### Hostel Management

- Complete CRUD operations for hostels, rooms, and amenities
- Multi-method payment configuration (Bank, Mobile Money)
- Geographic location data (PostGIS Point support)
- Occupancy tracking and room type management
- Preview/trial access system (GHS 38)

### Booking System

- Complex booking state machine (pending → confirmed → checked_in → checked_out → cancelled → no_show)
- Automated confirmation reminders
- Check-in/check-out workflows
- Payment status integration
- Booking scheduler for automated tasks

### Payment Processing

- **Paystack Integration:**
  - Transaction initialization and verification
  - Webhook handling for payment confirmation
  - Multiple payment methods support
  - Transaction tracking and reconciliation
  - Booking and access fees configuration

### Reviews & Feedback

- User review submission with moderation (pending → approved/rejected/flagged)
- Detailed rating breakdown (cleanliness, comfort, service, location, amenities)
- Public feedback visibility with admin approval
- Review scheduling and notifications

### Admin Dashboard

- Real-time analytics and statistics
- Revenue reports and payment tracking
- Booking occupancy metrics
- User management and access control
- System health monitoring

---

## 🛠️ Tech Stack

| Layer                 | Technology               | Version |
| --------------------- | ------------------------ | ------- |
| **Framework**         | NestJS                   | 11.1.5  |
| **Language**          | TypeScript               | 5.7.3   |
| **Database**          | PostgreSQL (Supabase)    | 12+     |
| **ORM**               | TypeORM                  | 0.3.25  |
| **Authentication**    | Passport.js, JWT, bcrypt | -       |
| **Payment**           | Paystack API             | -       |
| **Storage**           | Cloudinary               | -       |
| **Email**             | Resend                   | -       |
| **Monitoring**        | Sentry                   | -       |
| **API Rate Limiting** | @nestjs/throttler        | -       |
| **Security**          | Helmet, bcrypt           | -       |
| **Testing**           | Jest                     | -       |
| **Containerization**  | Docker, Docker Compose   | -       |
| **Orchestration**     | Kubernetes               | -       |
| **CI/CD**             | GitHub Actions           | -       |

---

## 📁 Project Structure

```
src/
├── auth/                 # JWT authentication, strategies, guards, decorators
├── hostels/              # Hostel CRUD and management
├── rooms/                # Room and room-type management
├── bookings/             # Booking lifecycle and scheduling
├── payment/              # Payment entity and workflows
├── paystack/             # Paystack API integration
├── review/               # Review submission and moderation
├── feedback/             # User feedback and public feedback
├── admin/                # Admin dashboard and controls
├── mail/                 # Transactional email templates
├── cloudinary/           # Image upload and management
├── profile/              # User profile management
├── entities/             # TypeORM database entities (15 total)
├── config/               # Database and application configuration
└── main.ts               # Application bootstrap (Port 1000)
```

**Database Entities (15 total):**
User, Hostel, Room, RoomType, Booking, Payment, Review, School, Deposit, Verification, AdminVerification, Access, PreviewUsage, Feedback, PublicFeedback

---

## 🔌 API Endpoints

**50+ RESTful endpoints across:**

- Authentication (register, login, email verification, password reset)
- Hostels (list, create, update, delete, search with geolocation)
- Rooms (inventory management, type management)
- Bookings (create, confirm, check-in/out, cancel, list)
- Payments (initialize, verify, webhook handling)
- Reviews (submit, list, moderate, get statistics)
- Admin (dashboard, analytics, user management)
- And more...

**Full API documentation with 50+ cURL examples:** See [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md)

---

## 💻 Development

### Available Commands

```bash
# Start development server with auto-reload
npm run start:dev

# Build production bundle
npm run build

# Start production server
npm run start:prod

# Run unit tests
npm run test

# Run end-to-end tests
npm run test:e2e

# Generate test coverage report
npm run test:cov

# Lint code with ESLint
npm run lint

# Format code with Prettier
npm run format
```

### Database Migrations

TypeORM is configured with `synchronize: false` (production-safe). Entities auto-load from `src/entities/`.

```bash
# Generate migration
npm run typeorm migration:generate -- -n MigrationName

# Run migrations
npm run typeorm migration:run

# Revert last migration
npm run typeorm migration:revert
```

---

## 🚢 Deployment

### Docker

```bash
# Build image
docker build -t ah-backend .

# Run with docker-compose
docker-compose up -d
```

Includes services: API, PostgreSQL, Redis, nginx

### Kubernetes

```bash
# Deploy to cluster
kubectl apply -f k8s/

# Monitor deployment
kubectl get pods -l app=ah-backend
```

Includes: Deployment (3 replicas), Service, ConfigMap, HPA (2-10 replicas based on CPU)

### CI/CD Pipeline

GitHub Actions workflow:

1. **Build** - Compile TypeScript
2. **Test** - Run unit and e2e tests
3. **Lint** - Check code quality
4. **Push** - Build and push Docker image
5. **Deploy** - Deploy to staging/production

**Full deployment guide:** See [DEPLOYMENT_OPERATIONS_GUIDE.md](DEPLOYMENT_OPERATIONS_GUIDE.md)

---

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following NestJS best practices
3. Run tests: `npm run test`
4. Commit with conventional commits: `git commit -m "feat: add new feature"`
5. Push and create Pull Request

---

## 📊 Monitoring & Observability

- **Error Tracking:** Sentry integration for real-time error monitoring
- **Performance:** Built-in NestJS performance metrics
- **Logging:** Structured logging with request tracking
- **Health Checks:** `/health` endpoint for readiness/liveness probes

---

## 📖 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Guide](https://typeorm.io)
- [Paystack API Reference](https://paystack.com/docs/api)
- [Supabase Documentation](https://supabase.com/docs)

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 📞 Support & Questions

Refer to project documentation in order:

1. [START_HERE.md](START_HERE.md) - Quick navigation
2. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Common tasks
3. [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - System design
4. [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Find specific topics

**Last Updated:** January 2026  
**Status:** Production Ready ✅
