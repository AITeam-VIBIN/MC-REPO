# Users Module (Consolidated Directory Architecture)

This folder contains the complete production-ready skeleton for the **Users Management** module of the MITCON Credential Digital File Storage System (BCD-FSS).

It adheres strictly to the **Consolidated Directory Architecture** guidelines documented in [brain.md](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/brain.md), combining schemas, constants, and logic to keep file counts minimal while pushing layer files to their respective top-level folders.

## Directory Structure

```text
src/
├── auth/
├── users/
│   ├── users.service.js         # Core business logic, User DTOs, and constants
│   ├── users.routes.js          # Express route bindings and Zod validation schemas
│   └── README.md                # Module LLD documentation
├── controllers/
│   └── users.controller.js      # Controller handling HTTP request/responses
├── middleware/
│   └── auth.middleware.js       # requireAuth and requireRole protection filters
├── repositories/
│   └── users.repository.js      # Prisma data persistence layer for User tables
└── utils/
    └── users.util.js            # User entity mapper utilities (userMapper)
```

## Architectural Flows

### 1. Route Validation & Processing
1. Administrators submit requests to endpoints mapped in `users.routes.js`.
2. Inline validation schemas verify payload parameters.
3. If payload validation fails, a standardized `VALIDATION_ERROR` response is returned immediately.
4. If successful, control moves to the corresponding method in `controllers/users.controller.js`.

### 2. Service Logic and Repository Layer
1. The controller method calls matching actions in `services/users.service.js`.
2. The service acts as the business orchestrator, talking to `repositories/users.repository.js` to create, query, update, or delete user records.
3. Database model properties are parsed and returned via standard classes defined in DTOs.
4. The database outputs are sanitized via `users.util.js` (`userMapper`) to output clean response payloads via `UserResponseDto`.

## Mapped Endpoints

| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/` | `POST` | `requireAuth`, `requireRole` | `createUserSchema` | Registers a new user account profile |
| `/` | `GET` | `requireAuth`, `requireRole` | `listUsersSchema` | Lists registered user profiles |
| `/:id` | `GET` | `requireAuth`, `requireRole` | `userIdParamSchema` | Retrieves details for a specific user ID |
| `/:id` | `PUT` | `requireAuth`, `requireRole` | `updateUserSchema` | Updates profile details of a specific user |
| `/:id/activate` | `POST` | `requireAuth`, `requireRole` | `userIdParamSchema` | Sets user status status flag to ACTIVE |
| `/:id/deactivate`| `POST` | `requireAuth`, `requireRole` | `userIdParamSchema` | Sets user status status flag to INACTIVE |
