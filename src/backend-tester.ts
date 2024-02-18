"use strict";

import { AppBackend } from 'backend-plus';

import * as discrepances from 'discrepances';
import { TableDefinition } from 'backend-plus';

import { LikeAr } from 'like-ar';
import * as JSON4all from 'json4all';

import { DefinedType, Description, guarantee, is } from "guarantee-type";

import { expected } from "cast-error";

import { promises as fs } from 'fs';

import likeAr = require('like-ar');

const MODE = 'api';

export async function startServer<TApp extends AppBackend>(server: TApp){
    await server.start();
    if (!server.config.db.database.includes("autotest")) {
        throw new Error("Para correr los casos de prueba hay que usar un base de datos que contenga 'autotest' en el nombre");
    }
    if (MODE == 'api') {
        console.log('opened!');
    }
    try {
        await fs.unlink('local-log-all.sql')
    } catch (err) {
        if (expected(err).code != 'ENOENT') throw err;
    }
    server.setLog({until:'5m'});
    return server;
}

export function console_log<T>(x:T){
    console.log('____________',x)
    return x;
}

if (!console_log) console.log('dummy');

// /*
declare global {
    // const fetch: typeof import("node-fetch").default;
    // const FormData: typeof import("form-data");
}
// */

/*
import * as from "node-fetch";
// var fetch: typeof import("node-fetch").default;
import * as FormData from "form-data";
*/

type Payload = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type FieldValue = any; // eslint-disable-line @typescript-eslint/no-explicit-any

type Methods = 'post'|'get'
const unkonwTypeDescription = is.object({});

export class Session<TApp extends AppBackend>{
    private connstr:string
    public tableDefs: Record<string,TableDefinition> = {}
    private cookies:string[] = []
    private sessionInfo:Record<string, string> = {}
    constructor(private server:TApp, port?:number){
        this.connstr = `http://localhost:${port ?? server.config.server.port}${server.config.server["base-url"]}`;
    }
    async request(_params:{path:string, payload:Payload, onlyHeaders:boolean}):ReturnType<typeof fetch>;
    async request<T = Payload>(_params:{path:string, payload:Payload}):Promise<T>;
    async request(_params:{path:string, method:'get', noParseResult:true}):Promise<string>;
    async request(params:{path:string, method?:Methods, payload?:Payload, onlyHeaders?:boolean, noParseResult?:boolean}){
        const {path, payload, method, onlyHeaders, noParseResult} = params;
        const body = payload ? new URLSearchParams(payload) : null;
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        } as Record<string, string>
        if (this.cookies.length) {
            headers.Cookie = this.cookies[0].split(';')[0];
        }
        try {
            const request = await fetch(this.connstr+path, {method:method ?? 'post', headers, body, redirect: 'manual'});
            if (onlyHeaders) {
                return request;
            } else if (noParseResult) {
                return await request.text();
            } else {
                return await this.getResult(request);
            }
        } catch (err) {
            const error = expected(err);
            if (error.cause) throw error.cause;
            throw error;
        }
    }
    async getResult(request:Awaited<ReturnType<typeof fetch>>){
        const result = await request.text();
        const lines = result.split(/\r?\n/);
        do {
            const line = lines.shift();
            if (line == '--') return JSON4all.parse( lines.shift() || 'null')
            try{
                var obj = JSON4all.parse( line || '{}' ) as {error:{message:string}}; // eslint-disable-line no-var
            }catch(err){
                console.log('Json error:',line)
                throw err; 
            }
            if (obj.error) throw new Error("Backend error: " + obj.error.message);
        } while (lines.length);
        throw new Error('result not received')
    }
    async login(params:{username:string, password:string}){
        const request = await this.request({path:'/login', payload:params, onlyHeaders:true});
        // // @ts-expect-error No está definido en node-fetch ni se puede tomar de otro lado. 
        this.cookies = request.headers.getSetCookie();
        if (request.status != 302){ 
            try{
                console.log("se esperaba una redirección");
                console.log('request.status', request.status);
            } finally {
                throw new Error("se esperaba una redirección"); // eslint-disable-line no-unsafe-finally
            }
        }
        const result = request.headers.get('location');
        if (result=='./menu') {
            this.sessionInfo = await this.server.inDbClient(null, async client => {
                let sessionInfo: Record<string, string> = {}
                const result = await client.query(
                    `select * from ${this.server.config.login.table} where ${this.server.config.login.userFieldName} = $1`,
                    [params.username]
                ).fetchUniqueRow();
                for (const field of this.server.config.login.infoFieldList) {
                    sessionInfo[field] = result.row[field];
                }
                return sessionInfo;
            })
            return {ok:{}}
        } else if (result=='./login') {
            const redirect = await this.request({path:'/login', method:'get', noParseResult:true});
            const message = redirect.match(/\berror-message[^>]*>([^<]*)</)?.[1];
            if (message) {
                return {message}
            } else {
                throw new Error("no se encuentra el mensaje en: "+redirect);    
            }
        } else {
            throw new Error("dirección de redirección inesperada: "+result);
        }
    }
    private cloneReq():FieldValue{
        return {user: this.sessionInfo, machineId: 'backend-tester', userAgent: {shortDescription: 'TT'}}
    }
    // @ts-expect-error infinite type
    async saveRecord<T extends Description>(table:string, rowToSave:Record<string, FieldValue>, expectedTypeDescription:T, status:'new'|'update'='new'):Promise<DefinedType<T>>{
        const context = this.server.getContext(this.cloneReq());
        const tableDef = this.server.tableStructures[table](context);
        for (const fieldDef of tableDef.fields) {
            if (fieldDef.defaultValue) {
                rowToSave[fieldDef.name] = fieldDef.defaultValue;
            }
        }
        const result = await this.request({
            path:'/table_record_save',
            payload:{
                table,
                primaryKeyValues: JSON4all.stringify(tableDef.primaryKey.map(f => rowToSave[f])),
                newRow: JSON4all.stringify(rowToSave),
                oldRow: JSON4all.stringify({}),
                status
            }
        })
        const {command, row} = guarantee(is.object({command: is.string, row:expectedTypeDescription}), result);
        discrepances.showAndThrow(command, discrepances.test(x => x=='INSERT' || x=='UPDATE'));
        return row;
    }
    async tableData(table:string, rows:Record<string, FieldValue>[], compare:'all',opts?:{fixedFields?:{fieldName:string, value:FieldValue}[]|Record<string, FieldValue>}){
        var fixedFields = opts?.fixedFields ?? [];
        if (!(fixedFields instanceof Array)) {
            fixedFields = likeAr(fixedFields).map((value, key) => ({fieldName:key, value})).array();
        }
        const result = await this.request({
            path:'/table_data',
            payload:{
                table,
                paramFun:'{}',
                ...opts,
                fixedFields:JSON.stringify(fixedFields)
            }
        })
        const response = guarantee(is.array.object({}), result);
        const existColumn = LikeAr(rows[0]).map(_ => true).plain();
        const filteredReponseRows = response.map(row => LikeAr(row).filter((_,k) => existColumn[k]).plain());
        switch(compare){
            case 'all': discrepances.showAndThrow(filteredReponseRows, rows);
            break;
            default:
                throw new Error('mode not recognized '+compare);
        }
    }
    async setTableData(table:string, rows:Record<string, FieldValue>[], compare:'all'){
        for (const row of rows) {
            await this.saveRecord(table, row, unkonwTypeDescription);
        }
        return this.tableData(table, rows, compare);
    }
}

