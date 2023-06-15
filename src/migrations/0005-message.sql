CREATE TABLE IF NOT EXISTS `Message` (
        id int(11) NOT NULL AUTO_INCREMENT,
        is_read tinyint(1) NOT NULL DEFAULT '0',
        user_from_id int(11) NOT NULL,
        user_to_id int(11) NOT NULL,
        subject varchar(100) NOT NULL,
        body text NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted tinyint(1) NOT NULL DEFAULT '0',
        reply_to_id int(11),
        thread_id int(11),
        PRIMARY KEY (id)
      );