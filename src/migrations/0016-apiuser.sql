CREATE TABLE IF NOT EXISTS `ApiUser` (
        id int(11) NOT NULL AUTO_INCREMENT,
        api_key varchar(100) NOT NULL,
        description varchar(200) DEFAULT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        origin varchar(120) DEFAULT NULL,
        PRIMARY KEY (id)
      );