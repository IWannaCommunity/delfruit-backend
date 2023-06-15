CREATE TABLE IF NOT EXISTS `UserPermission` (
        user_id int NOT NULL,
        permission_id VARCHAR(32) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_until timestamp,
        PRIMARY KEY (user_id,permission_id)
      );