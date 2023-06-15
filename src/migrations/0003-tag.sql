CREATE TABLE IF NOT EXISTS `Tag` (
        id int(11) NOT NULL AUTO_INCREMENT,
        name varchar(30) CHARACTER SET utf8 NOT NULL,
        PRIMARY KEY (id),
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY name (name)
      ) DEFAULT CHARSET=utf8;