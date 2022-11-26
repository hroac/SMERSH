﻿import { Controller, Param, Body, Get, Post, Put, Delete } from 'routing-controllers';
import { WebAdminSession } from '../../../Services/WebAdmin';
import { ChatRoute } from '../../../Services/WebAdmin/Routes';
import { Logger, dummyLogger, Logger as ILogger } from "ts-log";
import { SmershController } from '../../Framework'
import * as Main from "dotenv/lib/main";


@Controller()
export class CurrentChatController extends SmershController {

    @Get(ChatRoute.GetChat.Action)
    public getCurrentChat() {
        const session = WebAdminSession.get();
        const messages = []


        const result = session.navigate(ChatRoute.GetChat.Action)
        return result.then(dom => {
            //this.log.info(dom)
            //this.log.info(dom.window)
            //this.log.info(dom.window.document)
            if (dom) {
               // this.log.info(dom)
                //this.log.info(dom.window)
               // this.log.info(dom.window.document)
                this.log.info(dom.window.document.querySelectorAll(".chatmessage").length)
                dom.window.document.querySelectorAll(".chatmessage").forEach(msg => {
                    let username
                    let message
                    let visibility

                    if (msg.querySelector('.username')) {
                        username = msg.querySelector('.username').innerHTML
                    }

                    if (msg.querySelector('.message')) {
                        message = msg.querySelector('.message').innerHTML
                    }

                    if (msg.querySelector('.teamnotice')) {
                        visibility = msg.querySelector('.teamnotice').innerHTML
                    }
                    const usermsg = {
                        username,
                        message,
                        visibility
                    }
                    console.log(usermsg)
                    this.log.info(usermsg)
                    messages.push(usermsg)
                })
            }

            return messages
        })
    }

    public returnChat(messages: any) {

    }
}