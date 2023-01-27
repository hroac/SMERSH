﻿import { SearchClient } from '../../Elastic/SearchClient'
import { Injectable } from '@nestjs/common';
import { Guid } from 'guid-typescript'
import { IndexedClass } from '../../SMERSH/Utilities/types'

@Injectable()
export class Repository {

    public async Get<T, K>(id: Guid): Promise<K> {
        const newType  = {} as IndexedClass<T>;
        const domain: K = {} as K;

        const newCls = new newType() as IndexedClass<T>;
        let report : T = await SearchClient.Get<T>(id)

        if (!report) {
            newCls['Id'] = id
            report = await SearchClient.Put(newType) as T
        }

        Object.keys(report).forEach(key => {
            domain[key] = report[key]
        })

        return domain
    }

}