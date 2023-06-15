CREATE TABLE IF NOT EXISTS `Report` (
        id int(11) NOT NULL AUTO_INCREMENT,
        type varchar(50) CHARACTER SET utf8 NOT NULL,
        target_id int(11) NOT NULL,
        report varchar(2000) CHARACTER SET utf8 NOT NULL,
        reporter_id int(11) NOT NULL,
        answered_by_id int(11) DEFAULT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        date_answered timestamp NULL DEFAULT NULL,
        PRIMARY KEY (id)
      );