# AH-Backend: Technical Architecture & Comprehensive Documentation

**Version:** 0.0.1  
**Last Updated:** January 27, 2026  
**Project Type:** NestJS Backend - Hostel Management Platform  
**Language:** TypeScript  
**Database:** PostgreSQL (via Supabase)  
**Runtime:** Node.js

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [Architecture Overview](#architecture-overview)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Database Schema & Entities](#database-schema--entities)
6. [Core Modules & Services](#core-modules--services)
7. [API Architecture](#api-architecture)
8. [Authentication & Authorization](#authentication--authorization)
9. [Payment Integration](#payment-integration)
10. [Third-Party Integrations](#third-party-integrations)
11. [Environment Configuration](#environment-configuration)
12. [Development & Deployment](#development--deployment)
13. [Error Handling & Monitoring](#error-handling--monitoring)
14. [Security Considerations](#security-considerations)

---

## Executive Overview

**AH-Backend** is an enterprise-grade hostel management platform built with **NestJS**, designed to handle multi-tenant hostel operations, student bookings, payment processing, and administrative functions. The system provides comprehensive features for hostel owners, administrators, and students with role-based access control, payment integration via **Paystack**, image hosting via **Cloudinary**, and email services via **Resend**.

### Key Capabilities

- **Multi-Role User Management**: Students, Hostel Admins, Super Admins
- **Booking Management**: Semester, monthly, and weekly booking types
- **Payment Processing**: Integrated Paystack payment gateway
- **Room & Hostel Management**: Dynamic room allocation and status tracking
- **Review & Feedback System**: Student reviews with admin moderation
- **Email Notifications**: Transactional emails via Resend
- **Media Management**: Image upload and storage via Cloudinary
- **Administrative Dashboard**: Comprehensive admin controls and analytics
- **Rate Limiting & Security**: Helmet middleware and request throttling

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Client Applications                        │
│                 (Web, Mobile, Admin Portal)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS/REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Backend Server                         │
│                  (Port: 1000 - Configurable)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         Authentication & Authorization Layer             │   │
│  │  (JWT, Passport, Role-Based Access Control)             │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Core Application Modules                      │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐      │   │
│  │  │ Auth   │ │ Hostels│ │ Rooms  │ │ Bookings    │      │   │
│  │  └────────┘ └────────┘ └────────┘ └─────────────┘      │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐      │   │
│  │  │Payment │ │ Review │ │ Admin  │ │ Feedback    │      │   │
│  │  └────────┘ └────────┘ └────────┘ └─────────────┘      │   │
│  └──────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           External Service Integrations                  │   │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────┐         │   │
│  │  │ Paystack   │ │ Cloudinary │ │ Resend Email │         │   │
│  │  │ (Payments) │ │ (CDN)      │ │ (SMTP)       │         │   │
│  │  └────────────┘ └────────────┘ └──────────────┘         │   │
│  │  ┌────────────┐ ┌────────────┐                          │   │
│  │  │ Sentry     │ │ Supabase   │                          │   │
│  │  │ (Errors)   │ │ (Auth)     │                          │   │
│  │  └────────────┘ └────────────┘                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL Database (Supabase)                      │
│         (TypeORM - Auto-loaded Entity Synchronization)          │
└─────────────────────────────────────────────────────────────────┘
```

### Layered Architecture

The application follows a **layered architecture** pattern:

1. **Presentation Layer**: Controllers (REST API endpoints)
2. **Business Logic Layer**: Services (business rules and workflows)
3. **Data Access Layer**: Repositories (TypeORM entities and queries)
4. **Infrastructure Layer**: External services (Paystack, Cloudinary, Resend)
5. **Cross-Cutting Concerns**: Guards, Interceptors, Middleware

---

## Technology Stack

### Core Framework & Runtime

| Component      | Version | Purpose                                                           |
| -------------- | ------- | ----------------------------------------------------------------- |
| **NestJS**     | 11.1.5  | Progressive Node.js framework for building efficient applications |
| **Node.js**    | 18+     | Runtime environment                                               |
| **TypeScript** | 5.7.3   | Strongly-typed JavaScript superset                                |

### Database & ORM

| Component                     | Version | Purpose                         |
| ----------------------------- | ------- | ------------------------------- |
| **TypeORM**                   | 0.3.25  | ORM for database interaction    |
| **PostgreSQL** (via Supabase) | 15+     | Primary relational database     |
| **Prisma**                    | 6.12.0  | Alternative ORM (complementary) |
| **pg**                        | 8.16.3  | PostgreSQL driver               |

### Authentication & Security

| Component                 | Version | Purpose                           |
| ------------------------- | ------- | --------------------------------- |
| **Passport.js**           | 0.7.0   | Authentication middleware         |
| **@nestjs/jwt**           | 11.0.0  | JWT token handling                |
| **passport-jwt**          | 4.0.1   | JWT strategy for Passport         |
| **passport-custom**       | 1.1.1   | Custom authentication strategies  |
| **bcrypt**                | 6.0.0   | Password hashing and verification |
| **@supabase/supabase-js** | 2.52.0  | Supabase client library           |
| **Helmet**                | 8.1.0   | HTTP security headers             |

### API & Documentation

| Component                    | Version | Purpose                       |
| ---------------------------- | ------- | ----------------------------- |
| **@nestjs/swagger**          | 11.2.0  | OpenAPI/Swagger documentation |
| **swagger-ui-express**       | 5.0.1   | Swagger UI interface          |
| **@nestjs/platform-express** | 11.1.5  | Express adapter for NestJS    |

### File Upload & Media

| Component      | Version | Purpose                        |
| -------------- | ------- | ------------------------------ |
| **Cloudinary** | 2.7.0   | Image hosting and optimization |
| **multer**     | 2.0.2   | File upload middleware         |

### Email & Communications

| Component      | Version | Purpose                       |
| -------------- | ------- | ----------------------------- |
| **Resend**     | 6.2.2   | Email delivery service        |
| **Nodemailer** | 7.0.5   | Email transport (alternative) |

### Payment Integration

| Component    | Version | Purpose                                      |
| ------------ | ------- | -------------------------------------------- |
| **Paystack** | N/A     | Payment gateway integration (custom service) |
| **axios**    | 1.10.0  | HTTP client for API calls                    |

### Observability & Monitoring

| Component            | Version | Purpose                                   |
| -------------------- | ------- | ----------------------------------------- |
| **@sentry/nestjs**   | 10.37.0 | Error tracking and performance monitoring |
| **reflect-metadata** | 0.2.2   | Metadata reflection library               |

### Utilities & Helpers

| Component             | Version | Purpose                              |
| --------------------- | ------- | ------------------------------------ |
| **@nestjs/config**    | 4.0.2   | Environment configuration management |
| **@nestjs/throttler** | 6.4.0   | Rate limiting                        |
| **@nestjs/schedule**  | 6.0.0   | Task scheduling                      |
| **class-validator**   | 0.14.2  | DTO validation decorators            |
| **class-transformer** | 0.5.1   | Data transformation                  |
| **rxjs**              | 7.8.1   | Reactive programming                 |
| **pdfkit**            | 0.17.1  | PDF generation                       |

### Development Tools

| Component           | Version | Purpose                  |
| ------------------- | ------- | ------------------------ |
| **ESLint**          | 9.18.0  | Code linting             |
| **Prettier**        | 3.4.2   | Code formatting          |
| **Jest**            | 29.7.0  | Testing framework        |
| **ts-jest**         | 29.2.5  | Jest TypeScript support  |
| **@nestjs/testing** | 11.0.1  | NestJS testing utilities |
| **Supertest**       | 7.0.0   | HTTP assertion library   |

---

## Project Structure

### Directory Tree

```
ah-backend/
├── src/                              # Application source code
│   ├── main.ts                       # Application entry point
│   ├── app.module.ts                 # Root application module
│   ├── app.controller.ts             # Root controller
│   ├── app.service.ts                # Root service
│   ├── instrument.ts                 # Sentry instrumentation
│   │
│   ├── config/                       # Configuration files
│   │   └── typeorm.config.ts         # TypeORM database configuration
│   │
│   ├── entities/                     # Database entities (TypeORM)
│   │   ├── user.entity.ts            # User model (15 columns, relationships)
│   │   ├── hostel.entity.ts          # Hostel model (with amenities, payments)
│   │   ├── room.entity.ts            # Room model
│   │   ├── room-type.entity.ts       # Room type (capacity, pricing)
│   │   ├── booking.entity.ts         # Booking model (complex statuses)
│   │   ├── payment.entity.ts         # Payment transactions
│   │   ├── review.entity.ts          # Student reviews with ratings
│   │   ├── feedback.entity.ts        # User feedback
│   │   ├── public-feedback.entity.ts # Public feedback
│   │   ├── school.entity.ts          # School/institution data
│   │   ├── deposit.entity.ts         # Deposit tracking
│   │   ├── verification.entity.ts    # Email verification tokens
│   │   ├── admin-verification.entity.ts # Admin verification workflow
│   │   ├── access.entity.ts          # Access control and previews
│   │   └── preview-usage.entity.ts   # Preview usage tracking
│   │
│   ├── auth/                         # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts           # Authentication logic
│   │   ├── auth.controller.ts        # Authentication endpoints
│   │   ├── admin.controller.ts       # Admin auth endpoints
│   │   ├── admin-verification.service.ts
│   │   ├── supabase.strategy.ts      # Supabase passport strategy
│   │   ├── decorators/               # Custom decorators
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── dto/                      # Data Transfer Objects
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   ├── reset-password.dto.ts
│   │   │   └── update-profile.dto.ts
│   │   ├── files/                    # Auth file uploads
│   │   ├── guards/                   # Route guards
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── strategies/               # Passport strategies
│   │
│   ├── hostels/                      # Hostels management module
│   │   ├── hostels.module.ts
│   │   ├── hostels.service.ts        # Hostel business logic
│   │   ├── hostels.controller.ts     # Hostel endpoints
│   │   └── dto/
│   │       ├── create-hostel.dto.ts
│   │       └── update-hostel.dto.ts
│   │
│   ├── rooms/                        # Rooms management module
│   │   ├── rooms.module.ts
│   │   ├── rooms.service.ts
│   │   ├── rooms.controller.ts
│   │   ├── room-type.service.ts
│   │   └── dto/
│   │       ├── create-room.dto.ts
│   │       └── update-room.dto.ts
│   │
│   ├── bookings/                     # Bookings module
│   │   ├── booking.module.ts
│   │   ├── bookings.service.ts       # Complex booking logic
│   │   ├── bookings.controller.ts
│   │   ├── booking-scheduler.service.ts # Scheduled tasks
│   │   ├── notifications.service.ts  # Booking notifications
│   │   └── dto/
│   │       └── booking.dto.ts        # Multiple DTOs for booking flows
│   │
│   ├── payment/                      # Payment management module
│   │   ├── payments.module.ts
│   │   ├── payments.service.ts
│   │   ├── payments.controller.ts
│   │   └── dto/
│   │       └── payment.dto.ts
│   │
│   ├── paystack/                     # Paystack integration service
│   │   └── paystack.service.ts
│   │
│   ├── review/                       # Reviews module
│   │   ├── review.module.ts
│   │   ├── review.service.ts
│   │   ├── review.controller.ts
│   │   └── dto/
│   │
│   ├── feeedback/                    # Feedback module
│   │   ├── feedback.module.ts
│   │   ├── feedback.service.ts
│   │   ├── feedback.controller.ts
│   │   ├── public-feedback.service.ts
│   │   ├── feedbacksql.txt           # SQL migration/queries
│   │   └── dto/
│   │
│   ├── school/                       # Schools module
│   │   ├── school.module.ts
│   │   └── school.controller.ts
│   │
│   ├── admin/                        # Admin operations module
│   │   ├── admin.module.ts
│   │   ├── admin.service.ts
│   │   ├── admin.controller.ts
│   │   ├── access/                   # Admin access management
│   │   │   └── access-management.module.ts
│   │   ├── bookings/                 # Admin booking management
│   │   │   └── booking-management.module.ts
│   │   ├── users/                    # Admin user management
│   │   │   └── user-management.module.ts
│   │   └── dto/
│   │
│   ├── deposits/                     # Deposits module
│   │   ├── deposits.module.ts
│   │   ├── deposits.service.ts
│   │   ├── deposits.controller.ts
│   │   └── dto/
│   │
│   ├── access/                       # Access control service
│   │   └── access.service.ts
│   │
│   ├── cloudinary/                   # Media management service
│   │   └── cloudinary.service.ts
│   │
│   ├── mail/                         # Email service module
│   │   ├── mail.module.ts
│   │   ├── mail.service.ts
│   │   └── templates/                # Email templates
│   │       ├── verify.html
│   │       └── reset.html
│   │
│   ├── file/                         # File handling service
│   │   └── file-upload.service.ts
│   │
│   ├── supabase/                     # Supabase integration
│   │   ├── supabase.module.ts
│   │   └── supabase.service.ts
│   │
│   ├── profile/                      # User profile module
│   │   ├── profile.module.ts
│   │   └── profile.service.ts
│   │
│   ├── preview/                      # Preview/trial features
│   │   ├── preview-usage.module.ts
│   │   └── preview-usage.service.ts
│   │
│   └── obboarding/                   # Onboarding module
│       └── dto/
│           └── onboarding.dto.ts
│
├── test/                             # End-to-end tests
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
│
├── dist/                             # Compiled JavaScript (generated)
│
├── configuration files
│   ├── package.json                  # NPM dependencies
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── tsconfig.build.json           # Build TypeScript config
│   ├── nest-cli.json                 # NestJS CLI configuration
│   ├── eslint.config.mjs             # ESLint configuration
│   └── README.md                     # Project README
│
└── .gitignore                        # Git ignore rules
```

---

## Database Schema & Entities

### Entity Relationship Diagram (ERD)

```
┌──────────────────────────┐
│        USERS             │
├──────────────────────────┤
│ id (UUID, PK)            │
│ email (UNIQUE)           │
│ password_hash            │
│ name                     │
│ phone                    │
│ gender                   │
│ role (enum)              │
│ is_verified              │
│ status                   │
│ terms_accepted           │
│ emergency_contact_*      │
│ school_id (FK)           │
│ created_at               │
└────────┬─────────────────┘
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         ▼                                             ▼
┌──────────────────────────┐                ┌──────────────────────────┐
│      REVIEWS             │                │        SCHOOLS           │
├──────────────────────────┤                ├──────────────────────────┤
│ id (UUID, PK)            │                │ id (UUID, PK)            │
│ hostel_id (FK)           │                │ name                     │
│ student_id (FK to User)  │                │ domain (UNIQUE)          │
│ rating (1-5)             │                │ location (GEOMETRY)      │
│ review_text              │                │ created_at               │
│ detailed_ratings (JSONB) │                └──────────────────────────┘
│ status                   │
│ helpful_votes            │
│ images                   │
│ admin_notes              │
│ hostel_response          │
│ created_at               │
└──────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│        HOSTELS                           │
├──────────────────────────────────────────┤
│ id (UUID, PK)                            │
│ name                                     │
│ email                                    │
│ phone, SecondaryNumber                   │
│ description (TEXT)                       │
│ location (GEOMETRY - PostGIS Point)      │
│ address                                  │
│ admin_id (FK to User)                    │
│ images (JSONB array)                     │
│ amenities (JSONB object)                 │
│ base_price (DECIMAL)                     │
│ payment_method (enum)                    │
│ bank_details (JSONB)                     │
│ momo_details (JSONB)                     │
│ max_occupancy                            │
│ house_rules                              │
│ nearby_facilities (JSONB array)          │
│ check_in_time, check_out_time            │
│ created_at, updated_at                   │
└────────────────┬─────────────────────────┘
                 │
         ┌───────┴──────────┐
         │                  │
         ▼                  ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│    ROOM_TYPES            │  │       ROOMS                  │
├──────────────────────────┤  ├──────────────────────────────┤
│ id (UUID, PK)            │  │ id (UUID, PK)                │
│ hostel_id (FK)           │  │ hostel_id (FK)               │
│ room_type_name           │  │ room_type_id (FK)            │
│ description              │  │ room_number                  │
│ max_occupancy            │  │ floor                        │
│ base_price               │  │ status (text/enum)           │
│ images (JSONB)           │  │ current_occupancy            │
│ amenities (JSONB)        │  │ max_occupancy                │
│ created_at, updated_at   │  │ notes                        │
└──────────────────────────┘  │ created_at, updated_at       │
         │                     └────────┬────────────────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │       BOOKINGS               │
         ├──────────────────────────────┤
         │ id (UUID, PK)                │
         │ hostel_id (FK)               │
         │ room_id (FK)                 │
         │ student_id (FK to User)      │
         │ student_name, email, phone   │
         │ booking_type (enum)          │
         │ status (enum)                │
         │ payment_status (enum)        │
         │ check_in_date, check_out_date│
         │ total_amount (DECIMAL)       │
         │ amount_paid (DECIMAL)        │
         │ amount_due (DECIMAL)         │
         │ booking_fee (DECIMAL)        │
         │ deposit_amount (DECIMAL)     │
         │ payment_due_date             │
         │ created_at, updated_at       │
         └────────────┬─────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
┌──────────────────────────┐  ┌────────────────────────────┐
│     PAYMENTS             │  │     DEPOSITS               │
├──────────────────────────┤  ├────────────────────────────┤
│ id (UUID, PK)            │  │ id (UUID, PK)              │
│ booking_id (FK)          │  │ booking_id (FK)            │
│ amount (DECIMAL)         │  │ student_id (FK)            │
│ payment_method (enum)    │  │ amount (DECIMAL)           │
│ payment_type (enum)      │  │ status (enum)              │
│ transaction_ref          │  │ deposit_type (enum)        │
│ notes                    │  │ reason                     │
│ payment_date             │  │ returned_date (nullable)   │
│ received_by              │  │ created_at, updated_at     │
│ metadata (JSONB)         │  │                            │
│ created_at, updated_at   │  │                            │
└──────────────────────────┘  └────────────────────────────┘

┌──────────────────────────────┐
│   ADMIN_VERIFICATION         │
├──────────────────────────────┤
│ id (UUID, PK)                │
│ user_id (FK)                 │
│ token                        │
│ status                       │
│ created_at, updated_at       │
└──────────────────────────────┘

┌──────────────────────────────┐
│    VERIFICATION              │
├──────────────────────────────┤
│ id (UUID, PK)                │
│ user_id (FK)                 │
│ token                        │
│ purpose                      │
│ created_at, expires_at       │
└──────────────────────────────┘

┌──────────────────────────────┐
│      ACCESS                  │
├──────────────────────────────┤
│ id (UUID, PK)                │
│ user_id (FK)                 │
│ expires_at                   │
│ source                       │
│ paystack_reference (unique)  │
│ created_at                   │
└──────────────────────────────┘
```

### Core Entities Description

#### **User Entity**

```typescript
- id: UUID (Primary Key)
- email: String (Unique, indexed)
- password_hash: String (bcrypt hashed)
- name: String (nullable)
- phone: String (nullable)
- gender: Enum [male, female, other, prefer_not_to_say]
- is_verified: Boolean (default: false)
- onboarding_completed: Boolean (default: false)
- verification_token: String (nullable)
- password_reset_token: String (nullable)
- reset_token_expiry: Date (nullable)
- verification_token_expires_at: Date (nullable)
- verified_at: Date (nullable)
- status: Enum [unverified, pending, verified]
- role: Enum [student, hostel_admin, super_admin]
- terms_accepted: Boolean
- terms_accepted_at: Date (nullable)
- created_at: Date
- school_id: UUID (Foreign Key to School)
- emergency_contact_name/phone/relationship/email: String (nullable)
```

**Relationships:**

- Many-to-Many: AdminVerification
- One-to-Many: Reviews (as student)
- One-to-Many: Bookings (as student)

---

#### **Hostel Entity**

```typescript
- id: UUID (Primary Key)
- name: String (indexed)
- email: String
- phone: String
- SecondaryNumber: String
- description: Text
- location: Geometry (PostGIS Point - Lat/Long)
- address: Text
- admin_id: UUID (Foreign Key to User)
- images: JSONB Array[String] (Cloudinary URLs)
- amenities: JSONB Object {
    wifi: boolean,
    laundry: boolean,
    cafeteria: boolean,
    parking: boolean,
    security: boolean,
    gym: boolean,
    studyRoom: boolean,
    kitchen: boolean,
    ac: boolean,
    generator: boolean
  }
- base_price: Decimal(10,2)
- payment_method: Enum [bank, momo, both]
- bank_details: JSONB {bank_name, account_name, account_number, branch}
- momo_details: JSONB {provider, number, name}
- max_occupancy: Integer
- house_rules: Text
- nearby_facilities: JSONB Array[String]
- check_in_time: Time
- check_out_time: Time
- created_at, updated_at: Timestamp
```

**Relationships:**

- One-to-Many: Rooms
- One-to-Many: RoomTypes
- One-to-Many: Reviews

---

#### **Booking Entity**

```typescript
- id: UUID (Primary Key)
- hostel_id: UUID (Foreign Key)
- room_id: UUID (Foreign Key)
- student_id: UUID (Foreign Key to User, nullable)
- student_name: String
- student_email: Email
- student_phone: String (max 20)
- booking_type: Enum [semester, monthly, weekly]
- status: Enum [pending, confirmed, checked_in, checked_out, cancelled, no_show]
- payment_status: Enum [pending, partial, paid, cancelled, overdue]
- check_in_date: Date
- check_out_date: Date
- total_amount: Decimal(10,2)
- amount_paid: Decimal(10,2) (default: 0)
- amount_due: Decimal(10,2) (default: 0)
- deposit_amount: Decimal(10,2) (default: 0)
- booking_fee: Decimal(10,2) (default: 70)
- payment_due_date: Date (nullable)
- created_at, updated_at: Timestamp
```

**Statuses & Enums:**

- **BookingStatus**: PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW
- **BookingType**: SEMESTER, MONTHLY, WEEKLY
- **PaymentStatus**: PENDING, PARTIAL, PAID, CANCELLED, OVERDUE

**Relationships:**

- Many-to-One: Room
- Many-to-One: Hostel
- One-to-Many: Payments
- One-to-Many: Reviews

---

#### **Payment Entity**

```typescript
- id: UUID (Primary Key)
- booking_id: UUID (Foreign Key)
- amount: Decimal(10,2)
- payment_method: Enum [cash, bank_transfer, mobile_money, card, cheque, account_credit]
- payment_type: Enum [booking_payment, deposit, refund, penalty]
- transaction_ref: String (unique, nullable - Paystack reference)
- notes: Text (nullable)
- payment_date: Timestamp (default: CURRENT_TIMESTAMP)
- received_by: String (nullable - admin email/name)
- metadata: JSONB (additional payment data)
- created_at, updated_at: Timestamp
```

---

#### **Review Entity**

```typescript
- id: UUID (Primary Key)
- hostel_id: UUID (Foreign Key)
- booking_id: UUID (Foreign Key)
- student_id: UUID (Foreign Key)
- student_name: String
- rating: Integer (1-5)
- review_text: Text
- detailed_ratings: JSONB {
    cleanliness?: number,
    security?: number,
    location?: number,
    staff?: number,
    facilities?: number,
    valueForMoney?: number
  }
- status: Enum [pending, approved, rejected, flagged]
- helpful_votes: JSONB Array[UUID] (user IDs)
- helpful_count: Integer (counter)
- images: JSONB Array[String] (Cloudinary URLs)
- admin_notes: Text (nullable)
- moderated_by: UUID (admin user ID, nullable)
- moderated_at: Timestamp (nullable)
- hostel_response: Text (nullable)
- hostel_responded_at: Timestamp (nullable)
- created_at, updated_at: Timestamp
```

**Constraints:**

- Unique Index: [hostel_id, student_id] (one review per student per hostel)

---

#### **Room Entity**

```typescript
- id: UUID (Primary Key)
- hostel_id: UUID (Foreign Key)
- room_type_id: UUID (Foreign Key)
- room_number: String (max 20)
- floor: Integer (nullable)
- status: Text (enum) [available, occupied, maintenance, reserved]
- current_occupancy: Integer (default: 0)
- max_occupancy: Integer
- notes: Text (nullable)
- created_at, updated_at: Timestamp
```

**Methods:**

- `isAvailable()`: Returns boolean (status available AND has capacity)
- `hasSpace()`: Returns boolean (current_occupancy < max_occupancy)
- `getRemainingCapacity()`: Returns number (max_occupancy - current_occupancy)

---

#### **RoomType Entity**

```typescript
- id: UUID (Primary Key)
- hostel_id: UUID (Foreign Key)
- room_type_name: String
- description: Text (nullable)
- max_occupancy: Integer
- base_price: Decimal(10,2)
- images: JSONB Array[String]
- amenities: JSONB Array[String]
- created_at, updated_at: Timestamp
```

---

#### **Access Entity** (Preview/Trial Management)

```typescript
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key)
- expires_at: Timestamp
- source: String [paystack, free_trial, admin_grant]
- paystack_reference: String (unique, nullable)
- created_at: Timestamp
```

**Purpose:** Tracks paid preview access and trial periods for features

---

#### **School Entity**

```typescript
- id: UUID (Primary Key)
- name: String
- domain: String (unique)
- location: Geometry (PostGIS Point - Lat/Long)
- created_at: Timestamp
```

---

#### **Other Entities**

**Deposit Entity:**

- Tracks security deposits for bookings
- Status: [pending, held, refunded, deducted]

**Verification Entity:**

- Email verification tokens
- Password reset tokens
- Time-based expiry

**AdminVerification Entity:**

- Admin account verification workflow
- Many-to-Many with Users

**Feedback Entity:**

- General platform feedback
- Public review feedback

---

## Core Modules & Services

### 1. Authentication Module (`auth/`)

**Purpose:** Handle user authentication, registration, JWT token generation, and role-based access control.

#### Key Services:

**AuthService** (`auth.service.ts`)

- `register(registerDto)`: User self-registration with email verification
- `registerStudent(registerDto)`: Student-specific registration
- `validateUser(email, password)`: Validate credentials against bcrypt hash
- `login(email, password)`: Generate JWT token
- `logout()`: Token invalidation
- `verifyEmail(token)`: Confirm email via verification token
- `requestPasswordReset(email)`: Send password reset email
- `resetPassword(token, newPassword)`: Reset password with token
- `getUserProfile(userId)`: Fetch complete user details
- `updateProfile(userId, updateDto)`: Update user information
- `updateOnboarding(userId, onboardingDto)`: Mark onboarding as complete

**AdminVerificationService** (`admin-verification.service.ts`)

- Handles admin account verification workflow
- Sends verification emails to admin candidates
- Validates admin credentials

#### Guards:

**JwtAuthGuard** (`guards/jwt-auth.guard.ts`)

- Validates JWT tokens from Authorization header
- Attached to protected routes
- Extracts user from decoded token

**RolesGuard** (`guards/roles.guard.ts`)

- Validates user roles against route requirements
- Used with `@Roles()` decorator
- Supports multiple role authorization

#### DTOs:

- `LoginDto`: email, password
- `RegisterDto`: email, password, terms_accepted, school_id
- `UpdateProfileDto`: phone, name, gender, emergency contact fields
- `ResetPasswordDto`: token, newPassword
- `OnboardingDto`: emergency contact details

#### Decorators:

- `@Roles(...roles)`: Specify allowed roles for endpoint
- `@CurrentUser()`: Inject current user from JWT into handler

---

### 2. Hostels Module (`hostels/`)

**Purpose:** Manage hostel creation, updates, and information retrieval.

#### Key Services:

**HostelsService** (`hostels.service.ts`)

- `create(adminId, createDto, files)`: Create hostel with image uploads to Cloudinary
- `findAll()`: Fetch all hostels (paginated)
- `findByAdminId(adminId)`: Fetch hostels owned by specific admin
- `findById(id)`: Get hostel details with relations
- `update(id, updateDto)`: Update hostel information
- `delete(id)`: Soft delete hostel
- `getHostelContact(id)`: Get contact details
- `uploadImages(hostelId, files)`: Handle multi-image uploads
- `calculateDistance(hostelId, userLocation)`: Geographic queries

#### DTOs:

- `CreateHostelDto`: name, email, phone, description, address, location, amenities, payment methods
- `UpdateHostelDto`: Partial version of CreateHostelDto

#### Storage:

- Images: Cloudinary (cloud storage)
- Metadata: PostgreSQL (structured data)
- Location: PostGIS Geometry type (spatial queries)

---

### 3. Rooms Module (`rooms/`)

**Purpose:** Manage room types and individual room instances.

#### Key Services:

**RoomsService** (`rooms.service.ts`)

- `createRoom(hostelId, roomDto)`: Create room instance
- `getRoomsByHostel(hostelId)`: List hostel's rooms
- `updateRoom(roomId, updateDto)`: Update room status/details
- `checkAvailability(roomId, checkInDate, checkOutDate)`: Verify room availability
- `getRoomCapacity(roomId)`: Get occupancy details
- `updateOccupancy(roomId, delta)`: Increment/decrement current occupancy

**RoomTypeService** (`room-type.service.ts`)

- `createRoomType(hostelId, typeDto)`: Define room type with pricing/capacity
- `getRoomTypes(hostelId)`: List room types for hostel
- `updateRoomType(typeId, updateDto)`: Modify room type

#### DTOs:

- `CreateRoomDto`: room_number, floor, max_occupancy, room_type_id
- `CreateRoomTypeDto`: room_type_name, description, max_occupancy, base_price

#### Key Logic:

- **Capacity Tracking**: currentOccupancy vs maxOccupancy
- **Status Management**: available → occupied → maintenance → reserved
- **Availability Calculation**: Considers booking dates and current occupancy

---

### 4. Bookings Module (`bookings/`)

**Purpose:** Handle booking lifecycle: creation, confirmation, check-in/out, cancellation.

#### Key Services:

**BookingsService** (`bookings.service.ts`) - **Complex Logic Core**

- `createBooking(studentId, bookingDto)`: Initiate booking with automatic fee calculation
- `confirmBooking(bookingId, confirmDto)`: Confirm booking and lock room
- `cancelBooking(bookingId, reason)`: Cancel with refund calculation
- `checkIn(bookingId, checkInDto)`: Mark student as checked in
- `checkOut(bookingId, checkOutDto)`: Mark student as checked out, process deposits
- `extendBooking(bookingId, extendDto)`: Extend booking dates
- `getBookingsByStudent(studentId)`: Fetch student's bookings
- `getBookingsByHostel(hostelId)`: Fetch hostel's bookings
- `verifyPayment(reference)`: Verify Paystack payment and update booking status
- `generateBookingReport(filters)`: Analytics and reporting

**Booking Fee Logic:**

- Base booking fee: GHS 70 (configurable)
- Added to total_amount during creation
- Tracked separately in `booking_fee` column for transparency

**Payment Tracking:**

- total_amount: Full accommodation cost + fee
- amount_paid: Tracked payments
- amount_due: total_amount - amount_paid
- deposit_amount: Security deposit (may be deducted for damages)

**Status Transitions:**

```
pending → confirmed → checked_in → checked_out
                   ↓
              cancelled (at any point)
```

**BookingSchedulerService** (`booking-scheduler.service.ts`)

- Scheduled tasks for automatic status updates
- Overdue payment notifications
- Auto-checkout for expired bookings

**NotificationsService** (`notifications.service.ts`)

- Send booking confirmations
- Payment reminders
- Check-in/out notifications

#### DTOs:

- `CreateBookingDto`: room_id, check_in_date, check_out_date, booking_type
- `ConfirmBookingDto`: payment_method, deposit_amount
- `CheckInDto`: Occupant list verification
- `CheckOutDto`: Damage assessment, deposit deduction
- `ExtendBookingDto`: new_check_out_date
- `VerifyPaymentDto`: reference, expectedAmount

---

### 5. Payment Module (`payment/`)

**Purpose:** Manage payment initiation, processing, and tracking.

#### Key Services:

**PaymentsService** (`payments.service.ts`)

- `initiatePayment(userId, amount, email)`: Create Paystack transaction
- `verifyPayment(reference)`: Confirm payment with Paystack
- `recordPayment(bookingId, paymentDto)`: Log payment in system
- `generateInvoice(bookingId)`: Create payment invoice (PDF)
- `refundPayment(paymentId, reason)`: Process refund
- `getPaymentHistory(bookingId)`: Payment transaction log

**PaystackService** (`paystack/paystack.service.ts`)

- `initializeTransaction(amount, email, reference)`: Call Paystack API
- `verifyPayment(reference)`: Verify transaction with Paystack
- `validatePayment(verification, expectedAmount)`: Amount validation
- API integration with Paystack backend

#### Payment Flow:

```
1. User initiates payment: /payment/initiate
   ↓
2. Paystack transaction created (pending)
   ↓
3. User redirected to Paystack gateway (external)
   ↓
4. User completes payment or cancels
   ↓
5. Paystack callback to /payment/callback
   ↓
6. Backend verifies with Paystack API
   ↓
7. Update booking payment_status and room occupancy
   ↓
8. Grant access if payment successful
```

#### Payment Methods:

- Bank Transfer
- Mobile Money (MTN, Vodafone, AirtelTigo)
- Card (Visa, Mastercard)
- Cash (manual recording by admin)

---

### 6. Review Module (`review/`)

**Purpose:** Manage student reviews with admin moderation.

#### Key Services:

**ReviewService** (`review.service.ts`)

- `createReview(studentId, reviewDto)`: Submit new review
- `updateReview(reviewId, updateDto)`: Update draft review
- `submitReview(reviewId)`: Submit for moderation (status: pending)
- `approveReview(reviewId, adminId)`: Admin approval (status: approved)
- `rejectReview(reviewId, reason, adminId)`: Admin rejection with reason
- `flagReview(reviewId, reason)`: Flag inappropriate content
- `getHostelReviews(hostelId)`: Fetch public reviews
- `calculateHostelRating(hostelId)`: Aggregate rating statistics
- `markHelpful(reviewId, userId)`: User finds review helpful
- `respondToReview(reviewId, response)`: Hostel admin responds

#### Moderation:

- Reviews start as PENDING
- Admin must APPROVE for public visibility
- Can be FLAGGED for inappropriate content
- REJECTED reviews are hidden with reason

#### Rating Aggregation:

- Overall rating (1-5 stars)
- Detailed ratings: cleanliness, security, location, staff, facilities, valueForMoney
- Helpful vote count
- Response rate from hostel admin

#### DTOs:

- `CreateReviewDto`: rating, review_text, detailed_ratings, images[]
- `UpdateReviewDto`: All fields (nullable)
- `RespondToReviewDto`: hostel_response text

---

### 7. Admin Module (`admin/`)

**Purpose:** Administrative operations and dashboard functionality.

#### Key Sub-Modules:

**AccessManagementModule** (`admin/access/`)

- Manage preview access grants
- Trial period configuration
- Access revocation

**UserManagementModule** (`admin/users/`)

- User account management
- Role assignment/changes
- Account suspension/restoration

**BookingManagementModule** (`admin/bookings/`)

- Override booking operations
- Manual check-in/out
- Payment adjustments
- Dispute resolution

#### AdminService:

- `getDashboardStats()`: Revenue, occupancy, user metrics
- `getRevenueReport(dateRange)`: Financial analytics
- `getOccupancyReport(hostelId, dateRange)`: Occupancy trends
- `exportBookingsReport(filters)`: CSV/PDF export
- `bulkUpdateBookingStatus(bookingIds, newStatus)`: Batch operations

---

### 8. Feedback Module (`feeedback/`)

**Purpose:** Collect and manage user feedback on platform.

#### Services:

**FeedbackService** (`feedback.service.ts`)

- `submitFeedback(userId, feedbackDto)`: User submits feedback
- `getFeedback(filters)`: Admin retrieves feedback
- `respondToFeedback(feedbackId, response)`: Admin response

**PublicFeedbackService** (`public-feedback.service.ts`)

- Manage public testimonials/case studies
- Moderate feedback for visibility

---

### 9. Supporting Services

#### **CloudinaryService** (`cloudinary/cloudinary.service.ts`)

- `uploadImage(file)`: Upload to Cloudinary, return secure URL
- `deleteImage(publicId)`: Remove image from cloud
- `extractPublicId(url)`: Parse Cloudinary URL for cleanup
- Folder organization: `/hostels/...`, `/reviews/...`

#### **MailService** (`mail/mail.service.ts`)

- `sendVerificationEmail(email, token)`: Registration verification
- `sendPasswordResetEmail(email, token)`: Password reset flow
- `sendBookingConfirmation(email, bookingDetails)`: Booking confirmation
- `sendPaymentReminder(email, bookingDetails)`: Payment due notification
- Template rendering with Resend API
- HTML email templates in `mail/templates/`

#### **SupabaseService** (`supabase/supabase.service.ts`)

- Supabase SDK client initialization
- Alternative to direct database access (TypeORM-based approach preferred)
- Used for special authentication flows

#### **FileUploadService** (`file/file-upload.service.ts`)

- Handles multipart form-data parsing
- File validation (size, type)
- Integration with Cloudinary uploads

#### **AccessService** (`access/access.service.ts`)

- `checkAccess(userId)`: Verify user has active preview access
- `grantAccess(userId, days, source)`: Create access record
- `revokeAccess(userId)`: Expire access
- Used for feature access control

#### **ProfileService** (`profile/profile.service.ts`)

- `getProfile(userId)`: Complete user profile with relations
- `updateProfile(userId, updateDto)`: Profile modifications
- Privacy and permission checks

---

## API Architecture

### RESTful Endpoint Design

The API follows RESTful conventions with resource-oriented endpoints:

#### **Authentication Endpoints** (`/auth`)

| Method | Endpoint                       | Description                   | Auth Required |
| ------ | ------------------------------ | ----------------------------- | ------------- |
| POST   | `/auth/register`               | User self-registration        | No            |
| POST   | `/auth/register-student`       | Student-specific registration | No            |
| POST   | `/auth/login`                  | Login with email/password     | No            |
| GET    | `/auth/user-profile`           | Get current user profile      | Yes           |
| PATCH  | `/auth/update-profile`         | Update user profile           | Yes           |
| POST   | `/auth/verify-email`           | Verify email with token       | No            |
| POST   | `/auth/request-password-reset` | Send password reset email     | No            |
| POST   | `/auth/reset-password`         | Reset password with token     | No            |
| POST   | `/auth/logout`                 | Logout (token invalidation)   | Yes           |

#### **Hostels Endpoints** (`/hostels`)

| Method | Endpoint                     | Description          | Auth Required      |
| ------ | ---------------------------- | -------------------- | ------------------ |
| POST   | `/hostels/create`            | Create new hostel    | Yes (Hostel Admin) |
| GET    | `/hostels/fetch`             | Get user's hostels   | Yes                |
| GET    | `/hostels/all`               | List all hostels     | No                 |
| GET    | `/hostels/:id`               | Get hostel details   | No                 |
| PATCH  | `/hostels/:id`               | Update hostel        | Yes (Owner)        |
| DELETE | `/hostels/:id`               | Delete hostel        | Yes (Owner)        |
| GET    | `/hostels/:id/contact`       | Get contact details  | No                 |
| POST   | `/hostels/:id/upload-images` | Upload hostel images | Yes (Owner)        |
| GET    | `/hostels/admin/:adminId`    | Get admin's hostels  | Yes (Admin)        |

#### **Rooms Endpoints** (`/rooms`)

| Method | Endpoint                  | Description             | Auth Required      |
| ------ | ------------------------- | ----------------------- | ------------------ |
| POST   | `/rooms/create`           | Create room             | Yes (Hostel Admin) |
| GET    | `/rooms/hostel/:hostelId` | List hostel rooms       | No                 |
| PATCH  | `/rooms/:id`              | Update room             | Yes (Hostel Admin) |
| GET    | `/rooms/:id/availability` | Check room availability | No                 |
| POST   | `/rooms/bulk-create`      | Create multiple rooms   | Yes (Hostel Admin) |

#### **Bookings Endpoints** (`/bookings`)

| Method | Endpoint                       | Description             | Auth Required       |
| ------ | ------------------------------ | ----------------------- | ------------------- |
| POST   | `/bookings/create`             | Create booking          | Yes (Student)       |
| GET    | `/bookings/my-bookings`        | Get student bookings    | Yes (Student)       |
| GET    | `/bookings/:id`                | Get booking details     | Yes (Student/Admin) |
| PATCH  | `/bookings/:id/confirm`        | Confirm booking         | Yes (Student)       |
| PATCH  | `/bookings/:id/cancel`         | Cancel booking          | Yes (Student)       |
| PATCH  | `/bookings/:id/check-in`       | Check in                | Yes (Admin)         |
| PATCH  | `/bookings/:id/check-out`      | Check out               | Yes (Admin)         |
| PATCH  | `/bookings/:id/extend`         | Extend booking dates    | Yes (Student)       |
| POST   | `/bookings/:id/verify-payment` | Verify payment          | Yes (Admin)         |
| GET    | `/bookings/hostel/:hostelId`   | Get hostel bookings     | Yes (Hostel Admin)  |
| GET    | `/bookings/report`             | Generate booking report | Yes (Admin)         |

#### **Payments Endpoints** (`/payment`)

| Method | Endpoint                      | Description                 | Auth Required     |
| ------ | ----------------------------- | --------------------------- | ----------------- |
| POST   | `/payment/initiate`           | Start payment process       | Yes (Student)     |
| GET    | `/payment/callback`           | Payment callback (Paystack) | Query params      |
| POST   | `/payment/verify`             | Verify payment              | Yes (Student)     |
| GET    | `/payment/history/:bookingId` | Payment history             | Yes (Owner/Admin) |
| POST   | `/payment/refund`             | Process refund              | Yes (Admin)       |
| GET    | `/payment/invoice/:bookingId` | Generate invoice            | Yes (Owner/Admin) |

#### **Reviews Endpoints** (`/review`)

| Method | Endpoint                   | Description             | Auth Required      |
| ------ | -------------------------- | ----------------------- | ------------------ |
| POST   | `/review/create`           | Submit review           | Yes (Student)      |
| GET    | `/review/hostel/:hostelId` | Get hostel reviews      | No                 |
| PATCH  | `/review/:id`              | Update draft review     | Yes (Author)       |
| POST   | `/review/:id/submit`       | Submit for moderation   | Yes (Author)       |
| PATCH  | `/review/:id/approve`      | Approve review          | Yes (Admin)        |
| PATCH  | `/review/:id/reject`       | Reject review           | Yes (Admin)        |
| POST   | `/review/:id/flag`         | Flag inappropriate      | Yes (User)         |
| POST   | `/review/:id/helpful`      | Mark as helpful         | Yes (User)         |
| GET    | `/review/:hostelId/rating` | Get hostel rating stats | No                 |
| POST   | `/review/:id/respond`      | Hostel responds         | Yes (Hostel Admin) |

#### **Admin Endpoints** (`/admin`)

| Method | Endpoint                    | Description          | Auth Required     |
| ------ | --------------------------- | -------------------- | ----------------- |
| GET    | `/admin/dashboard`          | Dashboard statistics | Yes (Admin)       |
| GET    | `/admin/users`              | List users           | Yes (Super Admin) |
| PATCH  | `/admin/users/:userId/role` | Change user role     | Yes (Super Admin) |
| GET    | `/admin/revenue-report`     | Revenue analytics    | Yes (Admin)       |
| GET    | `/admin/occupancy-report`   | Occupancy analytics  | Yes (Admin)       |
| GET    | `/admin/bookings/report`    | Booking report       | Yes (Admin)       |

#### **Feedback Endpoints** (`/feedback`)

| Method | Endpoint                | Description         | Auth Required |
| ------ | ----------------------- | ------------------- | ------------- |
| POST   | `/feedback/submit`      | Submit feedback     | Yes (User)    |
| GET    | `/feedback/list`        | Get feedback        | Yes (Admin)   |
| PATCH  | `/feedback/:id/respond` | Respond to feedback | Yes (Admin)   |

---

### Response Format

All API responses follow a consistent JSON structure:

#### **Success Response (2xx)**

```json
{
  "status": 200,
  "success": true,
  "message": "Operation successful",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    ...
  },
  "timestamp": "2026-01-27T10:30:00Z"
}
```

#### **Paginated Response**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### **Error Response (4xx, 5xx)**

```json
{
  "status": 400,
  "success": false,
  "error": "ValidationException",
  "message": "Invalid email format",
  "details": {
    "field": "email",
    "error": "invalid_format"
  },
  "timestamp": "2026-01-27T10:30:00Z"
}
```

### Error Codes

| Code | Name                  | Meaning                               |
| ---- | --------------------- | ------------------------------------- |
| 400  | BAD_REQUEST           | Invalid request parameters            |
| 401  | UNAUTHORIZED          | Missing/invalid JWT token             |
| 403  | FORBIDDEN             | Insufficient permissions for resource |
| 404  | NOT_FOUND             | Resource not found                    |
| 409  | CONFLICT              | Resource already exists               |
| 422  | UNPROCESSABLE_ENTITY  | Validation failed                     |
| 429  | TOO_MANY_REQUESTS     | Rate limit exceeded                   |
| 500  | INTERNAL_SERVER_ERROR | Server error                          |
| 503  | SERVICE_UNAVAILABLE   | External service unavailable          |

---

## Authentication & Authorization

### JWT-Based Authentication Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. POST /auth/login
       │    { email, password }
       ▼
┌──────────────────────┐
│  Auth Controller     │
└──────┬───────────────┘
       │ 2. Validate credentials
       ▼
┌──────────────────────┐
│   Auth Service       │
│ - Hash password      │
│ - Compare bcrypt     │
│ - Generate JWT       │
└──────┬───────────────┘
       │ 3. Return JWT token
       ▼
┌─────────────┐
│   Client    │
│ Stores JWT  │
└──────┬──────┘
       │ 4. Authorization: Bearer <JWT>
       ▼
┌──────────────────────┐
│  JwtAuthGuard        │
│ - Verify signature   │
│ - Extract payload    │
│ - Validate expiry    │
└──────┬───────────────┘
       │ 5. Attach user to request
       ▼
┌──────────────────────┐
│   Route Handler      │
│ @CurrentUser() user  │
└──────────────────────┘
```

### JWT Token Structure

```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "id": "user-uuid",
  "email": "user@example.com",
  "role": "student",
  "school_id": "school-uuid",
  "iat": 1674820200,
  "exp": 1674906600  // 24 hours
}

Signature: HMAC256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  "JWT_SECRET"
)
```

### Role-Based Access Control (RBAC)

#### User Roles:

1. **Student** (`student`)
   - Browse hostels and rooms
   - Create bookings
   - Make payments
   - Submit reviews and feedback
   - View own profile and booking history

2. **Hostel Admin** (`hostel_admin`)
   - Create and manage hostels
   - Create and manage rooms
   - View bookings for their hostels
   - Manage payments and deposits
   - Respond to reviews
   - View reports for their hostels

3. **Super Admin** (`super_admin`)
   - All Hostel Admin permissions
   - Manage all users
   - View system-wide analytics
   - Approve/reject reviews
   - Manage access controls
   - System configuration

#### Route Protection Example:

```typescript
@Post('create')
@Roles(UserRole.HOSTEL_ADMIN, UserRole.SUPER_ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
create(@Body() createHostelDto: CreateHostelDto) {
  // Only HOSTEL_ADMIN or SUPER_ADMIN can access
}
```

### Password Security

- **Hashing Algorithm**: bcrypt with 10 salt rounds
- **Verification**: bcrypt.compare() on every login
- **Reset Token**: crypto.randomBytes(32) generated token
- **Expiry**: 24-hour validity on reset tokens
- **Transmission**: Tokens sent via email links, never stored in database permanently

### Email Verification

- **Purpose**: Confirm user email ownership
- **Token**: Cryptographically random 32-byte token
- **Expiry**: 24 hours from generation
- **Flow**: User registers → token sent via email → user clicks link → email verified
- **Status Update**: User status changes from `unverified` to `verified`

---

## Payment Integration

### Paystack Integration Architecture

```
┌─────────────────────────────────────────┐
│    Payment Initiation Request           │
│    POST /payment/initiate               │
│    { userId, amount, email }            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  PaymentsService                        │
│  - Validate amount                      │
│  - Check for active access              │
│  - Generate unique reference            │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  PaystackService                        │
│  - Initialize transaction API call      │
│  - Amount: GHS 38 (3800 pesewas)        │
│  - Reference: access_<timestamp>_<id>   │
└────────────┬────────────────────────────┘
             │ HTTPS Request
             ▼
┌─────────────────────────────────────────┐
│  Paystack API (https://api.paystack.co/)│
│  POST /transaction/initialize           │
│  Authorization: Bearer <SECRET_KEY>     │
└────────────┬────────────────────────────┘
             │ Response
             ▼
┌─────────────────────────────────────────┐
│  Payment Authorization URL              │
│  Returned to client                     │
└────────────┬────────────────────────────┘
             │ User redirected (external)
             ▼
┌─────────────────────────────────────────┐
│  Paystack Payment Gateway               │
│  (https://checkout.paystack.com/)       │
│  - User enters card details             │
│  - 3D Secure authentication (if needed) │
│  - Payment processed                    │
└────────────┬────────────────────────────┘
             │ Redirect to callback
             ▼
┌─────────────────────────────────────────┐
│  Callback Handler                       │
│  GET /payment/callback?reference=ref    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  PaystackService.verifyPayment()        │
│  - Call Paystack Verify API             │
│  - Get transaction status               │
│  - Validate amount matches              │
└────────────┬────────────────────────────┘
             │ Success
             ▼
┌─────────────────────────────────────────┐
│  Update Access Record                   │
│  - Set expires_at = now + 30 days       │
│  - Record paystack_reference            │
│  - Grant preview access                 │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  User Redirected to Success Page        │
│  Access granted for 30 days             │
└─────────────────────────────────────────┘
```

### Paystack API Integration

#### Environment Variables Required:

```
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
```

#### Transaction Initialization:

```typescript
POST https://api.paystack.co/transaction/initialize
Authorization: Bearer {PAYSTACK_SECRET_KEY}

Body: {
  "email": "customer@example.com",
  "amount": 3800,  // in pesewas (GHS 38.00)
  "reference": "access_1674820200_user-uuid",
  "callback_url": "https://backend.com/payment/callback?reference=..."
}

Response: {
  "status": true,
  "message": "Authorization URL created",
  "data": {
    "authorization_url": "https://checkout.paystack.com/...",
    "access_code": "...",
    "reference": "reference"
  }
}
```

#### Payment Verification:

```typescript
GET https://api.paystack.co/transaction/verify/{reference}
Authorization: Bearer {PAYSTACK_SECRET_KEY}

Response: {
  "status": true,
  "message": "Verification successful",
  "data": {
    "id": 123456,
    "reference": "reference",
    "amount": 3800,
    "status": "success",
    "paid_at": "2026-01-27T10:30:00Z",
    "customer": {
      "id": 456789,
      "email": "customer@example.com",
      ...
    },
    "authorization": {
      "authorization_code": "...",
      "bin": "412345",
      "last4": "1234",
      ...
    }
  }
}
```

### Payment Status Tracking

**Booking Payment Status Enum:**

- `PENDING`: Awaiting payment
- `PARTIAL`: Some amount paid, balance due
- `PAID`: Full amount received
- `CANCELLED`: Payment cancelled by user
- `OVERDUE`: Due date passed without payment

**Payment Record Fields:**

```typescript
{
  id: UUID,
  booking_id: UUID,
  amount: Decimal,
  payment_method: 'bank_transfer' | 'mobile_money' | 'card' | 'cash',
  payment_type: 'booking_payment' | 'deposit' | 'refund' | 'penalty',
  transaction_ref: String (Paystack reference),
  payment_date: Timestamp,
  received_by: String (Admin name),
  metadata: {
    // Custom fields for tracking
    student_name: String,
    room_number: String,
    // ... additional context
  }
}
```

---

## Third-Party Integrations

### 1. **Cloudinary** - Image Management

**Purpose**: Cloud storage and CDN for hostel and review images

**Configuration**:

```typescript
CLOUDINARY_CLOUD_NAME = xxxxx;
CLOUDINARY_API_KEY = xxxxx;
CLOUDINARY_API_SECRET = xxxxx;
```

**Usage**:

```typescript
// Upload image
const url = await cloudinaryService.uploadImage(file);
// Returns: https://res.cloudinary.com/xxxxx/image/upload/v1234/hostels/xxxxx.jpg

// Delete image
await cloudinaryService.deleteImage(publicId);
```

**Features**:

- Automatic image optimization
- CDN distribution
- Transformations (resize, crop, filters)
- Version tracking

---

### 2. **Resend** - Email Delivery

**Purpose**: Transactional email service for verification, password reset, notifications

**Configuration**:

```typescript
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

**Templates**:

- `verify.html`: Email verification
- `reset.html`: Password reset
- `booking-confirmation.html`: Booking confirmation
- `payment-reminder.html`: Payment due notice

**Implementation**:

```typescript
const { data, error } = await resend.emails.send({
  from: 'Acme <onboarding@resend.dev>',
  to: 'delivered@resend.dev',
  subject: 'Hello World',
  html: '<strong>It works!</strong>',
});
```

---

### 3. **Supabase** - Database & Auth

**Purpose**: PostgreSQL database hosting and optional auth layer

**Configuration**:

```typescript
SUPABASE_DB_URL=postgresql://user:password@db.supabase.co:5432/postgres
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

**Database Connection**:

- TypeORM connects via SUPABASE_DB_URL
- Auto-loads entities (synchronize: false - migrations manual)
- PostGIS extension enabled for geospatial queries

---

### 4. **Sentry** - Error Tracking & Monitoring

**Purpose**: Real-time error tracking and performance monitoring

**Configuration**:

```typescript
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ENVIRONMENT=production
```

**Integration**:

- Global error filter captures all exceptions
- Performance monitoring for slow requests
- Session replay for debugging
- Alert notifications

---

### 5. **PDF Kit** - Invoice Generation

**Purpose**: Generate payment invoices and booking receipts as PDFs

**Usage**:

```typescript
const doc = new PDFDocument();
doc.fontSize(25).text('Invoice');
doc.fontSize(12).text(`Amount: GHS ${booking.totalAmount}`);
// ... write to file or buffer
```

---

## Environment Configuration

### Environment Variables

Create `.env` file in project root (not committed to git):

```bash
# Application
PORT=1000
NODE_ENV=development
LOG_LEVEL=debug

# Database
SUPABASE_DB_URL=postgresql://user:password@db.supabase.co:5432/postgres

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRY=24h

# Supabase
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Resend Email
RESEND_API_KEY=re_your_api_key
EMAIL_FROM=noreply@yourdomain.com

# Paystack
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx

# Sentry
SENTRY_DSN=https://xxxxx@sentry.io/project_id
SENTRY_ENVIRONMENT=development

# URLs
FRONTEND_URL=http://localhost:3000
ADMIN_FRONTEND_URL=http://localhost:3001

# Booking Configuration
BOOKING_FEE=70
ACCESS_PRICE=38
ACCESS_DAYS=30
```

### ConfigModule Integration

```typescript
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

---

## Development & Deployment

### Local Development Setup

#### Prerequisites:

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

#### Installation:

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Update .env with local database URL
SUPABASE_DB_URL=postgresql://localhost/ah_backend

# Run database migrations (if applicable)
npm run typeorm migration:run

# Start development server
npm run start:dev

# Server runs on http://localhost:1000
```

#### Available Scripts:

| Script          | Command               | Purpose                          |
| --------------- | --------------------- | -------------------------------- |
| **build**       | `npm run build`       | Compile TypeScript to JavaScript |
| **start**       | `npm start`           | Run production build             |
| **start:dev**   | `npm run start:dev`   | Hot-reload development mode      |
| **start:debug** | `npm run start:debug` | Debug mode with inspector        |
| **start:prod**  | `npm run start:prod`  | Production mode (dist/main.js)   |
| **lint**        | `npm run lint`        | Fix ESLint issues                |
| **format**      | `npm run format`      | Format code with Prettier        |
| **test**        | `npm test`            | Run unit tests                   |
| **test:watch**  | `npm run test:watch`  | Watch mode for tests             |
| **test:cov**    | `npm run test:cov`    | Generate coverage report         |
| **test:e2e**    | `npm run test:e2e`    | Run end-to-end tests             |
| **test:debug**  | `npm run test:debug`  | Debug unit tests                 |

### Docker Deployment

**Dockerfile** (example):

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 1000

CMD ["node", "dist/main.js"]
```

**docker-compose.yml** (with PostgreSQL):

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - '1000:1000'
    environment:
      SUPABASE_DB_URL: postgres://user:password@db:5432/ah_backend
      JWT_SECRET: your_secret
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: ah_backend
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Production Deployment

#### Best Practices:

1. **Environment Security**:
   - Use secrets management (AWS Secrets Manager, Azure Key Vault)
   - Never commit `.env` files
   - Rotate keys regularly

2. **Performance**:
   - Enable caching (Redis for sessions)
   - Use CDN for static assets (Cloudinary)
   - Database connection pooling

3. **Monitoring**:
   - Set up Sentry error tracking
   - Enable application logs
   - Monitor database performance

4. **Deployment**:
   - Use managed PostgreSQL (Supabase, AWS RDS)
   - Deploy to containerized environments (Docker, Kubernetes)
   - Enable auto-scaling
   - Use CI/CD pipeline (GitHub Actions, GitLab CI)

#### Example GitHub Actions CI/CD:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to production
        if: github.ref == 'refs/heads/main'
        run: |
          # Deploy commands (Vercel, Heroku, AWS, etc.)
```

---

## Error Handling & Monitoring

### Global Exception Filter

```typescript
// instrument.ts - Sentry setup
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### Custom Exception Classes

```typescript
// Common exceptions
export class PaymentException extends HttpException {}
export class BookingException extends HttpException {}
export class HostelException extends HttpException {}
export class ValidationException extends HttpException {}
```

### Error Response Examples

**Validation Error**:

```json
{
  "status": 422,
  "error": "ValidationException",
  "message": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Must be at least 8 characters"
    }
  ]
}
```

**Authorization Error**:

```json
{
  "status": 403,
  "error": "ForbiddenException",
  "message": "You do not have permission to access this resource"
}
```

**Payment Error**:

```json
{
  "status": 400,
  "error": "PaymentException",
  "message": "Payment verification failed",
  "details": {
    "reason": "Amount mismatch",
    "expected": 3800,
    "received": 3500
  }
}
```

---

## Security Considerations

### Authentication & Authorization

- ✅ JWT tokens with 24-hour expiry
- ✅ bcrypt password hashing (10 rounds)
- ✅ Role-based access control (RBAC)
- ✅ Secure password reset tokens
- ✅ Email verification before account activation

### Data Protection

- ✅ HTTPS/TLS for all communications
- ✅ PostgreSQL encryption at rest (Supabase)
- ✅ PII handling compliant with data protection regulations
- ✅ Secure file uploads with validation
- ✅ CORS properly configured

### API Security

- ✅ Helmet middleware for HTTP headers
- ✅ Rate limiting (100 requests/60 seconds)
- ✅ Input validation with class-validator
- ✅ SQL injection prevention (TypeORM parameterized queries)
- ✅ XSS protection (output encoding)

### Sensitive Data

**Never log or expose:**

- Passwords or password hashes
- API keys (Paystack, Cloudinary, Resend)
- Full payment card information
- Verification tokens in logs
- Database connection strings in client responses

### Audit Logging

Recommended fields to log:

```typescript
{
  timestamp: Date,
  userId: UUID,
  action: String, // 'LOGIN', 'CREATE_BOOKING', 'VERIFY_PAYMENT'
  resource: String, // 'User', 'Booking', 'Payment'
  resourceId: UUID,
  result: 'SUCCESS' | 'FAILURE',
  ipAddress: String,
  userAgent: String
}
```

---

## Appendix: Quick Reference

### Core Dependencies

```json
{
  "@nestjs/common": "11.1.5",
  "@nestjs/core": "11.1.5",
  "@nestjs/jwt": "11.0.0",
  "@nestjs/typeorm": "11.0.0",
  "typeorm": "0.3.25",
  "bcrypt": "6.0.0",
  "class-validator": "0.14.2",
  "cloudinary": "2.7.0",
  "resend": "6.2.2",
  "axios": "1.10.0",
  "@sentry/nestjs": "10.37.0"
}
```

### Key Configuration Files

- [tsconfig.json](tsconfig.json): TypeScript compilation settings
- [nest-cli.json](nest-cli.json): NestJS CLI configuration
- [eslint.config.mjs](eslint.config.mjs): ESLint rules
- [package.json](package.json): Dependencies and scripts

### Documentation References

- [NestJS Docs](https://docs.nestjs.com)
- [TypeORM Docs](https://typeorm.io)
- [Passport.js](https://www.passportjs.org)
- [Swagger/OpenAPI](https://swagger.io)
- [Paystack API](https://paystack.com/docs)
- [Cloudinary API](https://cloudinary.com/documentation)
- [Resend Docs](https://resend.com/docs)

---

## Document Information

**Document Version**: 1.0  
**Last Updated**: January 27, 2026  
**Author**: Architecture Team  
**Status**: Active - Production Ready

For questions or updates, please contact the development team or create an issue in the repository.

---

**End of Technical Architecture Document**
