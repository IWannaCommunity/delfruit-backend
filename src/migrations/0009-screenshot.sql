CREATE TABLE IF NOT EXISTS `Screenshot` (
        id int(11) NOT NULL AUTO_INCREMENT,
        game_id int(11) NOT NULL,
        added_by_id int(11) NOT NULL,
        approved_by_id int(11) DEFAULT NULL,
        description varchar(100) CHARACTER SET utf8 NOT NULL,
        approved tinyint(1) DEFAULT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        removed tinyint(1) NOT NULL DEFAULT '0',
        PRIMARY KEY (id)
      );