import { RedisClient, ResCallbackT, createClient } from 'redis';
import { Config } from './Config'
import {Limits} from "./Limits";

export class AsyncClient {
    private readonly _client : RedisClient;
    constructor(redisConfig : Config) {
        this._client = createClient(redisConfig);
    }

    private static redisCall<T>(method: (...args: any[]) => boolean, ...args: any[]) {
        return new Promise<T>((resolve, reject) => {
            method(...args, (e, r) => {
                if (e) reject(e);
                else resolve(r);
            });
        });
    }

    async del(name: string) {
        return await AsyncClient.redisCall<void>(this._client.del.bind(this._client), name);
    }

    async hget(name: string, field: string) {
        return await AsyncClient.redisCall<string>(this._client.hget.bind(this._client), name, field);
    }

    async hgetall(name: string) {
        return await AsyncClient.redisCall<Map<string, any>>(this._client.hgetall.bind(this._client), name);
    }

    async hset(name: string, field: string, value: any) {
        return await AsyncClient.redisCall<void>(this._client.hset.bind(this._client), name, field, value);
    }

    async hmset(name: string, fields: Map<string, any>) {
        let args = new Array<any>();
        args.push(name);
        for (let key in fields) {
            args.push(key, fields[key])
        }
        return await AsyncClient.redisCall<void>(this._client.hmset.bind(this._client), args);
    }

    async hdel(name: string, field: string) {
        return await AsyncClient.redisCall<void>(this._client.hdel.bind(this._client), name, field);
    }

    async zadd(name: string, field: string, score: number) {
        return await AsyncClient.redisCall<void>(this._client.zadd.bind(this._client), name, score, field);
    }

    async zrem(name: string, field: string) {
        return await AsyncClient.redisCall<void>(this._client.zrem.bind(this._client), name, field);
    }

    async zrank(name: string, member: string) {
        return await AsyncClient.redisCall<number|null>(this._client.zrank.bind(this._client), name, member);
    }

    async zrangebyscore<T>(name: string, min?: number, max?: number, limitSettings?: Limits) {
        let args = new Array<any>();
        args.push(name);
        args.push(min == null ? '-inf' : min);
        args.push(max == null ? '+inf' : max);
        if (limitSettings != null) {
            args.push('LIMIT');
            args.push(limitSettings.offset);
            args.push(limitSettings.count);
        }
        return await AsyncClient.redisCall<T[]>(this._client.zrangebyscore.bind(this._client), args);
    }

    async sadd(name: string, value: string) {
        return await AsyncClient.redisCall<void>(this._client.sadd.bind(this._client), name, value);
    }

    async srem(name: string, value: string) {
        return await AsyncClient.redisCall<void>(this._client.srem.bind(this._client), name, value);
    }

    async smembers<T>(name: string) {
        return await AsyncClient.redisCall<T[]>(this._client.smembers.bind(this._client), name);
    }
}