# AH-Backend: Deployment & Operations Guide

## Deployment Environments

### Development Environment

**Database**: Local PostgreSQL or Supabase dev tier

```bash
# Setup
npm install
npm run start:dev

# Access
http://localhost:1000
```

### Staging Environment

**Database**: Supabase staging instance  
**URL**: https://staging-api.yourdomain.com  
**Branch**: develop

### Production Environment

**Database**: Supabase production instance  
**URL**: https://api.yourdomain.com  
**Branch**: main  
**SSL**: Required

---

## Pre-Deployment Checklist

### Security

- [ ] All API keys rotated and updated
- [ ] JWT_SECRET is strong and unique (32+ characters)
- [ ] CORS origins whitelist configured
- [ ] HTTPS/TLS certificate installed
- [ ] Rate limiting configured per environment
- [ ] Helmet middleware enabled
- [ ] CSRF protection in place
- [ ] SQL injection prevention verified (TypeORM parameterized queries)
- [ ] Sentry DSN configured for error tracking
- [ ] Logging sanitized (no passwords/secrets logged)

### Database

- [ ] Database backups configured and tested
- [ ] Connection pooling optimized
- [ ] Indexes created on frequently queried columns
- [ ] Database migrations applied successfully
- [ ] Data encryption at rest verified
- [ ] Replication configured (if applicable)

### Application

- [ ] Build compiles without errors
- [ ] All tests passing (unit + e2e)
- [ ] Code coverage acceptable (>80%)
- [ ] ESLint passes
- [ ] No console.log statements left
- [ ] Environment variables documented
- [ ] Dependencies up to date
- [ ] No deprecated packages

### Infrastructure

- [ ] DNS records configured
- [ ] CDN configured (Cloudinary for images)
- [ ] Email service configured (Resend)
- [ ] Payment gateway configured (Paystack - live keys)
- [ ] Monitoring and alerting configured
- [ ] Backup storage configured
- [ ] SSL certificate valid and auto-renewal enabled

### Documentation

- [ ] API documentation updated
- [ ] Deployment guide available
- [ ] Runbooks created for common issues
- [ ] Team trained on operations

---

## Docker Deployment

### Build Docker Image

```bash
# Build image
docker build -t ah-backend:1.0 .

# Tag for registry
docker tag ah-backend:1.0 registry.example.com/ah-backend:1.0

# Push to registry
docker push registry.example.com/ah-backend:1.0
```

### Docker Compose Stack

```yaml
version: '3.8'

services:
  app:
    image: registry.example.com/ah-backend:1.0
    ports:
      - '1000:1000'
    environment:
      NODE_ENV: production
      PORT: 1000
      SUPABASE_DB_URL: ${SUPABASE_DB_URL}
      JWT_SECRET: ${JWT_SECRET}
      PAYSTACK_SECRET_KEY: ${PAYSTACK_SECRET_KEY}
      CLOUDINARY_CLOUD_NAME: ${CLOUDINARY_CLOUD_NAME}
      CLOUDINARY_API_KEY: ${CLOUDINARY_API_KEY}
      CLOUDINARY_API_SECRET: ${CLOUDINARY_API_SECRET}
      RESEND_API_KEY: ${RESEND_API_KEY}
      SENTRY_DSN: ${SENTRY_DSN}
      FRONTEND_URL: https://app.yourdomain.com
      ADMIN_FRONTEND_URL: https://admin.yourdomain.com
    restart: always
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:1000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    restart: always
    networks:
      - app-network
    volumes:
      - redis-data:/data

  nginx:
    image: nginx:latest
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    restart: always
    depends_on:
      - app
    networks:
      - app-network

volumes:
  redis-data:

networks:
  app-network:
    driver: bridge
```

### Run Stack

```bash
# Create .env file with all variables
cp .env.example .env
# Edit .env with production values

# Start services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

---

## Kubernetes Deployment

### Deployment Manifest

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ah-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ah-backend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: ah-backend
    spec:
      containers:
        - name: ah-backend
          image: registry.example.com/ah-backend:1.0
          imagePullPolicy: Always
          ports:
            - containerPort: 1000
              name: http
          env:
            - name: NODE_ENV
              value: 'production'
            - name: SUPABASE_DB_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: jwt-secret
          # ... other environment variables
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health
              port: 1000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: 1000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 2

---
apiVersion: v1
kind: Service
metadata:
  name: ah-backend-service
  namespace: production
spec:
  type: LoadBalancer
  selector:
    app: ah-backend
  ports:
    - port: 80
      targetPort: 1000
      protocol: TCP

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ah-backend-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ah-backend
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace production

# Create secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url=$SUPABASE_DB_URL \
  --from-literal=jwt-secret=$JWT_SECRET \
  -n production

# Deploy
kubectl apply -f k8s-deployment.yaml

# Monitor rollout
kubectl rollout status deployment/ah-backend -n production

# View pods
kubectl get pods -n production

# View logs
kubectl logs -l app=ah-backend -n production --tail=100 -f
```

---

## CI/CD Pipeline Setup

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  REGISTRY: registry.example.com
  IMAGE_NAME: ah-backend

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint code
        run: npm run lint

      - name: Run tests
        run: npm test -- --coverage
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL_TEST }}
          JWT_SECRET: test-secret

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Build
        run: npm run build

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ secrets.REGISTRY_USERNAME }}
          password: ${{ secrets.REGISTRY_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-
            type=semver,pattern={{version}}

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: |
          # Trigger staging deployment
          curl -X POST ${{ secrets.STAGING_WEBHOOK }} \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"image":"${{ needs.build.outputs.image-tag }}"}'

  deploy-production:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://api.yourdomain.com
    steps:
      - name: Deploy to Production
        run: |
          # Trigger production deployment
          curl -X POST ${{ secrets.PRODUCTION_WEBHOOK }} \
            -H "Authorization: Bearer ${{ secrets.DEPLOY_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"image":"${{ needs.build.outputs.image-tag }}"}'

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ AH-Backend deployed to production",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Production Deployment Successful*\nCommit: ${{ github.sha }}\nAuthor: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Monitoring & Observability

### Sentry Configuration

```typescript
// instrument.ts
import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ request: true, serverName: false }),
  ],
  beforeSend(event) {
    // Filter out sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers['authorization'];
    }
    return event;
  },
});
```

### Application Metrics

Monitor these key metrics:

| Metric            | Target  | Alert Threshold |
| ----------------- | ------- | --------------- |
| CPU Usage         | < 70%   | > 85%           |
| Memory Usage      | < 60%   | > 80%           |
| API Response Time | < 200ms | > 500ms         |
| Error Rate        | < 0.1%  | > 1%            |
| Database Queries  | < 100ms | > 500ms         |
| Availability      | > 99.9% | < 99%           |

### Logging Configuration

```typescript
// logger.ts
import { Logger } from '@nestjs/common';

export class AppLogger {
  private logger = new Logger();

  logRequest(method: string, path: string, userId?: string) {
    this.logger.log(`${method} ${path}${userId ? ` [${userId}]` : ''}`);
  }

  logError(message: string, error: any, context?: string) {
    this.logger.error(message, error?.stack, context);
  }

  logPayment(bookingId: string, amount: number, status: string) {
    this.logger.log(
      `Payment: booking=${bookingId}, amount=${amount}, status=${status}`,
    );
  }
}
```

---

## Database Maintenance

### Backup Strategy

**Daily Backups:**

```bash
# Supabase handles automated daily backups
# Access via: https://app.supabase.com/project/[id]/settings/backups
```

**Manual Backup:**

```bash
# Export database
pg_dump -U postgres -h db.supabase.co dbname > backup.sql

# Restore database
psql -U postgres -h db.supabase.co dbname < backup.sql
```

### Database Optimization

```sql
-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_bookings_student_id ON bookings(student_id);
CREATE INDEX idx_bookings_hostel_id ON bookings(hostel_id);
CREATE INDEX idx_bookings_check_in_date ON bookings(check_in_date);
CREATE INDEX idx_reviews_hostel_id ON reviews(hostel_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_rooms_hostel_id ON rooms(hostel_id);
CREATE INDEX idx_rooms_status ON rooms(status);

-- Analyze query plans
EXPLAIN ANALYZE SELECT * FROM bookings
  WHERE student_id = 'user-uuid'
  ORDER BY created_at DESC;

-- Vacuum and analyze
VACUUM ANALYZE;
```

### Connection Pooling

```typescript
// typeorm.config.ts
{
  maxConnections: 10,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  connectionName: 'default',
  keepConnectionAlive: true,
}
```

---

## Troubleshooting Common Issues

### Issue: Connection Refused to Database

**Symptoms:**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**

1. Check database URL in .env
2. Verify Supabase service status
3. Check IP whitelist in Supabase console
4. Verify JWT secret in database
5. Restart container/application

**Debugging:**

```bash
# Test database connection
psql -U postgres -h db.supabase.co -d postgres -c "SELECT 1"

# Check application logs
docker logs ah-backend

# Verify environment variables
env | grep SUPABASE
```

### Issue: JWT Token Verification Fails

**Symptoms:**

```
Unauthorized: Invalid token signature
```

**Solutions:**

1. Verify JWT_SECRET matches
2. Check token expiry
3. Clear browser cache
4. Generate new token via login
5. Check token format (Bearer xxx)

**Test:**

```bash
curl -X GET http://localhost:1000/auth/user-profile \
  -H "Authorization: Bearer $(node -e "console.log(require('jsonwebtoken').sign({id:'test'}, 'secret'))")"
```

### Issue: Payment Verification Fails

**Symptoms:**

```
Paystack verification failed: Amount mismatch
```

**Solutions:**

1. Verify Paystack live keys (not test keys)
2. Check amount in pesewas (GHS 38 = 3800)
3. Verify webhook endpoint is accessible
4. Check Paystack transaction history
5. Review Paystack logs for failed callbacks

**Debug:**

```bash
# Test Paystack API
curl https://api.paystack.co/transaction/verify/reference \
  -H "Authorization: Bearer sk_live_xxxxx"

# Check recent transactions
# https://dashboard.paystack.com/transactions
```

### Issue: Email Not Sending

**Symptoms:**

```
Failed to send verification email
```

**Solutions:**

1. Verify RESEND_API_KEY is valid
2. Check EMAIL_FROM format
3. Verify recipient email is valid
4. Check Resend dashboard for bounces
5. Check application logs

**Test:**

```bash
# Test Resend API
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer re_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "delivered@resend.dev",
    "subject": "Hello",
    "html": "<strong>It works!</strong>"
  }'
```

### Issue: Image Upload Fails

**Symptoms:**

```
Cloudinary upload error: Invalid API key
```

**Solutions:**

1. Verify Cloudinary credentials
2. Check file size limit
3. Verify file format
4. Check Cloudinary account status
5. Review Cloudinary logs

**Debug:**

```bash
# Test Cloudinary upload
curl -X POST https://api.cloudinary.com/v1_1/cloud_name/image/upload \
  -F "file=@image.jpg" \
  -F "api_key=xxxxx" \
  -F "api_secret=xxxxx"
```

### Issue: High Memory Usage

**Symptoms:**

```
Container memory limit exceeded
```

**Solutions:**

1. Check for memory leaks (Sentry)
2. Increase memory limit
3. Review query performance
4. Enable pagination for large datasets
5. Implement caching (Redis)

**Monitor:**

```bash
# Check memory usage
docker stats ah-backend

# Profile application
node --prof index.js
```

### Issue: Slow API Responses

**Symptoms:**

```
Response time > 1 second
```

**Solutions:**

1. Check database query performance
2. Add database indexes
3. Implement caching
4. Check API rate limiting
5. Review server resources

**Profile:**

```bash
# Enable query logging
SET log_min_duration_statement = 1000;

# Analyze slow queries
SELECT query, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;
```

---

## Rollback Procedures

### Docker Rollback

```bash
# View deployment history
docker service ls

# Switch to previous image
docker service update --image registry.example.com/ah-backend:previous ah-backend

# Monitor rollback
docker service logs ah-backend
```

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/ah-backend -n production

# Rollback to previous version
kubectl rollout undo deployment/ah-backend -n production

# Rollback to specific revision
kubectl rollout undo deployment/ah-backend -n production --to-revision=2

# Check status
kubectl rollout status deployment/ah-backend -n production
```

### Database Rollback

```bash
# Restore from backup
pg_restore backup.sql

# Or restore specific tables
pg_restore -t bookings backup.sql
```

---

## Performance Optimization

### Query Optimization

```typescript
// Use eager loading to avoid N+1 queries
bookings.find({
  relations: ['payment', 'room', 'hostel'],
  where: { status: 'confirmed' },
});

// Use pagination
bookings.find({
  skip: (page - 1) * limit,
  take: limit,
  order: { created_at: 'DESC' },
});

// Select only needed columns
bookings.find({
  select: ['id', 'status', 'total_amount'],
});
```

### Caching Strategy

```typescript
// Cache hostel listings (30 minutes)
@Cacheable({ ttl: 30 * 60 })
async getAllHostels() {
  return this.hostelRepository.find();
}

// Cache booking by ID (5 minutes)
@Cacheable({ key: 'booking_{{ bookingId }}', ttl: 5 * 60 })
async getBooking(bookingId: string) {
  return this.bookingRepository.findOne(bookingId);
}
```

### CDN Configuration

```typescript
// Cache images from Cloudinary
app.use((req, res, next) => {
  if (
    req.path.includes('/cloudinary/') ||
    req.path.includes('cloudinary.com')
  ) {
    res.set('Cache-Control', 'public, max-age=31536000'); // 1 year
  }
  next();
});
```

---

## Disaster Recovery Plan

### RTO/RPO Targets

| Component   | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) |
| ----------- | ----------------------------- | ------------------------------ |
| Application | 5 minutes                     | Real-time (container restarts) |
| Database    | 15 minutes                    | 24 hours (daily backups)       |
| Data        | 1 hour                        | 1 day                          |

### Incident Response

**Outage Detected** → Alert triggered (Sentry/monitoring) → Paging on-call

**Steps:**

1. Identify root cause
2. Page incident commander
3. Assess impact (users affected, data at risk)
4. Execute remediation
5. Test recovery
6. Communicate to users
7. Post-incident review

---

## Runbooks

### Procedure: Emergency Restart

```bash
# 1. Stop all containers
docker-compose down

# 2. Remove corrupted data (if necessary)
docker volume rm ah-backend_data

# 3. Restart clean
docker-compose up -d

# 4. Verify health
curl http://localhost:1000/health

# 5. Monitor logs
docker-compose logs -f
```

### Procedure: Database Emergency Restore

```bash
# 1. Create new database
CREATE DATABASE ah_backend_restore;

# 2. Restore from backup
pg_restore -U postgres -d ah_backend_restore backup.sql

# 3. Verify data integrity
SELECT COUNT(*) FROM bookings;

# 4. Switch connection string
UPDATE .env: SUPABASE_DB_URL=...restore_instance...

# 5. Restart application
docker-compose restart app

# 6. Verify connections
curl http://localhost:1000/health
```

---

**Last Updated**: January 27, 2026  
**Version**: 1.0  
**Maintenance**: Reviewed quarterly
