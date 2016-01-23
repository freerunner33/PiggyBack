CREATE DATABASE IF NOT EXISTS PiggyBack;

USE PiggyBack;

CREATE TABLE IF NOT EXISTS Users (
	id INT(11) PRIMARY KEY AUTO_INCREMENT,
	username VARCHAR(64) NOT NULL UNIQUE,
	firstname VARCHAR(64) NOT NULL,
	lastname VARCHAR(64) NOT NULL,
	password VARCHAR(100) NOT NULL,
	phone VARCHAR(32) NOT NULL,
	skipSMS TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS Destinations (
	id VARCHAR(64) PRIMARY KEY NOT NULL,
	name VARCHAR(64),
	number INT NOT NULL,
	street VARCHAR(64) NOT NULL,
	apartment VARCHAR(64),
	city VARCHAR(64) NOT NULL,
	state VARCHAR(64) NOT NULL,
	postalCode INT NOT NULL,
	country VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS Tasks (
	id VARCHAR(64) PRIMARY KEY NOT NULL,
	company VARCHAR(64) NOT NULL,
	driverTip VARCHAR(64) DEFAULT '0',
	month VARCHAR(64) NOT NULL,
	day INT NOT NULL,
	year INT NOT NULL,
	hour INT NOT NULL,
	minute INT NOT NULL,
	workerId VARCHAR(64) NOT NULL,
	workerName VARCHAR(64) NOT NULL,
	destId VARCHAR(64) NOT NULL, 
	destNumber INT NOT NULL,
	destStreet VARCHAR(64) NOT NULL,
	destCity VARCHAR(64) NOT NULL,
	destPostalCode INT NOT NULL
)
