import { Database } from './database';
import InsertList from './lib/insert-list';
import WhereList from './lib/where-list';
import UpdateList from './lib/update-list';
import moment = require('moment');
import { UserLoginParams } from './model/UserLoginParams';
import { Game } from './model/Game';
import { Screenshot } from './model/Screenshot';
import { Review } from './model/Review';
import { List } from './model/List';
import { GetReviewOptions } from './model/GetReviewOptions';
import { GetScreenshotParms } from './model/GetScreenshotParms';
import { GetGamesParms } from './model/GetGamesParms';
import { GetListsParms } from './model/GetListsParms';
import { News } from './model/News';
import { GetNewsParms } from './model/GetNewsParms';
import whitelist from './lib/whitelist';
import { Report } from './model/Report';
import { GetReportParams } from './model/GetReportParams';
import { GetUsersParms } from './model/GetUsersParms';
import { Permission, DEFAULT_PERMISSIONS } from './model/Permission';
import Config from './model/config';
let config: Config = require('./config/config.json');

var Memcached = require('memcached');
const memcached = new Memcached(config.memcache.hosts, config.memcache.options);

for (let host of config.memcache.hosts) {
    memcached.connect(host, function(err: Error, conn: any) {
        if (err) {
            console.error(`memcached instance was unreachable: ${err}`);
        }
        console.log("memcached instance:", conn.server);
    });
}

export default {
    /**
* return user if user was created
*/
    async addUser(username: string, password: string, email: string): Promise<any> {
        const database = new Database();
        try {
            const userExists = await database.query(`SELECT 1 FROM User WHERE name = ?`, [username]);
            if (userExists.length > 0) return false;

            const result = await database.execute(`
INSERT INTO User (name, phash2, email)
VALUES ( ?, ?, ? )
`, [username, password, email]);

            return this.getUser(result.insertId as number);
        } finally {
            database.close();
        }
    },

    async updateUser(user: any): Promise<boolean> {
        const database = new Database();

        const updateList = new UpdateList();

        updateList.add('phash2', user.phash2);
        updateList.add('email', user.email);

        updateList.add('banned', user.banned);

        updateList.add('twitch_link', user.twitchLink);
        updateList.add('nico_link', user.nicoLink);
        updateList.add('youtube_link', user.youtubeLink);
        updateList.add('twitterLink', user.twitterLink);
        updateList.add('bio', user.bio);
        updateList.add('locale', user.locale);
        updateList.add('unsuccessful_logins', user.unsuccessfulLogins);
        updateList.add('last_ip', user.lastIp);
        updateList.add('date_last_login', user.dateLastLogin);
        updateList.add('selected_badge', user.selected_badge);

        try {
            let params = updateList.getParams();
            params.push(user.id);
            const rows = await database.execute(
                ` UPDATE User ${updateList.getSetClause()} WHERE id = ?`, params);
            return (rows.affectedRows == 1);
        } finally {
            database.close();
        }
    },

    async updateGame(game: Game, isAdmin: boolean): Promise<boolean> {
        const database = new Database();

        const updateList = new UpdateList();

        updateList.addIf('removed', game.removed ? 1 : 0, game.removed !== undefined);
        updateList.add('name', game.name);
        updateList.add('url', game.url);
        updateList.add('url_spdrn', game.urlSpdrn);
        if (game.author) {
            updateList.add('author', game.author.join(' '));
        }
        if (game.dateCreated) {
            const newdate = moment(game.dateCreated).format('YYYY-MM-DD 00:00:00')
            updateList.add('date_created', newdate);
        }
        updateList.add('owner_id', game.ownerId);
        //updateList.add('owner_bio',game.ownerBio);

        try {
            let params = updateList.getParams();
            params.push(game.id);
            const rows = await database.execute(
                ` UPDATE Game ${updateList.getSetClause()} WHERE id = ?`, params);
            uncache(`game-exists-${game.id}`);
            uncache(`game-${game.id}`);
            return (rows.affectedRows == 1);
        } finally {
            database.close();
        }
    },

    async addGame(game: Game, adderId: number): Promise<Game> {
        const database = new Database();
        try {
            //const userExists = await database.query(`SELECT 1 FROM User WHERE name = ?`,[username]);
            //if (userExists.length > 0) return false;

            const insertList = new InsertList();
            insertList.add('name', game.name);
            let sortname = game.name || "";
            sortname = sortname.replace("i wanna be the ", "");
            sortname = sortname.replace("i wanna ", "");
            insertList.add('sortname', sortname);
            insertList.add('url', game.url);
            insertList.add('url_spdrn', game.urlSpdrn);
            insertList.add('author', game.author);
            insertList.add('collab', game.collab ? 1 : 0);
            //insertList.add('date_created',);
            insertList.add('adder_id', adderId);
            insertList.add('removed', 0);
            insertList.add('owner_id', game.ownerId);
            insertList.add('owner_bio', game.ownerBio);

            const result = await database.execute(
                `INSERT INTO Game ${insertList.getClause()}`,
                insertList.getParams());

            const g = await this.getGame(result.insertId as number, database);

            if (!g) throw 'game failed to be created';
            return g;
        } finally {
            database.close();
        }
    },

    async addReport(rpt: Report, adderId: number): Promise<Game> {
        const database = new Database();
        try {
            const insertList = new InsertList();
            insertList.add('type', rpt.type);
            insertList.add('target_id', rpt.targetId);
            insertList.add('report', rpt.report);
            insertList.add('reporter_id', adderId);
            insertList.add('answered_by_id', rpt.answeredById);
            insertList.add('date_answered', rpt.dateAnswered);

            const result = await database.execute(
                `INSERT INTO Report ${insertList.getClause()}`,
                insertList.getParams());

            const n = await this.getReport(result.insertId as number);
            if (!n) throw 'report failed to be created';
            return n;
        } finally {
            database.close();
        }
    },

    async getReports(params: GetReportParams): Promise<Report[]> {
        const database = new Database();

        const whereList = new WhereList();
        whereList.add("r.id", params.id);
        if (params.answered !== undefined) {
            if (params.answered) whereList.addDirect("r.answered_By_id IS NOT NULL");
            else whereList.addDirect("r.answered_By_id IS NULL");
        }

        whereList.add("r.type", params.type);

        const orderCol = whitelist(params.orderCol, ['id', 'date_created'], 'id');
        const orderDir = whitelist(params.orderDir, ['ASC', 'DESC'], 'DESC');

        var query = `
SELECT r.*
, r.target_id as targetId
, r.reporter_id as reporterId
, r.answered_by_id as answeredById
, r.date_created as dateCreated
, r.date_answered as dateAnswered
, u.name as reporterName
, u.selected_badge as reporterSelectedBadge
, ua.name as answeredByName
FROM Report r
LEFT JOIN User u ON u.id=r.reporter_id
LEFT JOIN User ua ON ua.id=r.answered_by_id
${whereList.getClause()}
ORDER BY ${orderCol} ${orderDir}
LIMIT ?,?
`;
        try {
            return await database.execute(query,
                whereList.getParams().concat(params.page * params.limit, params.limit));
        } finally {
            database.close();
        }
    },

    async getReport(id: number): Promise<Report | null> {
        const reports = await this.getReports({ id, page: 0, limit: 1 });
        if (!reports || reports.length == 0) return null;
        return reports[0];
    },

    async updateReport(report: Report): Promise<boolean> {
        const database = new Database();

        const updateList = new UpdateList();

        updateList.add('answered_by_id', report.answeredById);
        updateList.add('date_answered', report.dateAnswered);

        if (!updateList.hasAny()) return true;

        try {
            let params = updateList.getParams();
            params.push(report.id);
            const rows = await database.execute(
                ` UPDATE Report ${updateList.getSetClause()} WHERE id = ?`, params);
            return (rows.affectedRows == 1);
        } finally {
            database.close();
        }
    },

    async addNews(article: News, adderId: number): Promise<Game> {
        const database = new Database();
        try {
            const insertList = new InsertList();
            insertList.add('poster_id', adderId);
            insertList.add('title', article.title);
            insertList.add('short', article.short);
            insertList.add('news', article.news);
            insertList.add('date_created', article.dateCreated);

            const result = await database.execute(
                `INSERT INTO News ${insertList.getClause()}`,
                insertList.getParams());

            const n = await this.getNewses({ id: result.insertId as number, page: 0, limit: 1 });

            if (!n || n.length == 0) throw 'news failed to be created';
            return n[0];
        } finally {
            database.close();
        }
    },

    async updateNews(article: News): Promise<boolean> {
        const database = new Database();

        const updateList = new UpdateList();

        updateList.add('title', article.title);
        updateList.add('short', article.short);
        updateList.add('news', article.news);
        if (article.removed !== undefined) {
            updateList.add('removed', article.removed ? 1 : 0);
        }

        if (!updateList.hasAny()) return true;

        try {
            let params = updateList.getParams();
            params.push(article.id);
            const rows = await database.execute(
                ` UPDATE News ${updateList.getSetClause()} WHERE id = ?`, params);
            return (rows.affectedRows == 1);
        } finally {
            database.close();
        }
    },

    async getNewses(params: GetNewsParms): Promise<News[]> {
        const database = new Database();

        const whereList = new WhereList();
        whereList.add("n.id", params.id);
        if (params.removed !== undefined) {
            whereList.add("n.removed", params.removed ? 1 : 0);
        }

        const orderCol = whitelist(params.orderCol, ['id', 'date_created'], 'id');
        const orderDir = whitelist(params.orderDir, ['ASC', 'DESC'], 'DESC');

        var query = `
SELECT n.*, n.poster_id as posterId, n.date_created as dateCreated
FROM News n
${whereList.getClause()}
ORDER BY ${orderCol} ${orderDir}
LIMIT ?,?
`;
        try {
            return await database.execute(query,
                whereList.getParams().concat(params.page * params.limit, params.limit));
        } finally {
            database.close();
        }
    },

    async getUserForLogin(params: UserLoginParams): Promise<any> {
        const database = new Database();
        let query = `SELECT id,name,phash2 FROM User WHERE`;
        let qparams = [];
        if (params.id != undefined) {
            query += ` id = ? `;
            qparams.push(params.id);
        }
        if (params.name != undefined) {
            query += ` name = ? `;
            qparams.push(params.name);
        }
        const users = await database.query(query, qparams);
        if (users.length == 0) {
            return null;
        }
        return users[0];
    },

    async getLists(params: GetListsParms): Promise<any[]> {
        const database = new Database();

        const whereList = new WhereList();
        whereList.add("l.user_id", params.userId);
        whereList.add("l.game_id", params.gameId);

        var query = `
SELECT *
FROM List l
JOIN ListGame g on g.list_id = l.id
${whereList.getClause()}
`;
        try {
            return await database.execute(query, whereList.getParams());
        } finally {
            database.close();
        }
    },

    async getBadges(options: any): Promise<any[]> {
        const database = new Database();
        try {
            const where = new WhereList();
            where.add('ub.user_id', options.userId);
            var query = `SELECT ub.user_id,ub.badge_id,ub.date_created FROM UserBadge ub ${where.getClause()}`;
            return await database.query(query, where.getParams());
        } finally {
            database.close();
        }
    },

    async getReviews(options: GetReviewOptions): Promise<any[]> {
        const database = new Database();
        try {

            const where = new WhereList();
            where.add('r.game_id', options.game_id);
            where.add('r.user_id', options.user_id);
            where.add('r.id', options.id);
            where.add('r.removed', options.removed);
            where.add('u.banned', options.removed);
            where.add('g.removed', options.removed);
            if (options.includeOwnerReview === false) {
                where.addDirect('g.owner_id is null or g.owner_id <> r.user_id');
            }

            let params = [];
            if (options.page !== undefined) {
                params.push(options.page * options.limit!);
                params.push(options.limit);
            }

            var query = `
SELECT r.*,
u.name user_name,
u.selected_badge,
g.name game_name,
COUNT(l.id) AS like_count,
r.user_id = g.owner_id AS owner_review,
r.user_id,
r.game_id
FROM Rating r
JOIN User u ON r.user_id=u.id
JOIN Game g on r.game_id=g.id
LEFT JOIN LikeReview AS l ON l.rating_id = r.id
${where.getClause()}
GROUP BY r.id
${options.textReviewsFirst
? `ORDER BY CASE WHEN (r.comment IS NULL OR r.comment='') THEN 0 ELSE 1 END DESC,
COUNT(l.id) DESC,
r.date_created DESC`
: 'ORDER BY r.date_created DESC'}
${options.page !== undefined ? ' LIMIT ?,? ' : ''}
`;

            const results = await database.query(query, where.getParams().concat(params));

            //the following data is cached, so it's not as bad as it seems at first glance :)
            await Promise.all(results.map(async r => {
                r.tags = await this.getTagsForGame(r.game_id, r.user_id)
            }));

            return results;
        } finally {
            database.close();
        }
    },

    logQuery(query: string, params: any[]) {
        console.log("==QUERY DEBUGGER==")
        console.log(query);
        console.log(params);
    },

    async addReview(review: Review, gameId: number, userId: number): Promise<Review> {
        const database = new Database();
        try {
            await database.execute(
                `DELETE FROM Rating WHERE game_id=? AND user_id=?`,
                [gameId, userId]);

            const insertList = new InsertList();
            insertList.add('game_id', gameId);
            insertList.add('user_id', userId);
            insertList.add('rating', review.rating);
            insertList.add('difficulty', review.difficulty);
            insertList.add('comment', review.comment);

            const result = await database.execute(
                `INSERT INTO Rating ${insertList.getClause()}`,
                insertList.getParams());

            const r = await this.getReview(result.insertId as number);

            if (!r) throw 'rating failed to be created';
            return r;
        } finally {
            database.close();
        }
    },

    async updateReview(review: any): Promise<boolean> {
        const database = new Database();

        const updateList = new UpdateList();

        updateList.add('removed', review.removed ? 1 : 0);
        updateList.add('rating', review.rating);
        updateList.add('difficulty', review.difficulty);
        updateList.add('comment', review.comment);

        if (!updateList.hasAny()) return true;

        try {
            let params = updateList.getParams();
            params.push(review.id);
            const rows = await database.execute(
                ` UPDATE Rating ${updateList.getSetClause()} WHERE id = ?`, params);
            return (rows.affectedRows == 1);
        } finally {
            database.close();
        }
    },

    async addLikeToReview(reviewId: number, userId: number): Promise<boolean> {
        const database = new Database();

        try {
            await database.execute(
                ` INSERT IGNORE INTO LikeReview (rating_id, user_id) VALUES (?,?)`,
                [reviewId, userId]);
            uncache(`review-likes-${reviewId}`);
            return true;
        } finally {
            database.close();
        }
    },

    async removeLikeFromReview(reviewId: number, userId: number): Promise<boolean> {
        const database = new Database();

        try {
            await database.execute(
                ` DELETE FROM LikeReview WHERE rating_id = ? AND user_id = ?`,
                [reviewId, userId]);
            uncache(`review-likes-${reviewId}`);
            return true;
        } finally {
            database.close();
        }
    },

    async isLiked(reviewId: number, userId: number): Promise<boolean> {
        const users = await cache(`review-likes-${reviewId}`, async () => {
            const database = new Database();

            try {
                const results = await database.execute(
                    ` SELECT user_id FROM LikeReview WHERE rating_id = ? AND user_id = ?`,
                    [reviewId, userId]);
                return results.map((r: any) => r.user_id);
            } finally {
                database.close();
            }
        });
        return users.includes(userId);
    },

    async addFollowToUser(targetUserId: number, userId: number): Promise<boolean> {
        const database = new Database();

        try {
            await database.execute(
                ` INSERT IGNORE INTO UserFollow (user_id, user_follow_id) VALUES (?,?)`,
                [targetUserId, userId]);
            return true;
        } finally {
            database.close();
        }
    },

    async removeFollowFromUser(targetUserId: number, userId: number): Promise<boolean> {
        const database = new Database();

        try {
            await database.execute(
                ` DELETE FROM UserFollow WHERE user_id = ? AND user_follow_id = ?`,
                [targetUserId, userId]);
            return true;
        } finally {
            database.close();
        }
    },

    async addList(list: List, userId: number): Promise<List> {
        const database = new Database();
        try {
            const insertList = new InsertList();
            insertList.add('name', list.name);
            insertList.add('user_id', userId);
            insertList.add('description', list.description);
            insertList.addIf('private', list.private ? 1 : 0, list.private !== undefined);

            const result = await database.execute(
                `INSERT INTO List ${insertList.getClause()}`,
                insertList.getParams());

            const l = await this.getList(result.insertId as number);

            if (!l) throw 'list failed to be created';
            return l;
        } finally {
            database.close();
        }
    },

    async getList(id: number): Promise<List | null> {
        //TODO: single pattern
        const database = new Database();
        try {
            let where = new WhereList();
            where.add('l.id', id);

            const lists = await database.query(`
SELECT *, l.user_id as userId
FROM List l
${where.getClause()}
`, where.getParams());
            if (!lists || lists.length == 0) return null;
            const list = lists[0] as List;

            return list;
        } finally {
            database.close();
        }
    },

    async getListGames(id: number): Promise<any[]> {
        const database = new Database();
        try {
            let where = new WhereList();
            where.add('lg.list_id', id);

            return await database.query(`
SELECT lg.game_id
FROM ListGame lg
${where.getClause()}
`, where.getParams());
        } finally {
            database.close();
        }
    },

    async addGameToList(listId: number, gameId: number): Promise<boolean> {
        const database = new Database();
        try {
            let ins = new InsertList();
            ins.add('list_id', listId);
            ins.add('game_id', gameId);

            await database.execute(
                `INSERT INTO ListGame ${ins.getClause()}`,
                ins.getParams());
            return true;
        } finally {
            database.close();
        }
    },

    async getReview(reviewId: number, removed?: boolean): Promise<Review | null> {
        const rows = await this.getReviews({
            id: reviewId,
            includeOwnerReview: true,
            removed
        });
        if (!rows || rows.length == 0) return null;
        return rows[0];
    },

    async getGame(id: number, database?: Database): Promise<Game | null> {
        return await cache(`game-${id}`, async () => {
            const doClose = !database;
            const db = database || new Database();
            const query = `
SELECT g.*
, g.date_created as dateCreated
, g.owner_id as ownerId
, g.author as author_raw
, AVG(r.rating) AS rating
, AVG(r.difficulty) AS difficulty
FROM Game g
LEFT JOIN Rating r ON r.game_id = g.id AND r.removed = 0
WHERE g.id = ?
`;
            try {
                const res = await db.query(query, [id]);
                if (!res || res.length == 0) return null;

                const game = res[0];
                //if zero date, we don't have it, so null it out
                if (!moment(game.dateCreated).isValid()) game.dateCreated = undefined;
                if (game.collab && game.author_raw) game.author = (game.author_raw).split(" ");
                else game.author = game.author_raw ? [game.author_raw] : [];
                delete game.author_raw;

                game.urlSpdrn = game.url_spdrn;
                delete game.url_spdrn;

                delete game.date_created; //dateCreated

                return game;
            } finally {
                if (doClose) db.close();
            }
        });
    },

    async gameExists(id: number): Promise<boolean> {
        return await cache(`game-exists-${id}`, async () => {
            const db = new Database();
            try {
                const res = await db.query(
                    'SELECT 1 FROM Game g WHERE g.id = ? AND g.removed = 0', [id]);
                return (res && res.length == 1);
            } finally {
                db.close();
            }
        });
    },

    async getRandomGame() {
        const database = new Database();
        try {
            const query = `
SELECT COUNT(*) AS cnt FROM Game
WHERE removed=0 AND url != '' AND url IS NOT NULL
`;
            const query2 = `
SELECT id FROM Game
WHERE removed=0 AND url != '' AND url IS NOT NULL
LIMIT 1 OFFSET ?
`;
            const rows = await database.query(query)
            const rows2 = await database.query(query2, [Math.floor(+rows[0].cnt * Math.random())]);
            const res = await this.getGame(rows2[0].id, database);
            return res;
        } finally {
            database.close();
        }
    },

    async getScreenshots(params: GetScreenshotParms): Promise<Screenshot[]> {
        const whereList = new WhereList();
        whereList.add("s.id", params.id);
        whereList.add("s.game_id", params.gameId);
        whereList.addIf("s.approved", params.approved ? 1 : 0, params.approved !== undefined);
        whereList.addIf("s.removed", params.removed ? 1 : 0, params.removed !== undefined);
        whereList.add("s.added_by_id", params.addedById);

        var query = `
SELECT s.*, u.name user_name, g.name game_name, u.selected_badge
, s.game_id as gameId
, s.added_by_id as addedById
FROM Screenshot s
JOIN User u ON s.added_by_id=u.id
JOIN Game g on s.game_id=g.id
${whereList.getClause()}
ORDER BY s.date_created DESC
`;
        const database = new Database();
        try {
            const rows = await database.query(query, whereList.getParams());
            rows.forEach(r => {
                if (r.approved !== null) r.approved = r.approved == 1;
                if (r.removed !== null) r.removed = r.removed == 1;
            });
            return rows;
        } finally {
            database.close();
        }
    },

    async getScreenshot(id: number): Promise<Screenshot | null> {
        const screenshots = await this.getScreenshots({ id, page: 0, limit: 1 });
        if (!screenshots || screenshots.length == 0) return null;
        return screenshots[0];
    },

    async updateScreenshot(ss: Screenshot, isAdmin: boolean): Promise<boolean> {
        const database = new Database();

        const updateList = new UpdateList();

        updateList.addIf('removed', ss.removed ? 1 : 0, ss.removed !== undefined);
        updateList.addIf('approved', ss.approved ? 1 : 0, ss.approved !== undefined);

        if (!updateList.hasAny()) return true;

        try {
            let params = updateList.getParams();
            params.push(ss.id);
            const rows = await database.execute(
                ` UPDATE Screenshot ${updateList.getSetClause()} WHERE id = ?`, params);
            return (rows.affectedRows == 1);
        } finally {
            database.close();
        }
    },

    async addScreenshot(ss: Screenshot, adderId: number, autoApprove: boolean): Promise<Screenshot> {
        const database = new Database();
        try {
            //const userExists = await database.query(`SELECT 1 FROM User WHERE name = ?`,[username]);
            //if (userExists.length > 0) return false;

            const insertList = new InsertList();
            insertList.add('game_id', ss.gameId);
            insertList.add('added_by_id', adderId);
            insertList.addDirect('description', ss.description); //blank description is falsy
            if (autoApprove) {
                insertList.addDirect('approved_by_id', 0);
                insertList.addDirect('approved', 1);
            }

            const result = await database.execute(
                `INSERT INTO Screenshot ${insertList.getClause()}`,
                insertList.getParams());

            const g = await this.getScreenshot(result.insertId as number);

            if (!g) throw 'screenshot failed to be created';
            return g;
        } finally {
            database.close();
        }
    },

    async getTagsForGame(gameId: number, userId?: number) {
        return await cache(`game-tag-${gameId}-${userId}`, async () => {
            const whereList = new WhereList();
            whereList.add('gt.game_id', gameId);
            whereList.add('gt.user_id', userId);

            var query = `
SELECT t.name, t.id
FROM GameTag gt
JOIN Game g on g.id = gt.game_id AND g.removed = 0
JOIN Tag t on t.id = gt.tag_id
${whereList.getClause()}
`;

            const database = new Database();
            try {
                return await database.query(query, whereList.getParams());
            } finally {
                database.close();
            }
        });
    },

    async getTags(tagId?: number, q?: string, name?: string) {
        const whereList = new WhereList();
        whereList.add('t.id', tagId);
        if (q !== undefined) {
            whereList.add2("t.name LIKE ?", '%' + q + '%');
        }
        whereList.add('t.name', name);

        var query = `
SELECT t.name, t.id
FROM Tag t
${whereList.getClause()}
`;

        const database = new Database();
        try {
            return await database.query(query, whereList.getParams());
        } finally {
            database.close();
        }
    },

    async setTags(gameId: number, userId: number, tags: number[]) {
        const database = new Database();
        try {
            await database.execute(
                `DELETE FROM GameTag WHERE game_id=? AND user_id=?`,
                [gameId, userId]);

            for (let tagId of tags) {
                const insertList = new InsertList();
                insertList.add('game_id', gameId);
                insertList.add('user_id', userId);
                insertList.add('tag_id', tagId);

                await database.execute(
                    `INSERT INTO GameTag ${insertList.getClause()}`,
                    insertList.getParams());
            }
            uncache(`game-tag-${gameId}-${userId}`);
        } finally {
            database.close();
        }
    },

    async tagsExist(tagIds: number[]) {
        const database = new Database();
        try {
            const qs = tagIds.map(_ => "?").join(",")
            const res = await database.execute(
                `SELECT COUNT(1) as cnt FROM Tag WHERE id in (${qs})`,
                tagIds);
            return res.length == 1 && res[0].cnt == tagIds.length;
        } finally {
            database.close();
        }
    },

    async createTag(name: string) {
        const database = new Database();
        try {
            const insertList = new InsertList();
            insertList.add('name', name);

            const result = await database.execute(
                `INSERT INTO Tag ${insertList.getClause()}`,
                insertList.getParams());

            return { id: result.insertId, name }
        } finally {
            database.close();
        }
    },

    async countGames(params: GetGamesParms) {
        const rows = await this.getGames(params, true);
        if (!rows || rows.length == 0) return 0;
        return rows[0].total_count;
    },

    async getGames(params: GetGamesParms, countOnly?: boolean) {
        const database = new Database();

        const whereList = new WhereList();
        whereList.add("g.id", params.id);
        whereList.addIf("g.removed", params.removed ? 1 : 0, params.removed !== undefined);

        if (params.q !== undefined) {
            whereList.addPhrase("g.name LIKE ? OR g.author LIKE ?", '%' + params.q + '%', '%' + params.q + '%');
        }

        if (params.name !== undefined) {
            whereList.add2("g.name LIKE ?", '%' + params.name + '%');
        }

        whereList.add("g.owner_id", params.ownerUserId);

        if (params.author !== undefined) {
            whereList.add2("g.author LIKE ?", '%' + params.author + '%');
        }

        if (params.hasDownload !== undefined) {
            if (params.hasDownload) whereList.addDirect("g.url is not null AND g.url != ''");
            else whereList.addDirect("g.url is null OR g.url != ''");
        }

        whereList.add("g.date_created >= ?", params.createdFrom);
        whereList.add("g.date_created <= ?", params.createdTo);

        if (params.reviewedByUserId !== undefined) {
            whereList.add2(
                "g.id IN (SELECT game_id FROM Rating WHERE removed = 0 AND user_id = ?)",
                params.reviewedByUserId);
        }
        //TODO: cleared

        whereList.addIn("gt.name", params.tags);
        if (params.tags !== undefined) {
            whereList.addDirect(`g.id IN (
SELECT game_id
FROM GameTag gt
JOIN Tag t ON t.id=gt.tag_id
WHERE t.name IN (${params.tags.map(s => "?").join(',')})
)`);
        }

        const havingList = new WhereList("HAVING");
        if (params.ratingFrom !== undefined)
        havingList.add2("AVG(r.rating) >= ?", params.ratingFrom);
        if (params.ratingTo !== undefined)
        havingList.add2("AVG(r.rating) <= ?", params.ratingTo);
        if (params.difficultyFrom !== undefined)
        havingList.add2("AVG(r.difficulty) >= ?", params.difficultyFrom);
        if (params.difficultyTo !== undefined)
        havingList.add2("AVG(r.difficulty) <= ?", params.difficultyTo);

        let orderCol = 'date_created';
        if (params.orderCol) {
            const sortWhitelist: { [id: string]: string } = {
                'name': 'g.sortname',
                'date_created': 'g.date_created',
                'rating': 'AVG(r.rating)',
                'difficulty': 'AVG(r.difficulty)',
            };
            orderCol = sortWhitelist[params.orderCol] || 'date_created';
        }

        const query = `
SELECT `+
            (countOnly
                ? `COUNT(1) AS total_count`
                : `g.*,
AVG(r.rating) AS rating,
AVG(r.difficulty) AS difficulty,
g.date_created AS dateCreated,
COUNT(r.id) AS rating_count
`
            ) +
            `
FROM Game g
LEFT JOIN Rating r ON r.removed=0 AND r.game_id=g.id
LEFT JOIN User AS u ON u.id = r.user_id AND u.banned = 0
${whereList.getClause()}` +
            (countOnly
                ? ``
                : `GROUP BY g.id
`
            ) +
            `
${havingList.getClause()}` +
            (countOnly
                ? ``
                : `
ORDER BY ${orderCol} ${params.orderDir || 'ASC'}
LIMIT ?,?
`);

        let queryparms = whereList.getParams()
        .concat(havingList.getParams());
        if (!countOnly) queryparms = queryparms.concat([params.page * params.limit, params.limit]);
        try {
            const rows = await database.query(query, queryparms);

            if (!countOnly) {
                rows.forEach(game => {
                    if (!moment(game.date_created).isValid()) game.date_created = null;
                    if (game.collab == 1) game.author = game.author.split(" ");
                    else game.author = [game.author];
                });
            }
            return rows;
        } finally {
            database.close();
        }
    },

    async getUser(id: number): Promise<any> {
        const users = await this.getUsers({ id, page: 0, limit: 1 });
        if (!users || users.length == 0) return null;
        const user = users[0];
        return user;
    },

    async getUsers(params: GetUsersParms): Promise<any[]> {
        const database = new Database();

        const whereList = new WhereList();
        whereList.add("u.id", params.id);
        if (params.followerUserId !== undefined) {
            whereList.add2("u.id IN (SELECT user_follow_id FROM UserFollow WHERE user_id = ?)", params.followerUserId);
        }
        if (params.banned !== undefined) {
            if (!params.banned) whereList.add("u.banned", 0)
            else whereList.add("u.banned", 1)
        }
        if (params.name !== undefined) {
            whereList.addPhrase("u.name LIKE ?", '%' + params.name + '%');
        }

        const orderCol = whitelist(params.orderCol, ['id', 'date_created'], 'id');
        const orderDir = whitelist(params.orderDir, ['ASC', 'DESC'], 'DESC');

        const query = `
SELECT u.id, u.name, u.date_created as dateCreated
, u.twitch_link as twitchLink, u.youtube_link as youtubeLink
, u.nico_link as nicoLink, u.twitter_link as twitterLink
, u.bio, u.is_admin as isAdmin, u.email

,u.banned as banned

,u.selected_badge

FROM User u
${whereList.getClause()}
ORDER BY ${orderCol} ${orderDir}
LIMIT ?,?
`;
        try {
            const rows = await database.query(query,
                whereList.getParams()
                    .concat([params.page * params.limit, params.limit])
            );
            rows.forEach(u => { u.isAdmin = (u.isAdmin === 1); })
            return rows;
        } finally {
            database.close();
        }
    },

    async getPermissions(userid: number): Promise<any> {
        return await cache('user-perm-' + userid, async () => {
            const database = new Database();

            try {
                let whereList = new WhereList();
                whereList.add("user_id", userid);
                const permRows = await database.query(
                    `SELECT * FROM UserPermission ${whereList.getClause()}`,
                    whereList.getParams());

                let perms = permRows.reduce((o, v) => {
                    o[v.permission_id] = v;
                    return o;
                }, {} as any);

                //add any perms not in the DB
                DEFAULT_PERMISSIONS.filter(p => !perms[p])
                    .forEach(p => {
                        perms[p] = { permission_id: p };
                    });
                return perms;
            } finally {
                database.close();
            }
        });
    },

    async grantPermission(user_id: number, permission: Permission): Promise<any> {
        const database = new Database();

        try {
            await database.execute(
                `INSERT IGNORE INTO UserPermission (user_id,permission_id) VALUES (?,?)`, [user_id, permission]);

            uncache('user-perm-' + user_id);
        } finally {
            database.close();
        }
    },

    async updatePermission(user_id: number, permission: Permission, revokedUntil: string): Promise<any> {
        const database = new Database();

        try {
            await database.execute(
                `INSERT INTO UserPermission (user_id,permission_id,revoked_until)
VALUES (?,?,?)
ON DUPLICATE KEY UPDATE
revoked_until = ?`, [user_id, permission, revokedUntil, revokedUntil]);

            uncache('user-perm-' + user_id);
        } finally {
            database.close();
        }
    },

    async getApiUsers(params: any): Promise<any[]> {
        const database = new Database();

        const query = `
SELECT *

FROM ApiUser u
LIMIT ?,?
`;
        try {
            const rows = await database.query(query,
                [params.page * params.limit, params.limit]
            );
            return rows;
        } finally {
            database.close();
        }
    },
}

async function cache<T>(key: string, supplier: () => Promise<T>): Promise<T> {
    try {
        const cached = await new Promise<T>((r, j) => {
            memcached.get(key, function(err: any, data: any) {
                if (err) j(err); else r(data?.data)
            })
        });
        if (cached) return cached;
    } catch (err) {
        console.log('Error occurred retrieving ' + key + ' from memcache!')
        console.log(err);
    }

    const result = await supplier();
    memcached.set(key, { data: result });
    return result;
}

function uncache(key: string) {
    memcached.del(key);
}
