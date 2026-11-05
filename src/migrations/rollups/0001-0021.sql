CREATE TABLE IF NOT EXISTS `User` (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(50) CHARACTER SET latin1 NOT NULL,

  phash varchar(128) CHARACTER SET latin1 DEFAULT NULL,
  salt varchar(100) DEFAULT NULL,
  
  phash2 varchar(255) DEFAULT NULL,

  email varchar(100) CHARACTER SET latin1 DEFAULT NULL,
  date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_last_login timestamp NULL DEFAULT NULL,

  last_ip varchar(40) CHARACTER SET latin1 DEFAULT NULL,
  unsuccessful_logins int(11) NOT NULL DEFAULT '0',

  is_admin tinyint(1) NOT NULL DEFAULT '0',
  can_report tinyint(1) NOT NULL DEFAULT '1',
  can_submit tinyint(1) NOT NULL DEFAULT '1',
  can_review tinyint(1) NOT NULL DEFAULT '1',
  can_screenshot tinyint(1) NOT NULL DEFAULT '1',
  can_message tinyint(1) NOT NULL DEFAULT '1',
  banned tinyint(1) NOT NULL DEFAULT '0',

  twitch_link varchar(50) DEFAULT NULL,
  nico_link varchar(50) DEFAULT NULL,
  youtube_link varchar(50) DEFAULT NULL,
  twitter_link varchar(50) DEFAULT NULL,

  bio TEXT DEFAULT NULL,
  
  ali_token varchar(300) DEFAULT NULL,
  ali_date_set timestamp NULL DEFAULT NULL,

  reset_token varchar(255) DEFAULT NULL,
  reset_token_set_time timestamp NULL DEFAULT NULL,

  locale char(5) NOT NULL DEFAULT 'en_US',

  selected_badge int DEFAULT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY name_2 (name),
  KEY banned (banned)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

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
	  
CREATE TABLE IF NOT EXISTS `GameTag` (
        game_id int(11) NOT NULL,
        tag_id int(11) NOT NULL,
        user_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (game_id,tag_id,user_id)
) DEFAULT CHARSET=utf8;
	  
CREATE TABLE IF NOT EXISTS `Tag` (
        id int(11) NOT NULL AUTO_INCREMENT,
        name varchar(30) CHARACTER SET utf8 NOT NULL,
        PRIMARY KEY (id),
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY name (name)
) DEFAULT CHARSET=utf8;
	  
CREATE TABLE IF NOT EXISTS `Rating` (
        id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        game_id int(11) NOT NULL,
        rating tinyint(4) DEFAULT NULL,
        difficulty tinyint(4) DEFAULT NULL,
        comment text,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        removed tinyint(1) NOT NULL DEFAULT '0',
        PRIMARY KEY (id),
        UNIQUE KEY idk_ug (user_id,game_id),
        KEY game_id (removed,game_id),
        KEY review_date (date_created),
        KEY idx_gid_rem (game_id,removed)
) DEFAULT CHARSET=utf8;

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

CREATE TABLE IF NOT EXISTS `LikeReview` (
        id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        rating_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY lr_ur (rating_id,user_id)
);

CREATE TABLE IF NOT EXISTS `List` (
        id int(11) NOT NULL AUTO_INCREMENT,
        user_id int(11) NOT NULL,
        name varchar(200) NOT NULL,
        description text,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY user_id (user_id)
);

CREATE TABLE IF NOT EXISTS `ListGame` (
        list_id int(11) NOT NULL,
        game_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (list_id,game_id)
);

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

CREATE TABLE IF NOT EXISTS `UserFollow` (
        user_id int(11) NOT NULL,
        user_follow_id int(11) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id,user_follow_id)
);

CREATE TABLE IF NOT EXISTS `UserBadge` (
        user_id int NOT NULL,
        badge_id int NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id,badge_id)
);

CREATE TABLE IF NOT EXISTS `UserPermission` (
        user_id int NOT NULL,
        permission_id VARCHAR(32) NOT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_until timestamp,
        PRIMARY KEY (user_id,permission_id)
);

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

CREATE TABLE IF NOT EXISTS `ApiUser` (
        id int(11) NOT NULL AUTO_INCREMENT,
        api_key varchar(100) NOT NULL,
        description varchar(200) DEFAULT NULL,
        date_created timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        origin varchar(120) DEFAULT NULL,
        PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS `Admin` (
`int` tinyint(1) NOT NULL DEFAULT '0',
`last_wiki_pull` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (`int`)
) DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `Badge` (
`id` int(11) NOT NULL AUTO_INCREMENT,
`name` varchar(32) NOT NULL,
`image_url` varchar(64) NOT NULL,
`class` varchar(16) NOT NULL,
`date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`description` varchar(250) NOT NULL,
PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `Bookmark` (
`user_id` int(11) NOT NULL,
`game_id` int(11) NOT NULL,
PRIMARY KEY (`user_id`,`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `Clear` (
`user_id` int(11) NOT NULL,
`game_id` int(11) NOT NULL,
PRIMARY KEY (`user_id`,`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `Favorite` (
`user_id` int(11) NOT NULL,
`game_id` int(11) NOT NULL,
PRIMARY KEY (`user_id`,`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;