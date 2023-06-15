CREATE TABLE IF NOT EXISTS `ListGame` (
        list_id int(11) NOT NULL,
        game_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (list_id,game_id)
      );