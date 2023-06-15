CREATE TABLE IF NOT EXISTS `UserFollow` (
        user_id int(11) NOT NULL,
        user_follow_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id,user_follow_id)
      );