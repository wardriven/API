# Interactions API

A Node.js/Express REST API that stores and retrieves client interaction records in MySQL, protected by per-client API keys.

---

## Stack

| Layer       | Technology               |
|-------------|--------------------------|
| Runtime     | Node.js ≥ 18             |
| Framework   | Express 4                |
| Database    | MySQL 8 / MariaDB 10.6+  |
| Auth        | API key (header-based)   |

---

## Quick Start

### 1 – Clone & install

```bash
npm install
```

### 2 – Configure environment

```bash
cp .env.example .env
# Edit .env with your MySQL credentials and a strong ADMIN_SECRET
```

### 3 – Initialise the database

```bash
mysql -u root -p < schema.sql
```

### 4 – Start the server

```bash
npm start          # production
npm run dev        # development (auto-reload with nodemon)
```

---

## Authentication

Every request to `/interactions` must include the client's API key:

```
X-API-Key: <your-api-key>
```

Admin endpoints (`/admin/*`) use a separate master secret instead:

```
X-Admin-Secret: <ADMIN_SECRET from .env>
```

---

## API Reference

### Health check

```
GET /health
```

Returns `{ status: "ok", timestamp: "..." }` — no auth required. Use this to verify the server is reachable.

---

### Interactions

#### Create an interaction

```
POST /interactions
X-API-Key: <key>
Content-Type: application/json

{
  "interaction_type":    "Meeting",
  "company_name":        "Acme Corp",
  "contact_person":      "Jane Smith",
  "interaction_details": "Discussed Q1 renewal terms.",
  "interaction_time":    "2024-03-15T14:30:00Z"
}
```

**Response 201**
```json
{ "message": "Interaction created.", "id": 42 }
```

---

#### List / search interactions

```
GET /interactions
X-API-Key: <key>
```

Optional query parameters:

| Param              | Description                           |
|--------------------|---------------------------------------|
| `company_name`     | Filter by exact company name          |
| `interaction_type` | Filter by exact type                  |
| `contact_person`   | Filter by exact contact name          |
| `from`             | ISO-8601 start of date range          |
| `to`               | ISO-8601 end of date range            |
| `limit`            | Max rows returned (default 100, max 1000) |
| `offset`           | Pagination offset (default 0)         |

**Example**
```
GET /interactions?company_name=Acme+Corp&from=2024-01-01T00:00:00Z&limit=20
```

**Response 200**
```json
{
  "total":  3,
  "limit":  20,
  "offset": 0,
  "data": [
    {
      "id": 42,
      "interaction_type":    "Meeting",
      "company_name":        "Acme Corp",
      "contact_person":      "Jane Smith",
      "interaction_details": "Discussed Q1 renewal terms.",
      "interaction_time":    "2024-03-15T14:30:00.000Z",
      "created_at":          "2024-03-15T15:00:00.000Z",
      "updated_at":          "2024-03-15T15:00:00.000Z"
    }
  ]
}
```

---

#### Get a single interaction

```
GET /interactions/:id
X-API-Key: <key>
```

---

#### Update an interaction

```
PUT /interactions/:id
X-API-Key: <key>
Content-Type: application/json

{
  "interaction_details": "Updated notes after follow-up call."
}
```

Only include the fields you wish to change.

---

#### Delete an interaction

```
DELETE /interactions/:id
X-API-Key: <key>
```

---

### Admin – API Key Management

All admin endpoints require `X-Admin-Secret: <ADMIN_SECRET>`.

#### List all keys

```
GET /admin/keys
```

#### Create a new key

```
POST /admin/keys
Content-Type: application/json

{ "label": "Client A – Production" }
```

**Response 201** — the `api_key` value is shown **once only**. Store it immediately.

```json
{
  "message": "API key created. Store it safely — it will not be shown again.",
  "id": 1,
  "label": "Client A – Production",
  "api_key": "a3f9...64-char-hex...7c2d"
}
```

#### Revoke a key (disables it, keeps record)

```
PATCH /admin/keys/:id/revoke
```

#### Re-activate a key

```
PATCH /admin/keys/:id/activate
```

#### Permanently delete a key

```
DELETE /admin/keys/:id
```

---

## Deployment Notes

- Run behind **HTTPS** (nginx / Caddy reverse proxy + Let's Encrypt).
- Use a dedicated MySQL user (`api_user`) with only `SELECT, INSERT, UPDATE, DELETE` on `interactions_db`.
- Set `ADMIN_SECRET` to a long random string (e.g. `openssl rand -hex 32`).
- Consider binding Express to `127.0.0.1` and letting nginx handle public traffic.

### Example nginx snippet

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
}
```
