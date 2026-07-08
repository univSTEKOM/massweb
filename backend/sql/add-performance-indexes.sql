-- Performance indexes for massweb
-- ---------------------------------------------------------------------------
-- These match the @Index decorators added to the entities. With
-- `synchronize: true` TypeORM creates them automatically on the next backend
-- boot, so this file is only needed if you deploy with synchronize disabled or
-- prefer to add the indexes yourself in a controlled maintenance window.
--
-- MySQL 8 / InnoDB creates these with online DDL (ALGORITHM=INPLACE, LOCK=NONE),
-- so reads/writes keep working while each index builds. On very large tables the
-- build still takes time and some extra I/O — run it during a low-traffic window.
--
-- MySQL does NOT support "CREATE INDEX IF NOT EXISTS". If an index already
-- exists (e.g. synchronize created it), that single statement errors with
-- "Duplicate key name" — safe to ignore, just skip it.
-- ---------------------------------------------------------------------------

-- generated_contents: the big table behind every content list / count / publish query
CREATE INDEX idx_gc_project_status_created ON generated_contents (projectId, publishStatus, createdAt);
CREATE INDEX idx_gc_project_created        ON generated_contents (projectId, createdAt);
CREATE INDEX idx_gc_slug                   ON generated_contents (slug);

-- csv_rows: fetched/counted by project, read in rowOrder during generation
CREATE INDEX idx_csvrow_project_order ON csv_rows (projectId, rowOrder);

-- csv_columns
CREATE INDEX idx_csvcol_project_order ON csv_columns (projectId, columnOrder);

-- publish_jobs: polled every 30s by the scheduler + per-project status lookups
CREATE INDEX idx_job_status_created  ON publish_jobs (status, createdAt);
CREATE INDEX idx_job_project_status  ON publish_jobs (projectId, status);

-- projects: listed/counted per organization, ordered by createdAt
CREATE INDEX idx_project_org_created ON projects (organizationId, createdAt);

-- organization_members: membership lookups + per-user / per-org counts
CREATE INDEX idx_orgmember_user_org ON organization_members (userId, organizationId);
CREATE INDEX idx_orgmember_org      ON organization_members (organizationId);

-- categories
CREATE INDEX idx_category_org ON categories (organizationId);
