-- ============================================================
--  interactions_db  –  Full schema
--  Run once to initialise the database.
--  mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS interactions_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE interactions_db;

-- ── API keys ─────────────────────────────────────────────────
--  Each remote client is issued one row here.
--  The `api_key` value is what clients send in the
--  X-API-Key request header.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  api_key     VARCHAR(64)     NOT NULL,
  label       VARCHAR(100)    NOT NULL COMMENT 'Human-readable name for this key',
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used   DATETIME                 DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_key (api_key)
) ENGINE=InnoDB;

-- ── Interactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interactions (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  user_id             VARCHAR(100)    NOT NULL COMMENT 'ID of the user on the remote client application',
  interaction_type    VARCHAR(100)    NOT NULL,
  company_name        VARCHAR(150)    NOT NULL,
  contact_person      VARCHAR(150)    NOT NULL,
  interaction_details TEXT            NOT NULL,
  interaction_time    DATETIME        NOT NULL,
  api_key_id          INT UNSIGNED             DEFAULT NULL COMMENT 'Which client device created this record',
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                      ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id      (user_id),
  KEY idx_company      (company_name),
  KEY idx_type         (interaction_type),
  KEY idx_time         (interaction_time),
  KEY fk_api_key       (api_key_id),
  CONSTRAINT fk_api_key
    FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── Migration (existing installations only) ───────────────────
--  If you already have the interactions table, run this instead
--  of the full CREATE TABLE above:
--
--  ALTER TABLE interactions
--    ADD COLUMN user_id VARCHAR(100) NOT NULL DEFAULT ''
--      COMMENT 'ID of the user on the remote client application'
--      AFTER id,
--    ADD KEY idx_user_id (user_id);
