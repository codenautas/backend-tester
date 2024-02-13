"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = exports.console_log = exports.startServer = void 0;
const discrepances = require("discrepances");
const like_ar_1 = require("like-ar");
const JSON4all = require("json4all");
const guarantee_type_1 = require("guarantee-type");
const cast_error_1 = require("cast-error");
const fs_1 = require("fs");
const cast_error_2 = require("cast-error");
const likeAr = require("like-ar");
const MODE = 'api';
async function startServer(server) {
    await server.start();
    if (!server.config.db.database.includes("autotest")) {
        throw new Error("Para correr los casos de prueba hay que usar un base de datos que contenga 'autotest' en el nombre");
    }
    if (MODE == 'api') {
        console.log('opened!');
    }
    try {
        await fs_1.promises.unlink('local-log-all.sql');
    }
    catch (err) {
        if ((0, cast_error_1.expected)(err).code != 'ENOENT')
            throw err;
    }
    server.setLog({ until: '5m' });
    return server;
}
exports.startServer = startServer;
function console_log(x) {
    console.log('____________', x);
    return x;
}
exports.console_log = console_log;
if (!console_log)
    console.log('dummy');
const unkonwTypeDescription = guarantee_type_1.is.object({});
class Session {
    server;
    connstr;
    tableDefs = {};
    cookies = [];
    sessionInfo = {};
    constructor(server, port) {
        this.server = server;
        this.connstr = `http://localhost:${port ?? server.config.server.port}${server.config.server["base-url"]}`;
    }
    async request(params) {
        const { path, payload, method, onlyHeaders, noParseResult } = params;
        const body = payload ? new URLSearchParams(payload) : null;
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };
        if (this.cookies.length) {
            headers.Cookie = this.cookies[0].split(';')[0];
        }
        try {
            const request = await fetch(this.connstr + path, { method: method ?? 'post', headers, body, redirect: 'manual' });
            if (onlyHeaders) {
                return request;
            }
            else if (noParseResult) {
                return await request.text();
            }
            else {
                return await this.getResult(request);
            }
        }
        catch (err) {
            const error = (0, cast_error_2.unexpected)(err);
            console.log(error);
            if (error.cause)
                throw error;
            throw error;
        }
    }
    async getResult(request) {
        const result = await request.text();
        const lines = result.split(/\r?\n/);
        do {
            const line = lines.shift();
            if (line == '--')
                return JSON4all.parse(lines.shift() || 'null');
            try {
                var obj = JSON4all.parse(line || '{}'); // eslint-disable-line no-var
            }
            catch (err) {
                console.log('Json error:', line);
                throw err;
            }
            if (obj.error)
                throw new Error("Backend error: " + obj.error.message);
        } while (lines.length);
        throw new Error('result not received');
    }
    async login(params) {
        const request = await this.request({ path: '/login', payload: params, onlyHeaders: true });
        // // @ts-expect-error No está definido en node-fetch ni se puede tomar de otro lado. 
        this.cookies = request.headers.getSetCookie();
        if (request.status != 302) {
            try {
                console.log("se esperaba una redirección");
                console.log('request.status', request.status);
            }
            finally {
                throw new Error("se esperaba una redirección"); // eslint-disable-line no-unsafe-finally
            }
        }
        const result = request.headers.get('location');
        if (result == './menu') {
            this.sessionInfo = await this.server.inDbClient(null, async (client) => {
                let sessionInfo = {};
                const result = await client.query(`select * from ${this.server.config.login.table} where ${this.server.config.login.userFieldName} = $1`, [params.username]).fetchUniqueRow();
                for (const field of this.server.config.login.infoFieldList) {
                    sessionInfo[field] = result.row[field];
                }
                return sessionInfo;
            });
            return { ok: {} };
        }
        else if (result == './login') {
            const redirect = await this.request({ path: '/login', method: 'get', noParseResult: true });
            const message = redirect.match(/\berror-message[^>]*>([^<]*)</)?.[1];
            if (message) {
                return { message };
            }
            else {
                throw new Error("no se encuentra el mensaje en: " + redirect);
            }
        }
        else {
            throw new Error("dirección de redirección inesperada: " + result);
        }
    }
    cloneReq() {
        return { user: this.sessionInfo, machineId: 'backend-tester', userAgent: { shortDescription: 'TT' } };
    }
    // @ts-expect-error infinite type
    async saveRecord(table, rowToSave, expectedTypeDescription, status = 'new') {
        const context = this.server.getContext(this.cloneReq());
        const tableDef = this.server.tableStructures[table](context);
        for (const fieldDef of tableDef.fields) {
            if (fieldDef.defaultValue) {
                rowToSave[fieldDef.name] = fieldDef.defaultValue;
            }
        }
        const result = await this.request({
            path: '/table_record_save',
            payload: {
                table,
                primaryKeyValues: JSON4all.stringify(tableDef.primaryKey.map(f => rowToSave[f])),
                newRow: JSON4all.stringify(rowToSave),
                oldRow: JSON4all.stringify({}),
                status
            }
        });
        const { command, row } = (0, guarantee_type_1.guarantee)(guarantee_type_1.is.object({ command: guarantee_type_1.is.string, row: expectedTypeDescription }), result);
        discrepances.showAndThrow(command, discrepances.test(x => x == 'INSERT' || x == 'UPDATE'));
        return row;
    }
    async tableData(table, rows, compare, opts) {
        var fixedFields = opts?.fixedFields ?? [];
        if (!(fixedFields instanceof Array)) {
            fixedFields = likeAr(fixedFields).map((value, key) => ({ fieldName: key, value })).array();
        }
        const result = await this.request({
            path: '/table_data',
            payload: {
                table,
                paramFun: '{}',
                ...opts,
                fixedFields: JSON.stringify(fixedFields)
            }
        });
        const response = (0, guarantee_type_1.guarantee)(guarantee_type_1.is.array.object({}), result);
        const existColumn = (0, like_ar_1.LikeAr)(rows[0]).map(_ => true).plain();
        const filteredReponseRows = response.map(row => (0, like_ar_1.LikeAr)(row).filter((_, k) => existColumn[k]).plain());
        switch (compare) {
            case 'all':
                discrepances.showAndThrow(filteredReponseRows, rows);
                break;
            default:
                throw new Error('mode not recognized ' + compare);
        }
    }
    async setTableData(table, rows, compare) {
        for (const row of rows) {
            await this.saveRecord(table, row, unkonwTypeDescription);
        }
        return this.tableData(table, rows, compare);
    }
}
exports.Session = Session;
//# sourceMappingURL=backend-tester.js.map