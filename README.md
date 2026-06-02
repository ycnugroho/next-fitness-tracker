# Next Fitness Tracker

A Next.js App Router workout log for tracking workouts, exercises, exercise history, and spreadsheet exports.

This project extends the original application with automated testing, CI/CD practices, cloud database integration, and application monitoring to improve reliability, maintainability, and deployment readiness.

---

## Project Scope

This project focuses on improving the maintainability, observability, and deployment readiness of the Next Fitness Tracker application.

Key enhancements include:

* Announcement Banner feature
* Automated testing with Vitest
* Continuous Integration using GitHub Actions
* Cloud database integration using Turso
* Application monitoring and observability
* Deployment readiness through Azure services

---

## Project Goals

The primary goals of this project are:

1. Improve application reliability through automated testing.
2. Ensure code quality using CI validation.
3. Enable cloud-based database management using Turso.
4. Improve deployment readiness through Azure integration.
5. Establish monitoring and observability practices.

---

## Deliverables

### Functional Deliverables

* Announcement Banner component
* Workout tracking functionality
* Exercise management functionality

### Quality Deliverables

* Unit tests for critical components
* GitHub Actions CI pipeline
* Linting and build validation

### Infrastructure Deliverables

* Turso development database
* Environment configuration management
* Deployment documentation
* Azure deployment and monitoring configuration

---

## Project Plan

### Week 1

#### Yoka — Developer

* Research GitHub Actions, Vitest, and Next.js architecture
* Fork repository and analyze project structure
* Verify Node.js 24 development environment

#### Vanya — Developer / DevOps

* Define project scope, goals, and deliverables
* Setup Turso development database
* Configure local environment variables and database connectivity

#### Juno — Ops / Cloud

* Research Azure App Service and Azure Application Insights
* Provision Azure Resource Group
* Prepare cloud infrastructure architecture

---

### Week 2

#### Yoka — Developer

* Remove Clerk authentication dependencies and configuration
* Develop Announcement Banner component
* Update workflow diagram to include monitoring architecture

#### Vanya — Developer / DevOps

* Integrate Announcement Banner into application layout
* Configure announcement feature flag (`NEXT_PUBLIC_BANNER_ENABLED`)
* Develop Announcement Banner unit tests using Vitest
* Integrate Azure Application Insights SDK

#### Juno — Ops / Cloud

* Setup Azure Container Registry (ACR)
* Configure GitHub Secrets for deployment
* Provision Azure Application Insights resource
* Configure Azure Monitor alert rules

---

### Week 3

#### Yoka — Developer

* Implement GitHub Actions CI workflow
* Configure lint, test, and build validation
* Verify CI pipeline execution

#### Vanya — Developer / DevOps

* Include Announcement Banner tests in CI pipeline
* Apply database migrations to Turso
* Document setup steps and CI pipeline configuration

#### Juno — Ops / Cloud

* Provision Azure App Service
* Implement CD workflow
* Verify telemetry delivery to Azure Application Insights

---

### Week 4

#### Yoka — Developer

* Execute CI success and failure test scenarios
* Configure Branch Protection Rules

#### Vanya — Developer / DevOps

* Validate end-to-end CI/CD workflow
* Validate Azure deployment environment
* Migrate application secrets to Azure Key Vault
* Document testing and refinement results

#### Juno — Ops / Cloud

* Perform deployment stress testing
* Verify scaling behavior
* Configure HTTPS/SSL
* Finalize Azure Monitor alerts

---

### Week 5

#### Yoka — Developer

* Bug fixing and dependency stabilization
* Pre-demo validation

#### Vanya — Developer / DevOps

* Finalize Azure Application Insights integration
* Verify custom telemetry events:

  * `banner_viewed`
  * `banner_dismissed`

#### Juno — Ops / Cloud

* Finalize README and project documentation
* Prepare final project report

---

## Technology Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

### Database

* Turso (LibSQL)
* Drizzle ORM

### Testing

* Vitest
* Testing Library

### CI/CD

* GitHub Actions

### Cloud & Monitoring

* Azure App Service
* Azure Application Insights
* Azure Monitor
* Azure Key Vault

---

## Requirements

* Node.js 24
* pnpm
* Turso/LibSQL database credentials

---

## Development

Use the pinned Node version, install dependencies, and start the development server:

```bash
nvm use
pnpm install
pnpm dev
```

Open:

```text
http://localhost:3000
```

---

## Environment

Create `.env.local` and do not commit it.

Required variables:

```env
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
NEXT_PUBLIC_BANNER_ENABLED=true
```

---

## Useful Commands

```bash
pnpm test
pnpm lint
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

---

## Database Migration

Generate migrations:

```bash
pnpm db:generate
```

Apply migrations:

```bash
pnpm db:migrate
```

---

## CI Pipeline

The GitHub Actions workflow performs:

1. Dependency installation
2. ESLint validation
3. Vitest execution
4. Next.js build verification

Announcement Banner tests are included in the CI pipeline and executed automatically during pushes and pull requests.

### Required GitHub Secrets

```text
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
```

---

## Monitoring & Observability

The project uses Azure Application Insights and Azure Monitor to provide:

* Application telemetry collection
* Performance monitoring
* Error tracking
* Availability monitoring
* Custom event tracking

Planned custom events include:

* `banner_viewed`
* `banner_dismissed`

---

## Project Structure

* `app/` contains App Router pages, route handlers, metadata, and loading UI.
* `components/` contains application and form UI components.
* `db/` and `migrations/` contain the Drizzle schema and migrations.
* `lib/` contains shared data, route, parsing, and formatting helpers.
* `tests/` contains Vitest unit and route-handler tests.
