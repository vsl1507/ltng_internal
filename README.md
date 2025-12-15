# LTNG Internal API

A robust RESTful API for managing Facebook accounts with features like filtering, pagination, bulk operations, and comprehensive documentation via Swagger UI.

## 🚀 Features

- ✅ **CRUD Operations** - Create, Read, Update, Delete Facebook accounts
- 🔍 **Advanced Filtering** - Filter by status, friend suggestion, creation year
- 📊 **Pagination** - Efficient data loading with customizable page size
- 🔄 **Bulk Operations** - Update or delete multiple accounts at once
- 📚 **Auto-Generated Swagger Docs** - Interactive API documentation
- 🎯 **Standard Response Format** - Consistent API responses
- 🛡️ **Type-Safe** - Built with TypeScript for better code quality
- ⚡ **Reusable Architecture** - Easy to extend and maintain

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [API Endpoints](#api-endpoints)
- [Response Format](#response-format)
- [Project Structure](#project-structure)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher)
- **npm** or **yarn**
- **MySQL** (v5.7 or higher)
- **TypeScript** (installed globally or as dev dependency)

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd ltng_internal
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Install additional packages**
   ```bash
   npm install express mysql2 dotenv cors swagger-ui-express swagger-jsdoc
   npm install -D typescript @types/node @types/express @types/cors @types/swagger-ui-express @types/swagger-jsdoc ts-node nodemon
   ```

## ⚙️ Configuration

1. **Create a `.env` file** in the root directory:

   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=ltng_internal

   # Server Configuration
   PORT=3000
   ```

2. **Update `tsconfig.json`** (if needed):

   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules"]
   }
   ```

3. **Update `package.json` scripts**:
   ```json
   {
     "scripts": {
       "dev": "nodemon src/index.ts",
       "build": "tsc",
       "start": "node dist/index.js",
       "test-db": "ts-node src/test-db.ts"
     }
   }
   ```

## 🗄️ Database Setup

1. **Start MySQL service**

   ```bash
   # Windows
   net start MySQL80

   # Linux
   sudo systemctl start mysql

   # Mac
   brew services start mysql
   ```

2. **Create database and table**

   ```sql
   CREATE DATABASE IF NOT EXISTS ltng_internal;

   USE ltng_internal;

   CREATE TABLE IF NOT EXISTS ltng_media_facebook_acc (
     id INT AUTO_INCREMENT PRIMARY KEY,
     username VARCHAR(255) NOT NULL UNIQUE,
     fb_uid VARCHAR(100) UNIQUE,
     password VARCHAR(255) NOT NULL,
     twofa_secret VARCHAR(255),
     cookies TEXT,
     status ENUM('Active', 'Checkpoint', 'Locked', 'Disabled') DEFAULT 'Active',
     friend_count INT DEFAULT 0,
     friend_suggestion BOOLEAN DEFAULT FALSE,
     account_created_date DATE,
     notes TEXT,
     last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_status (status),
     INDEX idx_username (username),
     INDEX idx_fb_uid (fb_uid),
     INDEX idx_last_update (last_update)
   );
   ```

3. **Insert sample data** (optional):
   ```sql
   INSERT INTO ltng_media_facebook_acc (username, fb_uid, password, twofa_secret, status, friend_count, friend_suggestion, account_created_date, notes) VALUES
   ('john.doe@example.com', '100012345678901', 'pass123', 'JBSWY3DPEHPK3PXP', 'Active', 4500, true, '2023-05-15', 'Primary account'),
   ('jane.smith@example.com', '100012345678902', 'pass456', 'KBSWY3DPEHPK3PXQ', 'Checkpoint', 3200, false, '2023-08-20', 'Hit checkpoint on Dec 10'),
   ('bob.wilson@example.com', '100012345678903', 'pass789', 'LBSWY3DPEHPK3PXR', 'Active', 5100, true, '2022-12-01', 'High performing account'),
   ('alice.brown@example.com', '100012345678904', 'passabc', 'MBSWY3DPEHPK3PXS', 'Locked', 1500, false, '2024-01-10', 'Temporarily locked');
   ```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Test Database Connection

```bash
npm run test-db
```

The server will start on `http://localhost:3000` (or the port specified in `.env`)

## 📚 API Documentation

Once the server is running, access the interactive Swagger UI documentation:

- **Swagger UI**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)
- **Swagger JSON**: [http://localhost:3000/api-docs.json](http://localhost:3000/api-docs.json)

## 🔌 API Endpoints

### Base URL

```
http://localhost:3000/api/fb-accounts
```

### Endpoints

| Method | Endpoint              | Description                                  |
| ------ | --------------------- | -------------------------------------------- |
| GET    | `/`                   | Get all accounts with filters and pagination |
| GET    | `/:id`                | Get account by ID                            |
| POST   | `/`                   | Create new account                           |
| PUT    | `/:id`                | Update account                               |
| DELETE | `/:id`                | Delete account                               |
| POST   | `/bulk/update-status` | Bulk update account status                   |
| POST   | `/bulk/delete`        | Bulk delete accounts                         |

### Query Parameters (GET /)

| Parameter           | Type    | Description                          | Example                                                 |
| ------------------- | ------- | ------------------------------------ | ------------------------------------------------------- |
| `search`            | string  | Search by username, FB UID, or notes | `john`                                                  |
| `status`            | string  | Filter by status                     | `Active`, `Checkpoint`, `Locked`, `Disabled`            |
| `friend_suggestion` | string  | Filter by friend suggestion          | `Yes`, `No`                                             |
| `creation_year`     | string  | Filter by creation year              | `< 2024`, `2023-2024`, `> 2024`                         |
| `sort_by`           | string  | Sort field                           | `friend_count`, `last_update`, `created_at`, `username` |
| `sort_order`        | string  | Sort order                           | `ASC`, `DESC`                                           |
| `page`              | integer | Page number                          | `1`                                                     |
| `limit`             | integer | Items per page                       | `50`                                                    |

### Example Requests

**Get all accounts**

```bash
GET http://localhost:3000/api/fb-accounts?page=1&limit=50
```

**Get accounts with filters**

```bash
GET http://localhost:3000/api/fb-accounts?status=Active&friend_suggestion=Yes&sort_by=friend_count&sort_order=DESC
```

**Get account by ID**

```bash
GET http://localhost:3000/api/fb-accounts/1
```

**Create new account**

```bash
POST http://localhost:3000/api/fb-accounts
Content-Type: application/json

{
  "username": "test@example.com",
  "fb_uid": "100012345678905",
  "password": "securePass123",
  "twofa_secret": "JBSWY3DPEHPK3PXP",
  "cookies": "[{\"name\":\"c_user\",\"value\":\"100012345678905\"}]",
  "status": "Active",
  "friend_count": 3000,
  "friend_suggestion": true,
  "account_created_date": "2024-01-15",
  "notes": "New account"
}
```

**Update account**

```bash
PUT http://localhost:3000/api/fb-accounts/1
Content-Type: application/json

{
  "status": "Checkpoint",
  "friend_count": 4550,
  "notes": "Account under review"
}
```

**Delete account**

```bash
DELETE http://localhost:3000/api/fb-accounts/1
```

**Bulk update status**

```bash
POST http://localhost:3000/api/fb-accounts/bulk/update-status
Content-Type: application/json

{
  "ids": [1, 2, 3],
  "status": "Active"
}
```

**Bulk delete**

```bash
POST http://localhost:3000/api/fb-accounts/bulk/delete
Content-Type: application/json

{
  "ids": [1, 2, 3]
}
```

## 📤 Response Format

All API responses follow a standard format:

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    /* response data */
  },
  "timestamp": "2024-12-14T10:30:00.000Z"
}
```

### Success with Pagination

```json
{
  "success": true,
  "message": "Accounts retrieved successfully",
  "data": [
    /* array of accounts */
  ],
  "pagination": {
    "total": 2300,
    "page": 1,
    "limit": 50,
    "total_pages": 46
  },
  "timestamp": "2024-12-14T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2024-12-14T10:30:00.000Z"
}
```

### Validation Error Response

```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    {
      "field": "username",
      "message": "Username is required"
    }
  ],
  "timestamp": "2024-12-14T10:30:00.000Z"
}
```

## 📁 Project Structure

```
fb-account-manager/
├── src/
│   ├── config/
│   │   ├── database.ts          # Database connection configuration
│   │   └── swagger.ts            # Swagger documentation config
│   ├── models/
│   │   └── fb-account.models.ts          # TypeScript interfaces and types
│   ├── services/
│   │   └── fb-account.service.ts   # Business logic layer
│   ├── controllers/
│   │   └── fb-account.controller.ts # Request/response handling
│   ├── routes/
│   │   └── fb-account.route.ts    # API route definitions
│   ├── utils/
│   │   ├── api-router.ts          # Reusable route decorator
│   │   └── response-handler.ts    # Standard response utilities
│   └── index.ts                  # Application entry point
├── .env                          # Environment variables
├── .gitignore                    # Git ignore file
├── package.json                  # Project dependencies
├── tsconfig.json                 # TypeScript configuration
└── README.md                     # Project documentation
```

## 🛠️ Development

### Adding New Routes

Use the reusable `ApiRouter` class to add new routes without manual Swagger documentation:

```typescript
import ApiRouter from "../utils/ApiRouter";
import myController from "../controllers/MyController";

const apiRouter = new ApiRouter();

apiRouter.addRoute({
  method: "get",
  path: "/my-endpoint",
  handler: (req, res) => myController.myMethod(req, res),
  summary: "My endpoint description",
  tags: ["My Tag"],
  queryParams: [{ name: "param1", type: "string", description: "Description" }],
  responses: {
    200: { description: "Success", schema: "MySchema" },
  },
});

export default apiRouter;
```

### Using Standard Responses

```typescript
import ResponseHandler from "../utils/ResponseHandler";

// Success
ResponseHandler.success(res, data, "Success message");

// Created
ResponseHandler.created(res, data, "Created message");

// Error
ResponseHandler.notFound(res, "Resource not found");
ResponseHandler.badRequest(res, "Invalid data");
ResponseHandler.validationError(res, errors, "Validation failed");
```

## 🐛 Troubleshooting

### MySQL Connection Issues

**Error: `ETIMEDOUT`**

- MySQL server is not running
- Wrong host or port configuration
- Firewall blocking connection

**Solution:**

```bash
# Check MySQL service
net start | find "MySQL"        # Windows
sudo systemctl status mysql     # Linux
brew services list              # Mac

# Start MySQL
net start MySQL80               # Windows
sudo systemctl start mysql      # Linux
brew services start mysql       # Mac
```

**Error: `ECONNREFUSED`**

- MySQL is not accepting connections on specified port

**Solution:**

- Verify MySQL is running on port 3306
- Check `bind-address` in MySQL config file

**Error: `ER_ACCESS_DENIED_ERROR`**

- Wrong username or password

**Solution:**

- Verify credentials in `.env` file
- Reset MySQL password if needed

**Error: `ER_BAD_DB_ERROR`**

- Database doesn't exist

**Solution:**

- Create database: `CREATE DATABASE fb_account_manager;`

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### TypeScript Compilation Errors

```bash
# Clean and rebuild
rm -rf dist
npm run build
```

## 📝 License

This project is licensed under the MIT License.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on the GitHub repository.

---

**Built with ❤️ using Express, TypeScript, and MySQL**
