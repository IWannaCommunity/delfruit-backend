CREATE TABLE IF NOT EXISTS `LikeReview` (
        id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        rating_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY lr_ur (rating_id,user_id)
      );