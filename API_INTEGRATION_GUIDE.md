# AH-Backend: API Integration & Examples Guide

## Authentication Flow Example

### 1. User Registration

**Request:**

```bash
curl -X POST http://localhost:1000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "phone": "+233501234567",
    "gender": "male",
    "school_id": "school-uuid-here",
    "terms_accepted": true
  }'
```

**Response (201 Created):**

```json
{
  "status": 201,
  "success": true,
  "message": "Registration successful. Check your email for verification.",
  "data": {
    "id": "user-uuid-123",
    "email": "student@example.com",
    "name": "John Doe",
    "is_verified": false,
    "role": "student",
    "created_at": "2026-01-27T10:30:00Z"
  }
}
```

### 2. Email Verification

**Request:**

```bash
curl -X POST http://localhost:1000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "verification-token-from-email"
  }'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "id": "user-uuid-123",
    "email": "student@example.com",
    "is_verified": true
  }
}
```

### 3. Login

**Request:**

```bash
curl -X POST http://localhost:1000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid-123",
      "email": "student@example.com",
      "name": "John Doe",
      "role": "student",
      "school_id": "school-uuid",
      "is_verified": true
    }
  }
}
```

### 4. Access Protected Route

All subsequent requests require the JWT token in Authorization header:

```bash
curl -X GET http://localhost:1000/auth/user-profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Hostel Management Examples

### Create Hostel (Hostel Admin Only)

**Request:**

```bash
curl -X POST http://localhost:1000/hostels/create \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sky Haven Hostel",
    "email": "info@skyhaven.com",
    "phone": "+233501234567",
    "SecondaryNumber": "+233501234568",
    "description": "Premium student hostel near Legon Campus",
    "address": "Plot 123, Osu, Accra",
    "location": "POINT(-0.1876 5.6037)",
    "adminId": "admin-user-uuid",
    "amenities": {
      "wifi": true,
      "laundry": true,
      "cafeteria": true,
      "parking": true,
      "security": true,
      "gym": true,
      "studyRoom": true,
      "kitchen": true,
      "ac": true,
      "generator": true
    },
    "base_price": 500,
    "payment_method": "both",
    "bank_details": {
      "bank_name": "GCB Bank",
      "account_name": "Sky Haven Hostel",
      "account_number": "1234567890",
      "branch": "Osu Branch"
    },
    "momo_details": {
      "provider": "MTN",
      "number": "024123456",
      "name": "Sky Haven"
    },
    "max_occupancy": 150,
    "house_rules": "No loud music after 10pm. Guests only. Valid ID required.",
    "nearby_facilities": ["Legon Campus", "Accra Mall", "Osu High Street"],
    "check_in_time": "14:00",
    "check_out_time": "11:00"
  }'
```

**Response (201 Created):**

```json
{
  "status": 201,
  "success": true,
  "message": "Hostel created successfully",
  "data": {
    "id": "hostel-uuid-456",
    "name": "Sky Haven Hostel",
    "email": "info@skyhaven.com",
    "adminId": "admin-user-uuid",
    "base_price": 500,
    "payment_method": "both",
    "created_at": "2026-01-27T11:00:00Z"
  }
}
```

### Get All Hostels (Public)

**Request:**

```bash
curl -X GET "http://localhost:1000/hostels/all?page=1&limit=20" \
  -H "Content-Type: application/json"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "items": [
      {
        "id": "hostel-uuid-456",
        "name": "Sky Haven Hostel",
        "email": "info@skyhaven.com",
        "phone": "+233501234567",
        "address": "Plot 123, Osu, Accra",
        "amenities": {...},
        "base_price": 500,
        "location": "POINT(-0.1876 5.6037)",
        "images": [
          "https://res.cloudinary.com/xxxxx/image/upload/v1/hostels/image1.jpg",
          "https://res.cloudinary.com/xxxxx/image/upload/v1/hostels/image2.jpg"
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

---

## Room Management Examples

### Create Room

**Request:**

```bash
curl -X POST http://localhost:1000/rooms/create \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "hostel_id": "hostel-uuid-456",
    "room_type_id": "room-type-uuid-789",
    "room_number": "101",
    "floor": 1,
    "max_occupancy": 2,
    "notes": "Newly renovated with AC"
  }'
```

**Response (201 Created):**

```json
{
  "status": 201,
  "success": true,
  "data": {
    "id": "room-uuid-001",
    "hostel_id": "hostel-uuid-456",
    "room_number": "101",
    "status": "available",
    "current_occupancy": 0,
    "max_occupancy": 2
  }
}
```

### Check Room Availability

**Request:**

```bash
curl -X GET "http://localhost:1000/rooms/room-uuid-001/availability?check_in=2026-02-01&check_out=2026-05-30"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "room_id": "room-uuid-001",
    "is_available": true,
    "current_occupancy": 0,
    "max_occupancy": 2,
    "remaining_capacity": 2,
    "conflicting_bookings": []
  }
}
```

---

## Booking Examples

### Create Booking

**Request:**

```bash
curl -X POST http://localhost:1000/bookings/create \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "room-uuid-001",
    "hostel_id": "hostel-uuid-456",
    "check_in_date": "2026-02-01",
    "check_out_date": "2026-05-30",
    "booking_type": "semester",
    "student_name": "John Doe",
    "student_email": "john@example.com",
    "student_phone": "+233501234567"
  }'
```

**Response (201 Created):**

```json
{
  "status": 201,
  "success": true,
  "data": {
    "id": "booking-uuid-101",
    "room_id": "room-uuid-001",
    "student_id": "user-uuid-123",
    "booking_type": "semester",
    "status": "pending",
    "payment_status": "pending",
    "check_in_date": "2026-02-01",
    "check_out_date": "2026-05-30",
    "total_amount": 570,
    "booking_fee": 70,
    "amount_paid": 0,
    "amount_due": 570,
    "created_at": "2026-01-27T12:00:00Z"
  }
}
```

### Confirm Booking (After Payment)

**Request:**

```bash
curl -X PATCH http://localhost:1000/bookings/booking-uuid-101/confirm \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "payment_method": "card",
    "deposit_amount": 100
  }'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "id": "booking-uuid-101",
    "status": "confirmed",
    "payment_status": "paid",
    "deposit_amount": 100,
    "amount_paid": 570
  }
}
```

### Check In

**Request (Admin Only):**

```bash
curl -X PATCH http://localhost:1000/bookings/booking-uuid-101/check-in \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "occupants": ["John Doe"],
    "notes": "Early check-in approved"
  }'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "id": "booking-uuid-101",
    "status": "checked_in",
    "check_in_date": "2026-02-01",
    "room": {
      "current_occupancy": 1,
      "max_occupancy": 2
    }
  }
}
```

### Get Booking Details

**Request:**

```bash
curl -X GET http://localhost:1000/bookings/booking-uuid-101 \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "id": "booking-uuid-101",
    "student_name": "John Doe",
    "student_email": "john@example.com",
    "hostel": {
      "id": "hostel-uuid-456",
      "name": "Sky Haven Hostel"
    },
    "room": {
      "id": "room-uuid-001",
      "room_number": "101"
    },
    "booking_type": "semester",
    "status": "checked_in",
    "payment_status": "paid",
    "check_in_date": "2026-02-01",
    "check_out_date": "2026-05-30",
    "total_amount": 570,
    "booking_fee": 70,
    "deposit_amount": 100,
    "amount_paid": 570,
    "amount_due": 0,
    "payments": [
      {
        "id": "payment-uuid",
        "amount": 570,
        "payment_method": "card",
        "transaction_ref": "access_1674820200_user123",
        "payment_date": "2026-01-27T12:30:00Z"
      }
    ]
  }
}
```

---

## Payment Examples

### Initiate Payment

**Request:**

```bash
curl -X POST http://localhost:1000/payment/initiate \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 3800,
    "email": "student@example.com"
  }'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "authorization_url": "https://checkout.paystack.com/1234567890",
    "reference": "access_1674820200_user-uuid-123"
  }
}
```

User is redirected to Paystack checkout URL.

### Payment Callback Handler

After payment, Paystack redirects to:

```
{FRONTEND_URL}/payment/callback?reference=access_1674820200_user-uuid-123
```

Frontend calls backend to verify:

```bash
curl -X POST http://localhost:1000/payment/verify \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "access_1674820200_user-uuid-123",
    "expectedAmount": 3800
  }'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "verified": true,
    "reference": "access_1674820200_user-uuid-123",
    "amount": 3800,
    "transaction_status": "success",
    "access_granted": true,
    "expires_at": "2026-02-27T12:00:00Z"
  }
}
```

### Get Payment History

**Request:**

```bash
curl -X GET http://localhost:1000/payment/history/booking-uuid-101 \
  -H "Authorization: Bearer {JWT_TOKEN}"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "booking_id": "booking-uuid-101",
    "total_amount": 570,
    "amount_paid": 570,
    "amount_due": 0,
    "payments": [
      {
        "id": "payment-uuid-1",
        "amount": 500,
        "payment_method": "card",
        "payment_type": "booking_payment",
        "transaction_ref": "access_1674820200_user123",
        "payment_date": "2026-01-27T12:30:00Z",
        "status": "paid"
      },
      {
        "id": "payment-uuid-2",
        "amount": 70,
        "payment_method": "bank_transfer",
        "payment_type": "booking_payment",
        "payment_date": "2026-01-28T09:00:00Z",
        "received_by": "admin@example.com",
        "status": "paid"
      }
    ]
  }
}
```

---

## Review Examples

### Submit Review

**Request:**

```bash
curl -X POST http://localhost:1000/review/create \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "hostel_id": "hostel-uuid-456",
    "booking_id": "booking-uuid-101",
    "rating": 4,
    "review_text": "Great hostel with excellent facilities and friendly staff. The location is perfect for campus access.",
    "detailed_ratings": {
      "cleanliness": 5,
      "security": 4,
      "location": 5,
      "staff": 4,
      "facilities": 4,
      "valueForMoney": 3
    },
    "images": []
  }'
```

**Response (201 Created):**

```json
{
  "status": 201,
  "success": true,
  "data": {
    "id": "review-uuid-001",
    "hostel_id": "hostel-uuid-456",
    "student_name": "John Doe",
    "rating": 4,
    "status": "pending",
    "review_text": "Great hostel with excellent facilities...",
    "created_at": "2026-01-27T14:00:00Z"
  }
}
```

### Get Hostel Reviews (Public)

**Request:**

```bash
curl -X GET "http://localhost:1000/review/hostel/hostel-uuid-456?page=1&limit=10"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid-001",
        "student_name": "John Doe",
        "rating": 4,
        "review_text": "Great hostel...",
        "detailed_ratings": {
          "cleanliness": 5,
          "security": 4,
          "location": 5,
          "staff": 4,
          "facilities": 4,
          "valueForMoney": 3
        },
        "helpful_count": 12,
        "status": "approved",
        "created_at": "2026-01-27T14:00:00Z",
        "hostel_response": "Thank you for your feedback! We're glad you enjoyed your stay.",
        "hostel_responded_at": "2026-01-28T10:00:00Z"
      }
    ],
    "rating_stats": {
      "overall_rating": 4.3,
      "total_reviews": 24,
      "rating_distribution": {
        "5": 12,
        "4": 7,
        "3": 4,
        "2": 1,
        "1": 0
      }
    },
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 24
    }
  }
}
```

### Approve Review (Admin)

**Request:**

```bash
curl -X PATCH http://localhost:1000/review/review-uuid-001/approve \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_notes": "Review verified and appropriate for public display"
  }'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "id": "review-uuid-001",
    "status": "approved",
    "moderated_by": "admin-uuid",
    "moderated_at": "2026-01-28T09:30:00Z"
  }
}
```

### Mark Review as Helpful

**Request:**

```bash
curl -X POST http://localhost:1000/review/review-uuid-001/helpful \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "id": "review-uuid-001",
    "helpful_count": 13
  }
}
```

---

## Error Response Examples

### Validation Error (422)

**Request:**

```bash
curl -X POST http://localhost:1000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid-email",
    "password": "123"
  }'
```

**Response (422 Unprocessable Entity):**

```json
{
  "status": 422,
  "success": false,
  "error": "ValidationException",
  "message": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Email must be a valid email"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

### Unauthorized (401)

**Request (Missing JWT):**

```bash
curl -X GET http://localhost:1000/auth/user-profile
```

**Response (401 Unauthorized):**

```json
{
  "status": 401,
  "success": false,
  "error": "UnauthorizedException",
  "message": "Missing or invalid authentication token"
}
```

### Forbidden (403)

**Request (Insufficient Role):**

```bash
curl -X POST http://localhost:1000/hostels/create \
  -H "Authorization: Bearer {STUDENT_JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d {...}
```

**Response (403 Forbidden):**

```json
{
  "status": 403,
  "success": false,
  "error": "ForbiddenException",
  "message": "You do not have permission to access this resource. Required role: hostel_admin"
}
```

### Not Found (404)

**Request:**

```bash
curl -X GET http://localhost:1000/hostels/nonexistent-id
```

**Response (404 Not Found):**

```json
{
  "status": 404,
  "success": false,
  "error": "NotFoundException",
  "message": "Hostel not found"
}
```

### Conflict (409)

**Request (Duplicate Email):**

```bash
curl -X POST http://localhost:1000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "existing@example.com",
    "password": "SecurePass123!"
  }'
```

**Response (409 Conflict):**

```json
{
  "status": 409,
  "success": false,
  "error": "ConflictException",
  "message": "User with this email already exists"
}
```

### Rate Limit (429)

**Response (429 Too Many Requests):**

```json
{
  "status": 429,
  "success": false,
  "error": "ThrottlerException",
  "message": "Too many requests, please try again later",
  "retry_after": 45
}
```

---

## Admin Operations Examples

### Get Dashboard Statistics

**Request:**

```bash
curl -X GET http://localhost:1000/admin/dashboard \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "summary": {
      "total_hostels": 25,
      "total_rooms": 342,
      "total_bookings": 1250,
      "total_users": 3450,
      "total_revenue": 125750.5
    },
    "occupancy": {
      "occupied_rooms": 287,
      "available_rooms": 55,
      "occupancy_rate": 0.84
    },
    "bookings": {
      "confirmed": 234,
      "checked_in": 287,
      "pending": 45,
      "cancelled": 12,
      "no_show": 5
    },
    "payments": {
      "total_paid": 98450.0,
      "total_pending": 27300.5,
      "total_overdue": 3500.0
    },
    "recent_bookings": [
      {
        "id": "booking-uuid",
        "hostel": "Sky Haven Hostel",
        "student": "John Doe",
        "check_in": "2026-02-01",
        "amount": 570,
        "status": "confirmed"
      }
    ]
  }
}
```

### Get Revenue Report

**Request:**

```bash
curl -X GET "http://localhost:1000/admin/revenue-report?start_date=2026-01-01&end_date=2026-01-31" \
  -H "Authorization: Bearer {ADMIN_JWT_TOKEN}"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "period": {
      "start_date": "2026-01-01",
      "end_date": "2026-01-31"
    },
    "summary": {
      "total_revenue": 45300.0,
      "total_bookings": 450,
      "average_booking_value": 100.67,
      "growth_rate": 0.15
    },
    "by_hostel": [
      {
        "hostel_id": "hostel-uuid-456",
        "hostel_name": "Sky Haven Hostel",
        "revenue": 12450.0,
        "bookings": 125,
        "average_booking_value": 99.6
      }
    ],
    "by_payment_method": {
      "card": 22150.0,
      "bank_transfer": 15600.0,
      "mobile_money": 7550.0
    },
    "daily_breakdown": [
      {
        "date": "2026-01-01",
        "revenue": 1450.0,
        "bookings": 15
      }
    ]
  }
}
```

---

## Pagination Examples

All list endpoints support pagination:

**Request:**

```bash
curl -X GET "http://localhost:1000/hostels/all?page=2&limit=20&sort=created_at&order=desc"
```

**Response:**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 2,
      "limit": 20,
      "total": 245,
      "pages": 13,
      "has_next": true,
      "has_prev": true
    }
  }
}
```

**Query Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `sort`: Field to sort by (default: created_at)
- `order`: Sort order (asc, desc)

---

## File Upload Example

### Upload Hostel Images

**Request (Multipart Form Data):**

```bash
curl -X POST http://localhost:1000/hostels/hostel-uuid-456/upload-images \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg" \
  -F "images=@image3.png"
```

**Response (200 OK):**

```json
{
  "status": 200,
  "success": true,
  "data": {
    "hostel_id": "hostel-uuid-456",
    "images": [
      "https://res.cloudinary.com/xxxxx/image/upload/v1/hostels/image1.jpg",
      "https://res.cloudinary.com/xxxxx/image/upload/v1/hostels/image2.jpg",
      "https://res.cloudinary.com/xxxxx/image/upload/v2/hostels/image3.png"
    ]
  }
}
```

---

## WebSocket Integration (Future)

For real-time notifications, WebSocket support can be added:

```typescript
// Example structure
@WebSocketGateway()
export class NotificationsGateway {
  @SubscribeMessage('subscribe_booking')
  handleBookingSubscription(
    @MessageBody() data: { booking_id: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`booking_${data.booking_id}`);
  }

  // Emit real-time booking updates
  emitBookingUpdate(booking_id: string, update: any) {
    this.server.to(`booking_${booking_id}`).emit('booking_updated', update);
  }
}
```

---

## Rate Limiting

The API implements rate limiting:

- **Limit**: 100 requests per 60 seconds
- **Headers**:
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

**Example 429 Response:**

```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1674906660
```

---

**Last Updated**: January 27, 2026  
**Version**: 1.0  
**Status**: Ready for Integration
