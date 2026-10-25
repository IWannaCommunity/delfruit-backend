export default class WhereList {
    private columns: string[] = [];
    private params: any[] = [];

    private clauseType: "WHERE"|"HAVING";

    public constructor(type?:"WHERE"|"HAVING") {
        this.clauseType = type || "WHERE";
    }

    public add(column: string, value: any): boolean {
        if (value === undefined || value === null) return false;
        this.columns.push(`(${column} = ?)`);
        this.params.push(value);
        return true;
    }

    public add2(column: string, value: any): boolean {
        this.columns.push(`(${column})`);
        this.params.push(value);
        return true;
    }
    
    public addPhrase(phrase: string, ...value: any[]): boolean {
        if (value === undefined || !value || value.length == 0) return false;
        this.columns.push("("+phrase+")");
        this.params = this.params.concat(value);
        return true;
    }
    
    public addDirect(phrase: string): boolean {
        this.columns.push("("+phrase+")");
        return true;
    }
	
	public addParams(p: string): boolean {
		this.params.push(p);
		return true;
	}

    public addIf(column: string, value: any, condition: boolean): boolean {
        if (!condition) return false;
        return this.add(column,value);
    }

    public addIn(column: string, value?: any[]): boolean {
        if (!value) return false;
        this.columns.push(`(${column} IN (${value.map(s=>"?").join(',')}))`);
        this.params.concat(value);
        return true;
    }

    public getParams(): any[] {
        return this.params;
    }

    public getClause(): string {
        if (this.columns.length == 0) return '';
        return ` ${this.clauseType} ${this.columns.join(' AND ')} `;
    }
}