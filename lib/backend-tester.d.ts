/// <reference types="node" />
import { AppBackend } from 'backend-plus';
import { TableDefinition } from 'backend-plus';
import { DefinedType, Description } from "guarantee-type";
export declare function startServer<TApp extends AppBackend>(server: TApp): Promise<TApp>;
export declare function console_log<T>(x: T): T;
declare global {
}
type Payload = any;
type FieldValue = any;
export declare class Session<TApp extends AppBackend> {
    private server;
    private connstr;
    tableDefs: Record<string, TableDefinition>;
    private cookies;
    private sessionInfo;
    constructor(server: TApp, port?: number);
    request(_params: {
        path: string;
        payload: Payload;
        onlyHeaders: boolean;
    }): ReturnType<typeof fetch>;
    request<T = Payload>(_params: {
        path: string;
        payload: Payload;
    }): Promise<T>;
    request(_params: {
        path: string;
        method: 'get';
        noParseResult: true;
    }): Promise<string>;
    getResult(request: Awaited<ReturnType<typeof fetch>>): Promise<unknown>;
    login(params: {
        username: string;
        password: string;
    }): Promise<{
        ok: {};
        message?: undefined;
    } | {
        message: string;
        ok?: undefined;
    }>;
    private cloneReq;
    saveRecord<T extends Description>(table: string, rowToSave: Record<string, FieldValue>, expectedTypeDescription: T, status?: 'new' | 'update'): Promise<DefinedType<T>>;
    tableData(table: string, rows: Record<string, FieldValue>[], compare: 'all', opts?: {
        fixedFields?: {
            fieldName: string;
            value: FieldValue;
        }[] | Record<string, FieldValue>;
    }): Promise<void>;
    setTableData(table: string, rows: Record<string, FieldValue>[], compare: 'all'): Promise<void>;
}
export {};
