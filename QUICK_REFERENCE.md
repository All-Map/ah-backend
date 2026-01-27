# AH-Backend: Quick Reference Guide

## Project At-a-Glance

| Aspect              | Details                                |
| ------------------- | -------------------------------------- |
| **Framework**       | NestJS 11.1.5                          |
| **Language**        | TypeScript 5.7.3                       |
| **Database**        | PostgreSQL (Supabase)                  |
| **Runtime**         | Node.js 18+                            |
| **Port**            | 1000 (configurable via `PORT` env var) |
| **API Style**       | RESTful with Swagger documentation     |
| **Authentication**  | JWT + Passport.js                      |
| **Payment Gateway** | Paystack                               |
| **File Storage**    | Cloudinary                             |
| **Email Service**   | Resend                                 |
| **Error Tracking**  | Sentry                                 |
| **ORM**             | TypeORM 0.3.25                         |

---

## Core Features Summary

### 1. Authentication System

- **User Registration**: Email verification required
- **Login**: JWT token generation (24-hour expiry)
- **Roles**: Student, Hostel Admin, Super Admin
- **Password Security**: bcrypt hashing with 10 salt rounds
- **Email Verification**: Cryptographic tokens, 24-hour validity

### 2. Hostel Management

- Create/update/delete hostels
- Multi-image upload (Cloudinary)
- Amenities tracking (WiFi, laundry, parking, etc.)
- Location mapping (PostGIS geometry)
- Payment method configuration (bank/mobile money)

### 3. Room Management

- Dynamic room creation and capacity tracking
- Room status: available, occupied, maintenance, reserved
- Room type definitions (capacity, pricing)
- Occupancy management

### 4. Booking System

- **Booking Types**: Semester, Monthly, Weekly
- **Status Flow**: pending → confirmed → checked_in → checked_out
- **Payment Tracking**: Separate tracking for booking fee, deposit, amount due
- **Booking Fee**: Fixed GHS 70 per booking
- **Check-in/Check-out**: Admin operations with occupancy updates

### 5. Payment Processing

- **Gateway**: Paystack integration
- **Access Price**: GHS 38 for 30-day preview access
- **Transaction Tracking**: Reference-based verification
- **Methods**: Bank transfer, mobile money, card, cash
- **Payment Types**: booking payment, deposit, refund, penalty

### 6. Review & Rating System

- **Rating Scale**: 1-5 stars
- **Detailed Ratings**: cleanliness, security, location, staff, facilities, value
- **Moderation**: Admin approval workflow (pending → approved/rejected)
- **Responses**: Hostel admin can respond to reviews
- **Flagging**: Users can flag inappropriate content
- **Helpful Votes**: Community feedback on review usefulness

### 7. Admin Dashboard

- System statistics (revenue, occupancy, user metrics)
- Revenue reports and analytics
- Occupancy tracking
- User management
- Access control
- Booking management and overrides

---

## Database Entities (15 Total)

### Primary Entities

1. **users** - User accounts with roles and emergency contacts
2. **hostels** - Hostel properties with amenities and payments
3. **rooms** - Individual room instances with occupancy
4. **room_types** - Room type definitions with pricing
5. **bookings** - Booking records with full status tracking
6. **payments** - Payment transactions with method tracking
7. **reviews** - Student reviews with ratings and moderation
8. **schools** - School/institution data with geolocation

### Supporting Entities

9. **deposits** - Security deposit tracking
10. **feedback** - General user feedback
11. **public_feedback** - Public testimonials
12. **verification** - Email/password reset tokens
13. **admin_verification** - Admin account verification
14. **access** - Preview access and trial management
15. **preview_usage** - Feature access tracking

---

## API Endpoint Categories

### Authentication (`/auth`) - 8 endpoints

```
POST   /auth/register              - User registration
POST   /auth/register-student      - Student registration
POST   /auth/login                 - Login
GET    /auth/user-profile          - Get profile
PATCH  /auth/update-profile        - Update profile
POST   /auth/verify-email          - Verify email
POST   /auth/request-password-reset - Reset password email
POST   /auth/reset-password        - Reset password
```

### Hostels (`/hostels`) - 7 endpoints

```
POST   /hostels/create             - Create hostel
GET    /hostels/fetch              - Get user's hostels
GET    /hostels/all                - List all hostels
GET    /hostels/:id                - Get details
PATCH  /hostels/:id                - Update hostel
DELETE /hostels/:id                - Delete hostel
GET    /hostels/:id/contact        - Contact details
```

### Rooms (`/rooms`) - 5 endpoints

```
POST   /rooms/create               - Create room
GET    /rooms/hostel/:hostelId     - List hostel rooms
PATCH  /rooms/:id                  - Update room
GET    /rooms/:id/availability     - Check availability
POST   /rooms/bulk-create          - Create multiple
```

### Bookings (`/bookings`) - 11 endpoints

```
POST   /bookings/create            - Create booking
GET    /bookings/my-bookings       - Get student's bookings
GET    /bookings/:id               - Get details
PATCH  /bookings/:id/confirm       - Confirm
PATCH  /bookings/:id/cancel        - Cancel
PATCH  /bookings/:id/check-in      - Check in
PATCH  /bookings/:id/check-out     - Check out
PATCH  /bookings/:id/extend        - Extend dates
POST   /bookings/:id/verify-payment - Verify payment
GET    /bookings/hostel/:hostelId  - Get hostel bookings
GET    /bookings/report            - Generate report
```

### Payments (`/payment`) - 6 endpoints

```
POST   /payment/initiate           - Start payment
GET    /payment/callback           - Payment callback
POST   /payment/verify             - Verify payment
GET    /payment/history/:bookingId - Payment history
POST   /payment/refund             - Process refund
GET    /payment/invoice/:bookingId - Generate invoice
```

### Reviews (`/review`) - 9 endpoints

```
POST   /review/create              - Submit review
GET    /review/hostel/:hostelId    - Get hostel reviews
PATCH  /review/:id                 - Update draft
POST   /review/:id/submit          - Submit for moderation
PATCH  /review/:id/approve         - Approve (admin)
PATCH  /review/:id/reject          - Reject (admin)
POST   /review/:id/flag            - Flag content
POST   /review/:id/helpful         - Mark helpful
GET    /review/:hostelId/rating    - Rating stats
```

### Admin (`/admin`) - 6 endpoints

```
GET    /admin/dashboard            - Dashboard stats
GET    /admin/users                - List users
PATCH  /admin/users/:userId/role   - Change role
GET    /admin/revenue-report       - Revenue analytics
GET    /admin/occupancy-report     - Occupancy analytics
GET    /admin/bookings/report      - Booking report
```

---

## Key Services Architecture

### Service Dependencies

```
PaymentsService
├── PaystackService
├── AccessService
└── PreviewUsageService

BookingsService
├── PaymentRepository
├── RoomRepository
├── HostelRepository
├── PaystackService
└── DepositsService

HostelsService
├── CloudinaryService
└── RoomService

AuthService
├── SupabaseService
├── JwtService
└── MailService

ReviewService
└── MailService (for notifications)
```

---

## Environment Variables Reference

### Required

```bash
PORT=1000
NODE_ENV=development
SUPABASE_DB_URL=postgresql://...
JWT_SECRET=your_secret_key
```

### External Services

```bash
# Paystack
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxxxx
CLOUDINARY_API_KEY=xxxxx
CLOUDINARY_API_SECRET=xxxxx

# Resend Email
RESEND_API_KEY=re_xxxxx
EMAIL_FROM=noreply@yourdomain.com

# Sentry
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

### URLs

```bash
FRONTEND_URL=http://localhost:3000
ADMIN_FRONTEND_URL=http://localhost:3001
```

### Business Logic Constants

```bash
BOOKING_FEE=70              # GHS
ACCESS_PRICE=38             # GHS
ACCESS_DAYS=30              # Days
```

---

## Development Commands

```bash
# Install dependencies
npm install

# Development with hot reload
npm run start:dev

# Debug mode
npm run start:debug

# Production build
npm run build

# Run production
npm run start:prod

# Linting
npm run lint

# Code formatting
npm run format

# Run tests
npm test
npm run test:watch
npm run test:cov

# End-to-end tests
npm run test:e2e
```

---

## Authentication & Authorization Cheat Sheet

### User Roles & Permissions

| Endpoint       | Student | Hostel Admin | Super Admin |
| -------------- | ------- | ------------ | ----------- |
| Create hostel  | ❌      | ✅           | ✅          |
| Create booking | ✅      | ⚠️\*         | ✅          |
| Submit review  | ✅      | ✅           | ✅          |
| Approve review | ❌      | ❌           | ✅          |
| Manage users   | ❌      | ❌           | ✅          |
| View reports   | ❌      | ✅ (own)     | ✅ (all)    |

\*Hostel admin can create bookings on behalf of students

### JWT Token Claims

```typescript
{
  id: "uuid",
  email: "user@example.com",
  role: "student" | "hostel_admin" | "super_admin",
  school_id: "uuid",
  iat: 1674820200,
  exp: 1674906600
}
```

---

## Booking Status Flow

```
START (pending)
   ↓
CONFIRMED (user confirms, payment initiated)
   ↓
CHECKED_IN (admin marks check-in, room occupancy +1)
   ↓
CHECKED_OUT (admin marks check-out, room occupancy -1)
   ↓
END

OPTIONAL PATHS:
- pending → CANCELLED (before confirmation)
- confirmed → CANCELLED (before check-in)
- checked_in → NO_SHOW (if didn't check in properly)
```

---

## Payment Status Flow

```
START (pending)
   ↓
PARTIAL (partial payment received)
   ↓
PAID (full amount received)
   ↓
END

ALTERNATIVE PATHS:
- pending → CANCELLED
- pending/partial → OVERDUE (due date passed)
- paid → REFUNDED
```

---

## Common Error Codes

| Code | Error             | Cause                   | Solution              |
| ---- | ----------------- | ----------------------- | --------------------- |
| 400  | BAD_REQUEST       | Invalid input           | Check request format  |
| 401  | UNAUTHORIZED      | Missing/invalid JWT     | Login again           |
| 403  | FORBIDDEN         | Insufficient role       | Request elevated role |
| 404  | NOT_FOUND         | Resource doesn't exist  | Verify resource ID    |
| 409  | CONFLICT          | Resource already exists | Use PATCH to update   |
| 422  | VALIDATION_ERROR  | DTO validation failed   | Check field values    |
| 429  | TOO_MANY_REQUESTS | Rate limit exceeded     | Wait 60 seconds       |
| 500  | INTERNAL_ERROR    | Server error            | Check logs/Sentry     |

---

## File Upload

### Images (Hostels, Reviews)

- **Service**: CloudinaryService
- **Storage**: Cloudinary CDN
- **Max Size**: 5MB (typical)
- **Format**: JPG, PNG, WebP
- **Folder**: `/hostels/` or `/reviews/`
- **URL Format**: `https://res.cloudinary.com/xxxxx/image/upload/v1234/hostels/xxxxx.jpg`

---

## Notifications

### Automated Emails Sent

| Event                | Recipient | Template                  | Service |
| -------------------- | --------- | ------------------------- | ------- |
| Registration         | User      | verify.html               | Resend  |
| Email Verification   | User      | verify.html               | Resend  |
| Password Reset       | User      | reset.html                | Resend  |
| Booking Confirmation | Student   | booking-confirmation.html | Resend  |
| Payment Reminder     | Student   | payment-reminder.html     | Resend  |
| Check-in Reminder    | Student   | check-in.html             | Resend  |

---

## Database Connection Details

### TypeORM Configuration

```typescript
{
  type: 'postgres',
  url: process.env.SUPABASE_DB_URL,
  autoLoadEntities: true,
  synchronize: false,  // Migrations managed manually
  logging: process.env.NODE_ENV === 'development',
  maxConnections: 10
}
```

### Connection String Format

```
postgresql://username:password@host:port/database
```

### PostGIS Support

- Geometry types enabled for location-based queries
- SRID 4326 (WGS84) used for coordinates

---

## Testing

### Unit Tests

```bash
npm test
npm run test:watch      # Watch mode
npm run test:cov        # Coverage report
```

### E2E Tests

```bash
npm run test:e2e
```

### Test Structure

```
src/
├── module/
│   ├── module.service.spec.ts
│   ├── module.controller.spec.ts
│   └── ...
```

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Sentry DSN set
- [ ] SSL/HTTPS configured
- [ ] CORS origins whitelisted
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Backups scheduled
- [ ] CDN cache configured
- [ ] API documentation reviewed
- [ ] Security headers verified
- [ ] Error monitoring active

---

## Useful Links

| Resource       | URL                                  |
| -------------- | ------------------------------------ |
| NestJS Docs    | https://docs.nestjs.com              |
| TypeORM Docs   | https://typeorm.io                   |
| Paystack API   | https://paystack.com/docs            |
| Cloudinary API | https://cloudinary.com/documentation |
| Resend Email   | https://resend.com/docs              |
| Passport.js    | https://www.passportjs.org           |
| Swagger Editor | https://editor.swagger.io            |

---

## Project Structure Quick Navigate

```
src/
├── auth/              👤 Authentication & JWT
├── hostels/           🏢 Hostel management
├── rooms/             🚪 Room management
├── bookings/          📅 Booking system
├── payment/           💳 Payment processing
├── review/            ⭐ Reviews & ratings
├── admin/             👨‍💼 Admin operations
├── entities/          🗄️ Database models
├── mail/              📧 Email templates
├── cloudinary/        ☁️ Image storage
├── paystack/          🔄 Payment gateway
└── supabase/          🔐 Database service
```

---

## Performance Tips

- Use PostgreSQL indexes on frequently queried columns
- Cache hostel listings (minimal invalidation rate)
- Implement Redis for session storage
- Batch payment verification requests
- Compress images at upload (Cloudinary)
- Use connection pooling (already configured)
- Implement pagination for list endpoints (limit: 20)

---

## Security Reminders

✅ **Do**:

- Use HTTPS in production
- Rotate JWT secrets regularly
- Enable CORS for known domains only
- Hash passwords with bcrypt
- Validate all user inputs
- Use prepared statements (TypeORM)
- Log security events
- Monitor failed login attempts

❌ **Don't**:

- Commit `.env` files
- Log sensitive data
- Expose error details to clients
- Use plain text passwords
- Trust client-side validation alone
- Store tokens in localStorage (use httpOnly cookies)
- Skip email verification
- Allow SQL injection via search terms

---

**Last Updated**: January 27, 2026  
**Version**: 1.0
