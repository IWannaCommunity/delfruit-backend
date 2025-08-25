CREATE TABLE IF NOT EXISTS `Badge` (
`id` int(11) NOT NULL AUTO_INCREMENT,
`name` varchar(32) NOT NULL,
`image_url` varchar(64) NOT NULL,
`class` varchar(16) NOT NULL,
`date_created` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
`description` varchar(250) NOT NULL,
PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;