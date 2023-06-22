import datastore from './datastore';
import { Controller, Get, Tags, Query, Route, SuccessResponse, Security } from "tsoa";

export interface ApiUser {
    /** @isInt @format int64 */
    id: number;
    api_key: string;
    description?: string;
    /** @isDate @format date */
    date_created: string;
    origin?: string;
}

@Route("/api/users")
@Tags("API")
export class ApiController extends Controller {
    /**
     *  Retrieves a list of API users.
     *  @summary API User List.
    */
    @Security("bearerAuth", ["admin"])
    @SuccessResponse("200", "OK")
    @Get()
    public async getUsers(@Query() page: number = 0, @Query() limit: number = 50): Promise<ApiUser[]> {
        const users = await datastore.getApiUsers({ page, limit });
        users.forEach(u => {
            delete u.email;
            delete u.canReport;
            delete u.canSubmit;
            delete u.canScreenshot;
            delete u.banned;
        });
        return users as ApiUser[]
    }
}
