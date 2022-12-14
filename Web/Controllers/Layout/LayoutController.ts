import { Controller, Param, Body, Get, Post, Put, Delete, UseBefore } from 'routing-controllers';
import { LayoutRoute } from '../../../Services/WebAdmin/Routes';
import { WebAdminSession } from '../../../Services/WebAdmin';
import { SmershController, Api } from '../../Framework';
import { AxiosRequestConfig } from 'axios';
import { PostLayoutModel } from './PostLayoutModel';
import { json } from 'body-parser'

@Controller()
export class LayoutController extends SmershController {

    @Get('/layout')
    public getLayout() {
        const session = WebAdminSession.get();


        const result = session.navigate(LayoutRoute.GetLayout.Action)
        return result.then(async dom => {
            if (dom) {
                const campaign = Object.values(dom.window.document.querySelectorAll(`[id^='sgterritory_']`))
                const layout = Object.fromEntries(campaign.map((item, index) => {
                    let territoryArray = item['value'].split('\n')

                    return [item.parentElement.children[0]['innerHTML'], territoryArray]
                }).filter(i => i))

                return layout
            }
        })
    }

    @Post('/layout/post')
    @UseBefore(json())
    public PostLayout(@Body() model: PostLayoutModel) {

        if (model && model.layout) {
            return this.callApi(model.layout)
        }

        const session = WebAdminSession.get();
        const result = session.navigate(LayoutRoute.PostLayout.Action)
        return result.then(async dom => {
            if (dom) {
                const campaign = Object.values(dom.window.document.querySelectorAll(`[id^='sgterritory_']`))
                const layout = Object.fromEntries(campaign.map(item => {
                    let territoryArray = item['value'].split('\n')

                    return [item.parentElement.children[0]['innerHTML'], territoryArray]
                }).filter(i => i))

                return this.callApi(layout)
            }
        })
    }

    public async callApi(layout: Record<string, string[]>) {
        const env = process.env;
        const url = env["BASE_URL"] + LayoutRoute.PostLayout.Action
        const config: AxiosRequestConfig =
        {
            headers: {
                "Content-type": "application/x-www-form-urlencoded"
            },
        }

        const urlencoded = new URLSearchParams();
        urlencoded.append('campaignname', '')
        urlencoded.append('territoryCount', '10')
        urlencoded.append('currentTheater', '0')
        urlencoded.append('viewingTheater', '0')

        const client = Api.axios();

        const parsed = Object.fromEntries(Object.values(layout).map((territory: string[], index) => {
            const key = `sg_territory_`
            urlencoded.append(key + index, territory.join('\n'))
            return [key + index, territory]
        }))
        urlencoded.append('save', 'save')
        await client.post(url, urlencoded, config).then(result => {
            //this.log.info(JSON.stringify(result))
        });
        return layout
    }
}