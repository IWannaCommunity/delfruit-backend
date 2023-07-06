
import mysql, { ConnectionOptions } from 'mysql2';
import Config from './model/config';
let config: Config = require('./config/config.json');

export class Database {
    private connection: Connection;

    /**
     * 
     * @param configOverride if provided, forces a connection configuration.
     * Really only used for integration testing - always use the parameterless version in prod.
     */
    constructor(configOverride?: mysql.ConnectionOptions) {
        let useConfig: mysql.Connection = { ...config.db };
        if (configOverride) {
            useConfig = configOverride;
        }
        this.connection = mysql.createConnection(useConfig);

        this.connection.on('error', function(err) {
            console.log('Error occurred on DB connection!')
            console.log(err); // 'ER_BAD_DB_ERROR'
        });
    }

    query(sql: string, args?: any[]): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, args, (err, rows) => {
                if (err) reject(err);
                else resolve(rows as any[]);
            });
        });
    }

    execute(sql: string, args?: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            this.connection.query(sql, args, (err, rows) => {
                if (err) reject(err);
                else resolve(rows as any);
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            this.connection.end(err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async tableExists(): Promise<boolean> {
        const exists = await this.query("CALL sys.table_exists(database(), 'User', @exists); SELECT @exists;");
        console.log(exists);
        if (typeof (exists) !== "string") {
            return false
        }
        switch (exists) {
            case '':
                return false;
            case "BASE TABLE":
                return true
            case "VIEW":
                return true
            case "TEMPORARY":
                return true
            default:
                return false;
        }
    }



}



