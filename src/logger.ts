import pino, { Logger } from "pino";

const EXTLOGLEVELS = {
	wtf: 80,
	assert: 70,
};

export class StdLogger {
	logger: Logger;
	dieOnAssert: boolean = true;

	constructor(level: string, dieOnAssert: boolean = true) {
		this.logger = pino({ level, customLevels: EXTLOGLEVELS });
		this.dieOnAssert = dieOnAssert;
	}

	wtf(obj: boolean, msg: string, ...args: Array<any>): never | void {
		if (!obj) {
			return;
		}
		this.logger.wtf(obj, msg, args);
		if (this.dieOnAssert) {
			return process.exit(9001);
		}
	}

	assert(obj: boolean, msg: string, ...args: Array<any>): never | void {
		if (!obj) {
			return;
		}
		this.logger.assert(obj, msg, args);
		if (this.dieOnAssert) {
			return process.exit(1000);
		}
	}

	fatal(msg: string, ...args: Array<any>): void;
	fatal<T extends object>(obj: T, msg: string, ...args: Array<any>): void {
		return this.logger.fatal(obj, msg, args);
	}

	error(obj: object, msg: string, ...args: Array<any>): void {
		return this.logger.error(obj, msg, args);
	}

	warn(msg: string, ...args: Array<any>): void;
	warn<T extends object>(obj: T, msg: string, ...args: Array<any>): void {
		return this.logger.warn(obj, msg, args);
	}

	info(msg: string, ...args: Array<any>): void;
	info<T extends object>(obj: T, msg: string, ...args: Array<any>): void {
		return this.logger.info(obj, msg, args);
	}

	debug(msg: string, ...args: Array<any>): void;
	debug<T extends object>(obj: T, msg: string, ...args: Array<any>): void {
		return this.logger.debug(obj, msg, args);
	}

	trace(msg: string, ...args: Array<any>): void;
	trace<T extends object>(obj: T, msg: string, ...args: Array<any>): void {
		return this.logger.trace(obj, msg, args);
	}
}
