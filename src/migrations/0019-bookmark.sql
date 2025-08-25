CREATE TABLE IF NOT EXISTS `Bookmark` (
`user_id` int(11) NOT NULL,
`game_id` int(11) NOT NULL,
PRIMARY KEY (`user_id`,`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;