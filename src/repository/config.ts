import fs from "node:fs";

import type { Config as TConfig } from "../model/config";

const fsA = fs.promises;

type ListenerFn = (evt: string, f: string | Buffer) => void;

export default class Config {
	private configFileContents: string = undefined;

	private inner: TConfig = undefined;

	private watcher: fsA.FSWatcher = undefined;

	private deserializeToTypedObject() {
		try {
			this.inner = JSON.parse(this.configFileContents); //satisfies TConfig;
		} catch (e) {
			//console.log(e);
			throw e;
		}
	}

	private async loadConfigFromFile(private filePath?: string, onChange?: Function, signal?: AbortSignal) {
        await fsA.readFile(
            filePath ?? "./src/config/config.json",
            { encoding: "utf-8", flag: "r" },
            (e, fContents) => {
                if (e) throw e;
                this.configFileContents = fContents.toString();
            },
        );
        // HACK: do double the work because nodejs devs are retarded.
        // this api doesn't return anything if it doesn't work
        if ((this.configFileContents === null) || (this.configFileContents === void 0)) {
            this.configFileContents = fs.readFileSync(filePath ?? "./src/config/config.json", { encoding: "utf-8", flag: "r" }).toString();
        }

        if ((this.watcher !== undefined) || (this.watcher !== null)) {
            const opts = { persistent: false, encoding: "utf-8" };
            this.watcher = fs.watch(filePath ?? "./src/config/config.json", opts, onChange, signal);
        }
    }

	private async loadAndDeserialize(private filePath?: string, private onChange?: Function, private signal?: AbortSignal) {
        // TODO: check if configFileContents is null
        await this.loadConfigFromFile(filePath, onChange, signal);
        this.deserializeToTypedObject();
    }

	constructor() {}

	async init(filePath?: string, onChange?: ListenerFn, signal?: AbortSignal) {
		await this.loadAndDeserialize(filePath, onChange, signal);
	}

	public async clearAndReload(filePath?: string) {
		this.configFileContents = void 0;
		await this.loadAndDeserialize(filePath);
		this.deserializeToTypedObject();
	}

	getConfig(): TConfig {
		return this.inner;
	}
}
