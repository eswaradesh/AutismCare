<div align="center">
  <h1>🚀 AutismCare Therapy API</h1>
  <p><strong>FastAPI-powered Core Backend Services</strong></p>
  
  [![Python](https://img.shields.io/badge/Python-3.10+-blue.svg?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://postgresql.org)
  
</div>

---

## 🌟 Overview

The **AutismCare API** is a high-performance backend module built with **FastAPI** and **SQLAlchemy**. Initially introduced as part of the therapist-first architecture migration, this service handles direct database access, secure JWT-based authentication, and structured data handling.

> **Note:** This service is part of an ongoing architectural upgrade moving from direct frontend Supabase interactions to dedicated secure API routes.

## ✨ Features

- ⚡ **High Performance**: Asynchronous endpoints powered by FastAPI.
- 🗄️ **Robust ORM**: SQLAlchemy 2.0 integration for complex entity relationships.
- 🔐 **Custom Authentication**: Custom JWT-based stateless auth for enhanced scalability.
- 🩺 **Therapist Workflows**: Specialized routes tailored for therapist & patient administration.

## 🛠️ Architecture

```mermaid
graph LR
    Frontend[Frontend App] -->|HTTPS REST| FastAPI[FastAPI App]
    FastAPI -->|JWT| Auth[Authentication Layer]
    FastAPI -->|SQLAlchemy| DB[(PostgreSQL / Supabase DB)]
```

## 🚀 Setting Up Locally

### 1. Database Setup
Ensure PostgreSQL is running locally or connect to a remote Supabase instance.
To apply the backend schema:
```bash
# Execute the SQL schema against your local or remote database
psql -U your_user -d aucare -a -f schema.sql
```

### 2. Environment Variables
Create a `.env` file inside `backend/api` directly based on `.env.example`:
```env
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/aucare
JWT_SECRET=your-secure-jwt-secret-key
```

### 3. Install Requirements
Create a virtual environment and install the required dependencies:
```bash
python -m venv venv
# Windows: venv\Scripts\activate | Unix: source venv/bin/activate
pip install -r requirements.txt
```

### 4. Run the Server
Launch the development server with live-reloading:
```bash
uvicorn app.main:app --reload --port 8000
```
Visit the interactive API docs at [http://localhost:8000/docs](http://localhost:8000/docs).

## 📄 Main Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/therapist/children` | Fetch list of allocated patients |
| `GET` | `/therapist/children/{id}` | Access detailed child profile |
| `POST`| `/auth/login` | Obtain therapist JWT tokens |

---
*Built with ❤️ for better developmental care*
