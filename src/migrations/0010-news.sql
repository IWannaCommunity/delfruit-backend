CREATE TABLE IF NOT EXISTS `News` (
        id int(11) NOT NULL AUTO_INCREMENT,
        poster_id int(11) NOT NULL,
        title varchar(100) CHARACTER SET utf8 NOT NULL,
        short text CHARACTER SET utf8 NOT NULL,
        news text CHARACTER SET utf8 NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        removed tinyint(1) NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      );