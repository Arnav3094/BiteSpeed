# Bitespeed Identity Reconciliation

A web service that identifies and links customer contact information across multiple purchases.

## Live Endpoint

`POST https://<your-hosted-url>/identify`

## API

### POST `/identify`

**Request body** (at least one field required):

```json
{
  "email": "user@example.com",
  "phoneNumber": "123456"
}
```

**Response:**

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["primary@example.com", "secondary@example.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Stack

- **Runtime:** Node.js + TypeScript (ESM)
- **Framework:** Express
- **ORM:** Prisma 7
- **Database:** PostgreSQL

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set `DATABASE_URL` in `.env`:

   ```txt
   DATABASE_URL="postgresql://user:password@host:5432/dbname"
   ```

3. Generate Prisma client and run migrations:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. Start the server:

   ```bash
   npm start
   ```

   Or in watch mode during development:

   ```bash
   npm run dev
   ```
