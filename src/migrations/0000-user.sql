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