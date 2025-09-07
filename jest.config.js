module.exports = {
	preset: "ts-jest",
	reporters: [ "default", "jest-junit" ],
	testEnvironment: "node",
	maxWorkers: 1,
};