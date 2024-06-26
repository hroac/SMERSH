﻿declare module 'axios' {
    interface AxiosRequestConfig {
        jar?: CookieJar;
    }
}

import axios, { isCancel, AxiosError, AxiosInstance, AxiosRequestConfig as RequestConfig } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar, Cookie } from 'tough-cookie';
import * as dotenv from 'dotenv';
export interface AxiosRequestConfig extends RequestConfig {
    jar?: CookieJar;
}
export class Api {

    public static _instance: Api;

    public client: AxiosInstance;

    public constructor(cookieJar?: CookieJar) {
        const jar = !cookieJar && new CookieJar();

        if (jar) {
            const env = process.env;
            const authcred = env['WEBADMIN_AUTHCRED'];
            const url = env["BASE_URL"];

            const parsed = Api.parse(url);
            const authCookiePart = `authcred=${authcred}`
            let cookie = Cookie.parse(authCookiePart);
            cookie.path = parsed.pathName;
            cookie.domain = parsed.hostname;

            jar.setCookie(cookie, url)
        }

        const client = wrapper(axios.create({ jar: cookieJar || jar }));

        this.client = client;
    }

    public static axios(cookieJar?: CookieJar) {
        if (!this._instance) {
            this._instance = new Api(cookieJar);
        }

        return this._instance.client;



    }

    private static parse(url: string) {
        const parts = {
            head: '',
            hostname: '',
            pathName: ''
        }

        if (url.includes('//')) {
            parts.head = `${url.split('//')[0]}//`
            url = url.split('//')[1]
        }
        if (url.includes('/')) {
            parts.hostname = url.split('/')[0]
            parts.pathName = `/${url.split('/')[1]}/`
        }

        if (parts.hostname.includes(':')) {
            parts.hostname = parts.hostname.split(':')[0]
        }
        return parts
    }
}