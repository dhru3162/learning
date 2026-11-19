# Learning Backend Monorepo

A clean, production-ready monorepo containing two independent [NestJS](https://nestjs.com/) applications (`server-one` and `server-two`), managed with [pnpm Workspaces](https://pnpm.io/workspaces) and orchestrated by [Turborepo](https://turbo.build/repo).

---

## Table of Contents

- [1. Monorepo Overview](#1-monorepo-overview)
  - [What is a Monorepo?](#what-is-a-monorepo)
  - [What Turborepo Does](#what-turborepo-does)
  - [What pnpm Workspaces Do](#what-pnpm-workspaces-do)
  - [Why There Are Two NestJS Applications](#why-there-are-two-nestjs-applications)
- [2. Project Structure](#2-project-structure)
- [3. Purpose of Configuration Files](#3-purpose-of-configuration-files)
  - [Root vs Application package.json](#root-vs-application-packagejson)
  - [pnpm-workspace.yaml](#pnpm-workspaceyaml)
  - [pnpm-lock.yaml](#pnpm-lockyaml)
  - [turbo.json Task Pipeline](#turbojson-task-pipeline)
  - [.gitignore](#gitignore)
- [4. How Turborepo Discovers Tasks](#4-how-turborepo-discovers-tasks)
- [5. Available Development Scripts](#5-available-development-scripts)
  - [Running Both Applications Together](#running-both-applications-together)
  - [Running Applications Individually](#running-applications-individually)
  - [Building Both Applications](#building-both-applications)
  - [Running Tests](#running-tests)
  - [Running Linter](#running-linter)
  - [Running TypeScript Typechecking](#running-typescript-typechecking)
- [6. Verifying Health Endpoints](#6-verifying-health-endpoints)
- [7. Turborepo Monorepo vs NestJS Built-in Monorepo Mode](#7-turborepo-monorepo-vs-nestjs-built-in-monorepo-mode)
- [8. How to Add a Third Application](#8-how-to-add-a-third-application)

---

## 1. Monorepo Overview

### What is a Monorepo?
A **monorepo** (monolithic repository) is a single version-controlled Git repository containing multiple distinct projects or packages with well-defined relationships. Rather than scattering services across disparate repositories—which complicates shared tooling, cross-service refactoring, and coordinated CI/CD pipelines—a monorepo unifies your codebase under one roof while maintaining modular boundaries between applications.

### What Turborepo Does
[Turborepo](https://turbo.build/repo) is a high-performance build orchestration system tailored for JavaScript and TypeScript monorepos:
- **Intelligent Task Scheduling**: Turborepo constructs a Directed Acyclic Graph (DAG) of your project's tasks, scheduling independent tasks in parallel while respecting package dependencies.
- **Fast Hashing & Computation Caching**: It hashes source code, environment variables, task configurations, and dependencies. If nothing changed since the last run, Turborepo replays cached outputs in milliseconds.
- **Persistent Dev Processes**: Coordinates long-running development servers without blocking or conflicting.

### What pnpm Workspaces Do
[pnpm](https://pnpm.io/) is a fast, disk-efficient package manager. **pnpm workspaces** group multiple packages inside a single repository:
- **Shared Dependency Store**: Uses a content-addressable store so identical dependencies across applications are linked, eliminating redundant disk consumption.
- **Workspace Resolution**: Automatically links internal workspace dependencies (e.g. shared libraries inside `packages/*`) without needing to publish to an npm registry.
- **Unified Lockfile**: Produces a single `pnpm-lock.yaml` at the root that guarantees reproducible installations across every developer machine and CI runner.

### Why There Are Two NestJS Applications
Having two independent applications (`server-one` and `server-two`):
1. **Demonstrates Multi-Service Architecture**: Emulates a real-world microservices or multi-API backend where separate services handle distinct business capabilities (e.g., Auth Service vs Order Service).
2. **Eliminates Port Conflicts**: Demonstrates proper configuration of configurable environment ports (`PORT=3000` vs `PORT=3001`) running side-by-side.
3. **Illustrates Independent Isolation**: Ensures neither service imports the other's internal modules or violates boundaries, proving that Turborepo can orchestrate isolated services cleanly.

---

## 2. Project Structure

```text
learning-backend/
├── apps/
│   ├── server-one/
│   │   ├── src/
│   │   │   ├── main.ts               # Bootstraps NestJS on port 3000
│   │   │   ├── app.module.ts         # Root module for server-one
│   │   │   ├── app.controller.ts     # Exposes GET / and GET /health
│   │   │   ├── app.controller.spec.ts# Unit tests for controller
│   │   │   └── app.service.ts        # Service returning status and greetings
│   │   ├── test/
│   │   │   └── app.e2e-spec.ts       # End-to-end integration tests
│   │   ├── .env.example              # Documents PORT=3000
│   │   ├── nest-cli.json             # NestJS CLI configuration
│   │   ├── package.json              # Package manifest and scripts for server-one
│   │   ├── tsconfig.json             # TypeScript compiler configuration
│   │   ├── tsconfig.build.json       # Production build TS configuration
│   │   ├── vitest.config.ts          # Unit test configuration
│   │   └── vitest.config.e2e.ts      # E2E test configuration
│   │
│   └── server-two/
│       ├── src/
│       │   ├── main.ts               # Bootstraps NestJS on port 3001
│       │   ├── app.module.ts         # Root module for server-two
│       │   ├── app.controller.ts     # Exposes GET / and GET /health
│       │   ├── app.controller.spec.ts# Unit tests for controller
│       │   └── app.service.ts        # Service returning status and greetings
│       ├── test/
│       │   └── app.e2e-spec.ts       # End-to-end integration tests
│       ├── .env.example              # Documents PORT=3001
│       ├── nest-cli.json             # NestJS CLI configuration
│       ├── package.json              # Package manifest and scripts for server-two
│       ├── tsconfig.json             # TypeScript compiler configuration
│       ├── tsconfig.build.json       # Production build TS configuration
│       ├── vitest.config.ts          # Unit test configuration
│       └── vitest.config.e2e.ts      # E2E test configuration
│
├── packages/
│   └── .gitkeep                      # Reserved directory for shared packages/libraries
│
├── .gitignore                        # Git exclusion rules
├── package.json                      # Monorepo root package manifest
├── pnpm-workspace.yaml               # Defines workspace member paths
├── pnpm-lock.yaml                    # Exact deterministic dependency tree
├── turbo.json                        # Turborepo task graph & caching rules
└── README.md                         # Documentation
```

---

## 3. Purpose of Configuration Files

### Root vs Application `package.json`
- **Root `package.json`**:
  - Marked with `"private": true` so the monorepo root is never accidentally published to npm.
  - Contains global devDependencies that orchestrate the repository (such as `turbo`).
  - Contains top-level convenience scripts (`pnpm dev`, `pnpm build`, etc.) that delegate execution to `turbo run <task>`.
  - Defines the global package manager specification (`"packageManager": "pnpm@12.15.0"`).
- **Application `package.json` (`apps/server-one/package.json` & `apps/server-two/package.json`)**:
  - Defines each application's unique identity (`name: "server-one"`, `name: "server-two"`).
  - Declares the application's runtime dependencies (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `rxjs`, etc.) and local dev dependencies.
  - Defines the underlying command implementations for tasks like `"build": "nest build"`, `"dev": "nest start --watch"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, and `"lint": "oxlint --type-aware src/ test/"`.

### `pnpm-workspace.yaml`
Informs pnpm where to look for packages belonging to this monorepo:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
Any folder inside `apps/` or `packages/` containing a `package.json` is automatically registered as a workspace package.

### `pnpm-lock.yaml`
The unified lockfile generated by pnpm. It records the exact resolved versions, integrity hashes, and dependency trees for every package across the entire monorepo. It ensures that every build is strictly deterministic.

### `turbo.json` Task Pipeline
Defines the pipeline of tasks that Turborepo can run across packages:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

| Task | Configuration | Purpose |
|---|---|---|
| `build` | `dependsOn: ["^build"]`, `outputs: ["dist/**"]` | Runs `nest build`. Upstream workspace dependencies are built first (`^build`). Caches build output stored in `dist/**`. |
| `typecheck` | `dependsOn: ["^build"]`, `outputs: []` | Runs `tsc --noEmit` to verify type safety without generating artifacts. |
| `test` | `dependsOn: ["^build"]`, `outputs: []` | Runs unit tests via `vitest run`. |
| `lint` | `outputs: []` | Runs linter across source and test files. |
| `dev` | `cache: false`, `persistent: true` | Starts development watch mode. `persistent: true` indicates a long-running process; `cache: false` prevents caching dev sessions. |

### `.gitignore`
Ensures temporary, machine-specific, and build artifact files are not committed:
- `node_modules/` and `.pnpm-store/` (installed packages)
- `dist/`, `build/`, `out/`, `*.tsbuildinfo` (compiled JavaScript and TS build info)
- `.turbo/` (Turborepo local cache)
- `coverage/` (test coverage reports)
- `.env` and `.env.*` (local secret environment configurations, keeping `.env.example`)
- Logs and OS-generated files (`.DS_Store`, `Thumbs.db`)

---

## 4. How Turborepo Discovers Tasks

When you run `pnpm turbo run <task-name>` (or `turbo run <task-name>`):
1. **Workspace Inspection**: Turbo reads `pnpm-workspace.yaml` and scans the matched directories (`apps/*`, `packages/*`) for `package.json` files.
2. **Task Definition Check**: Turbo looks up `<task-name>` in `turbo.json` to inspect its dependencies, cache policies, and outputs.
3. **Script Matching**: Turbo inspects each package's `package.json`. If a package has a script matching `<task-name>`, Turbo includes that package in the task execution plan. If a package does not have that script, Turbo simply skips it.
4. **Execution Graph Construction**: Turbo builds a task graph (DAG). Tasks that have no dependencies run concurrently in parallel.
5. **Cache Evaluation**: For non-persistent tasks (`build`, `test`, `lint`, `typecheck`), Turbo hashes inputs (files, environment variables, dependencies). If a cache hit occurs, outputs and logs are replayed instantly from `.turbo/cache`.

You can preview Turbo's task graph without running it using:
```bash
pnpm turbo run dev --dry
```

---

## 5. Available Development Scripts

> **Important**: All commands below should be executed from the **monorepo root directory** (`learning-backend/`).

### Running Both Applications Together
To start both `server-one` (port 3000) and `server-two` (port 3001) in watch mode concurrently:
```bash
pnpm dev
```
Turborepo runs `server-one#dev` and `server-two#dev` simultaneously and prefixes terminal log outputs with `server-one:` and `server-two:`.

### Running Applications Individually
You can use pnpm's `--filter` flag to target a single application:

- **Run only `server-one`**:
  ```bash
  pnpm --filter server-one dev
  ```
- **Run only `server-two`**:
  ```bash
  pnpm --filter server-two dev
  ```

Alternatively, navigate into the specific application directory:
```bash
cd apps/server-one
pnpm dev
```

### Building Both Applications
Compiles TypeScript into `dist/` across both applications:
```bash
pnpm build
```
Or build a single application:
```bash
pnpm --filter server-one build
```

### Running Tests
Executes unit tests across all applications:
```bash
pnpm test
```
To run end-to-end (e2e) tests for a specific application:
```bash
pnpm --filter server-one run test:e2e
pnpm --filter server-two run test:e2e
```

### Running Linter
Runs code quality checks:
```bash
pnpm lint
```

### Running TypeScript Typechecking
Validates TypeScript typings without emitting build artifacts:
```bash
pnpm typecheck
```

---

## 6. Verifying Health Endpoints

When development servers are running (`pnpm dev`):

### 1. Server One
- **URL**: `http://localhost:3000/health`
- **Expected Response**:
  ```json
  {
    "status": "ok",
    "server": "server-one",
    "timestamp": "2026-10-28T06:50:00.000Z"
  }
  ```

### 2. Server Two
- **URL**: `http://localhost:3001/health`
- **Expected Response**:
  ```json
  {
    "status": "ok",
    "server": "server-two",
    "timestamp": "2026-10-28T06:50:00.000Z"
  }
  ```

### Quick Verification via Command Line
On Windows (PowerShell):
```powershell
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3001/health
```

On macOS / Linux (cURL):
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

---

## 7. Turborepo Monorepo vs NestJS Built-in Monorepo Mode

NestJS provides an official built-in monorepo mode via `nest generate app <name>` configured in a single `nest-cli.json`. Here is how it compares to Turborepo:

| Feature / Aspect | NestJS Built-in Monorepo Mode | Turborepo + pnpm Monorepo (This Setup) |
|---|---|---|
| **Scope & Technology** | Strictly NestJS-only applications and libraries. | Framework-agnostic. Can mix NestJS, Next.js, Fastify, Express, React, etc. |
| **Dependency Isolation** | Single shared `package.json` at root; all apps share identical dependency versions. | Each application has its own `package.json` with explicit dependencies. |
| **Build Orchestration** | Standard sequential or single Nest CLI compilation. | Highly optimized DAG with parallel task execution and computation caching. |
| **Workspace Manager** | Relies on tsconfig path mappings. | Leverages native pnpm/npm/yarn workspaces with strict symlink boundary enforcement. |
| **CI / CD Acceleration** | Rebuilds everything unless manual script logic is written. | Remote and local computation caching; only changed packages and dependents are rebuilt. |
| **Modularity & Boundaries** | Easy to accidentally couple services via circular imports. | Strict package boundaries; packages must explicitly declare dependencies. |

---

## 8. How to Add a Third Application

Adding a new application (e.g. `server-three`) is straightforward:

1. **Scaffold the Application**:
   Create a new directory inside `apps/`:
   ```bash
   pnpm dlx @nestjs/cli new server-three --directory apps/server-three --skip-git --skip-install --package-manager pnpm
   ```
2. **Configure Port in `src/main.ts`**:
   Assign a new unique port (e.g. 3002):
   ```typescript
   const port = process.env.PORT || 3002;
   await app.listen(port);
   ```
3. **Harmonize Scripts in `apps/server-three/package.json`**:
   Ensure `apps/server-three/package.json` contains the standard lifecycle scripts:
   ```json
   {
     "name": "server-three",
     "scripts": {
       "dev": "nest start --watch",
       "build": "nest build",
       "typecheck": "tsc --noEmit",
       "lint": "oxlint --type-aware src/ test/",
       "test": "vitest run"
     }
   }
   ```
4. **Install Dependencies**:
   From repository root, run:
   ```bash
   pnpm install
   ```
5. **Run via Turborepo**:
   Turbo automatically detects `server-three`! When you run `pnpm dev` or `pnpm build`, `server-three` is automatically included in the execution plan.

# learning
