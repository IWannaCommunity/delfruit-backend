CREATE TABLE IF NOT EXISTS `GameTag` (
        game_id int(11) NOT NULL,
        tag_id int(11) NOT NULL,
        user_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (game_id,tag_id,user_id)
      ) DEFAULT CHARSET=utf8;