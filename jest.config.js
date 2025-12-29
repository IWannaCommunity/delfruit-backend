module.exports = {
	preset: "ts-jest",
	testRunner: "jasmine2",
	reporters: [ "default", "jest-junit" ],
	testEnvironment: "node",
	maxWorkers: 1,
	testTimeout: 15000
};