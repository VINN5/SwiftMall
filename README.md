# 🛍 SwiftMall

A full-stack e-commerce platform built with **Flask** (backend) and **React + TypeScript** (frontend), designed for buyers, sellers, and admins.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Roles & Permissions](#roles--permissions)
- [Screenshots](#screenshots)

---

## Overview

SwiftMall is a multi-role marketplace where:

- **Buyers** browse products, manage orders, and maintain a wishlist
- **Sellers** list products and track sales
- **Admins** oversee the platform, approve seller applications, and manage users

---

## Features

### Buyer
- 🔐 Register & log in securely with JWT authentication
- 🛒 Browse and search products with filters and autocomplete
- 📦 Track orders by status (Processing, Shipped, Delivered, Cancelled)
- ♡ Save items to a wishlist
- 🔔 Receive notifications
- 📱 Mobile-first dashboard with bottom navigation

### Seller
- Apply to become a seller
- List and manage products

### Admin
- Approve or reject seller applications
- Manage users and platform settings

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | React 18, TypeScript, Vite          |
| Backend   | Python 3.x, Flask, Flask-CORS       |
| Database  | MongoDB Atlas                       |
| Auth      | JWT (PyJWT), bcrypt                 |
| Styling   | Inline CSS (mobile-first)           |

---

## Project Structure

```
SwiftMall/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # App factory, MongoDB connection
│   │   ├── auth_helpers.py      # JWT decode utility
│   │   └── routes/
│   │       ├── auth.py          # Register, login, seller application
│   │       ├── buyer.py         # Buyer profile, orders, wishlist, notifications
│   │       └── search.py        # Product search, suggestions, categories
│   ├── run.py                   # Entry point
│   ├── .env                     # Environment variables (not committed)
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   └── dashboards/
    │   │       └── BuyerDashboard.tsx
    │   ├── App.tsx              # Routes & ProtectedRoute
    │   └── main.tsx
    ├── index.html
    └── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/swiftmall.git
cd swiftmall
```

---

### 2. Set up the backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>
SECRET_KEY=your_super_secret_key
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=1440
```

Start the backend:

```bash
python run.py
# → Running at http://localhost:8000
```

---

### 3. Set up the frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
# → Running at http://localhost:5173
```

---

### 4. Open the app

Visit **http://localhost:5173** in your browser.  
Register a new account — the default role is **buyer**.

---

## Environment Variables

| Variable                          | Description                              | Example                    |
|-----------------------------------|------------------------------------------|----------------------------|
| `MONGO_URI`                       | MongoDB Atlas connection string          | `mongodb+srv://...`        |
| `SECRET_KEY`                      | Secret key for signing JWTs             | `my-secret-key`            |
| `JWT_ACCESS_TOKEN_EXPIRES_MINUTES`| Token expiry in minutes (default: 1440) | `1440`                     |

---

## API Reference

All routes are prefixed with `/api`.

### Auth

| Method | Endpoint               | Description              | Auth required |
|--------|------------------------|--------------------------|---------------|
| POST   | `/auth/register`       | Register a new user      | No            |
| POST   | `/auth/login`          | Log in, get JWT token    | No            |
| POST   | `/auth/apply-seller`   | Apply to become a seller | Yes           |

### Buyer

| Method | Endpoint                           | Description                  |
|--------|------------------------------------|------------------------------|
| GET    | `/buyer/me`                        | Get current buyer profile    |
| GET    | `/buyer/stats`                     | Orders, spent, wishlist count|
| GET    | `/buyer/orders`                    | List orders (filter by status)|
| GET    | `/buyer/wishlist`                  | Get wishlist items           |
| POST   | `/buyer/wishlist`                  | Add item to wishlist         |
| DELETE | `/buyer/wishlist/:id`              | Remove item from wishlist    |
| GET    | `/buyer/notifications`             | Get notifications            |
| PATCH  | `/buyer/notifications/read-all`    | Mark all notifications read  |

### Search

| Method | Endpoint                  | Description                          |
|--------|---------------------------|--------------------------------------|
| GET    | `/search/products`        | Search products with filters & paging|
| GET    | `/search/suggestions`     | Autocomplete suggestions (min 2 chars)|
| GET    | `/search/categories`      | List all product categories          |

**Search query parameters:**

| Param      | Default     | Description                                  |
|------------|-------------|----------------------------------------------|
| `q`        | —           | Search term                                  |
| `category` | —           | Filter by category                           |
| `min_price`| —           | Minimum price filter                         |
| `max_price`| —           | Maximum price filter                         |
| `sort`     | `relevance` | `relevance`, `price_asc`, `price_desc`, `newest` |
| `page`     | `1`         | Page number                                  |
| `per_page` | `20`        | Results per page (max 40)                    |

---

## Roles & Permissions

| Action                    | Buyer | Seller | Admin |
|---------------------------|:-----:|:------:|:-----:|
| Browse & search products  | ✅    | ✅     | ✅    |
| Place orders              | ✅    | ❌     | ❌    |
| Manage wishlist           | ✅    | ❌     | ❌    |
| List products             | ❌    | ✅     | ✅    |
| View sales dashboard      | ❌    | ✅     | ✅    |
| Approve seller requests   | ❌    | ❌     | ✅    |
| Manage all users          | ❌    | ❌     | ✅    |

---

## MongoDB Collections

SwiftMall uses the following collections:

| Collection    | Purpose                              |
|---------------|--------------------------------------|
| `users`       | User accounts and roles              |
| `products`    | Product listings                     |
| `orders`      | Buyer orders                         |
| `wishlist`    | Saved items per buyer                |
| `notifications` | User notifications                 |

**Minimum product document:**

```json
{
  "name": "Wireless Earbuds",
  "description": "Noise-cancelling Bluetooth earbuds",
  "price": 3500,
  "original_price": 4500,
  "category": "Electronics",
  "seller_name": "TechZone",
  "emoji": "🎧",
  "stock": 20,
  "is_active": true
}
```

---

## Common Issues

**SSL handshake error when connecting to MongoDB Atlas**

This can happen on Python 3.13 + Windows. Fix:

```bash
pip install certifi
```

Then update your `MongoClient` call:

```python
import certifi
client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
```

If it still fails, check that:
1. Your IP is whitelisted in **Atlas → Network Access**
2. Your cluster is not **paused** (free tier clusters pause after inactivity)

---

*Built with ❤️ using Flask + React*
