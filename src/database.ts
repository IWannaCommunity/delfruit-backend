import mysql, {
	type Connection,
	ConnectionOptions,
	type PrepareStatementInfo,
	type QueryError,
} from "mysql2";
import type Config from "./model/config";

const config: Config = require("./config/config.json");

export class Database {
	private connection: Connection;

	/**
	 *
	 * @param configOverride if provided, forces a connection configuration.
	 * Really only used for integration testing - always use the parameterless version in prod.
	 */
	constructor(configOverride?: mysql.ConnectionOptions) {
		let useConfig: mysql.ConnectionOptions = { ...config.db };
		if (configOverride) {
			useConfig = configOverride;
		}
		this.connection = mysql.createConnection(useConfig);

		this.connection.on("error", (err) => {
			console.log("Error occurred on DB connection!");
			console.log(err); // 'ER_BAD_DB_ERROR'
		});
	}

	prepare(sql: string): Promise<PrepareStatementInfo> {
		// TODO: I'd hate to use promisify for these and others, but...
		return new Promise((resolve, reject) => {
			this.connection.prepare(
				sql,
				(e: QueryError, stmt: PrepareStatementInfo) => {
					if (e) {
						reject(e);
					} else {
						resolve(stmt);
					}
				},
			);
		});
	}

	execute_p(stmt: PrepareStatementInfo, args?: any[]): Promise<Array<unknown>> {
		return new Promise((resolve, reject) => {
			stmt.execute(
				args,
				(e: QueryError, rows: Array<any>, columns: Array<any>) => {
					if (e) {
						stmt.close();
						reject(e);
					} else {
						stmt.close();
						resolve(rows);
					}
				},
			);
		});
	}

	query(sql: string, args?: any[]): Promise<any[]> {
		console.log(sql);
		args = args ?? [];
		if (typeof args !== "object") {
			console.warn("Argument passed in was not an array.");
			args = [args];
		}
		return new Promise((resolve, reject) => {
			this.connection.prepare(sql, (e, stmt) => {
				if (e) reject(e);
				else {
					console.log("query");
					console.log(args);
					// WTF: unfixed prepared statement bug from 2020, wow (https://github.com/sidorares/node-mysql2/issues/1239#issuecomment-766867699)
					// FIX: issue is fixed by wrapping numbers into strings, then letting a adapter driver resolve it's actual type
					if (typeof args === "object") {
						args = args.map((v) => {
							if (typeof v === "number") {
								return String(v);
							} else {
								return v;
							}
						});
					}
					console.log(args);

					stmt.execute(args, (err, rows) => {
						if (err) {
							stmt.close();
							reject(err);
						} else resolve(rows as any[]);
					});
				}
			});
		});
	}

	query_unsafe(sql: string, args?: any[]): Promise<any[]> {
		args = args ?? [];
		if (typeof args !== "object") {
			console.warn("Argument passed in was not an array.");
			args = [args];
		}

		if (typeof args === "object") {
			args = args.map((v) => {
				if (typeof v === "string") {
					return this.connection.escape(v);
				} else {
					return v;
				}
			});
		}
		console.log(sql);

		return new Promise((resolve, reject) => {
			this.connection.query(sql, args, (e, rows) => {
				if (e) reject(e);
				else {
					resolve(rows as any[]);
				}
			});
		});
	}

	execute(sql: string, args?: any[]): Promise<any> {
		args = args ?? [];
		if (typeof args !== "object") {
			console.warn("Argument passed in was not an array.");
			args = [args];
		}

		console.log(sql);
		return new Promise((resolve, reject) => {
			this.connection.prepare(sql, (e, stmt) => {
				if (e) reject(e);
				else {
					console.log("execute");
					console.log(args);
					if (typeof args === "object") {
						args = args.map((v) => {
							if (typeof v === "number") {
								return String(v);
							} else {
								return v;
							}
						});
					}
					stmt.execute(args, (err, rows) => {
						if (err) {
							stmt.close();
							reject(err);
						} else resolve(rows as any[]);
					});
				}
			});
		});
	}

	close() {
		return new Promise((resolve, reject) => {
			this.connection.end((err) => {
				if (err) reject(err);
				else resolve({});
			});
		});
	}

	async tableExists(): Promise<boolean> {
		const exists = await this.query(
			"CALL sys.table_exists(database(), 'User', @exists); SELECT @exists;",
		);
		console.log(exists);
		if (typeof exists !== "string") {
			return false;
		}
		switch (exists) {
			case "":
				return false;
			case "BASE TABLE":
				return true;
			case "VIEW":
				return true;
			case "TEMPORARY":
				return true;
			default:
				return false;
		}
	}
}
