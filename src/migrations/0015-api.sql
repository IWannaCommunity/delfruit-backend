CREATE TABLE IF NOT EXISTS `Api` (
        id int(11) NOT NULL AUTO_INCREMENT,
        host varchar(300) NOT NULL,
        endpoint varchar(100) NOT NULL,
        method varchar(100) DEFAULT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        api_user int(11) DEFAULT NULL,
        params varchar(1000) DEFAULT NULL,
        PRIMARY KEY (id)
      );