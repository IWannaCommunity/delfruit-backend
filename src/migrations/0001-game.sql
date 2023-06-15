CREATE TABLE IF NOT EXISTS `Game` (
        id int(11) NOT NULL AUTO_INCREMENT,
        name varchar(200) NOT NULL,
        sortname varchar(150) NOT NULL,
        url varchar(400) CHARACTER SET latin1 DEFAULT NULL,
        url_spdrn varchar(400) DEFAULT NULL,
        author varchar(300) DEFAULT NULL,
        collab tinyint(1) NOT NULL DEFAULT '0',
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        adder_id int(11) DEFAULT NULL,
        removed tinyint(1) NOT NULL DEFAULT '0',
        owner_id int(11) DEFAULT NULL,
        owner_bio varchar(5000) DEFAULT NULL,
        PRIMARY KEY (id),
        KEY removed (removed),
        KEY date_created (date_created)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8;