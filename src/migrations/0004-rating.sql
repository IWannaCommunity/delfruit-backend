CREATE TABLE IF NOT EXISTS `Rating` (
        id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        game_id int(11) NOT NULL,
        rating tinyint(4) DEFAULT NULL,
        difficulty tinyint(4) DEFAULT NULL,
        comment text,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        removed tinyint(1) NOT NULL DEFAULT '0',
        PRIMARY KEY (id),
        UNIQUE KEY idk_ug (user_id,game_id),
        KEY game_id (removed,game_id),
        KEY review_date (date_created),
        KEY idx_gid_rem (game_id,removed)
      ) DEFAULT CHARSET=utf8;