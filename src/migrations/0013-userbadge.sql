CREATE TABLE IF NOT EXISTS `UserBadge` (
        user_id int NOT NULL,
        badge_id int NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id,badge_id)
      );