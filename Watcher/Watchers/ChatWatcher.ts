import { Watcher } from '../Watcher'
import { WebAdminSession } from '../../Services/WebAdmin';
import { ChatRoute } from '../../Services/WebAdmin/Routes';
import { ReceiveChatLinesCommand } from '../../Commands/Round'
import { Guid } from 'guid-typescript'
import { Team } from '../../SMERSH/ValueObjects'
import { ChatQuery, StatusQuery } from '../../Services/WebAdmin/Queries'
import { Status } from 'discord.js';
import { Controller, Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs'
import { SearchClient } from '../../Elastic'
import { RoundSearchReport } from '../../Reports/Entities/round'
import { Client } from '../../Discord/Framework';
import { Commands } from '../Commands'
import { PlayerSearchReport } from '../../Reports/Entities/player';
import { AxiosRequestConfig } from 'axios';
import { Api } from '../../Web/Framework';
import { Message } from '../../SMERSH/ValueObjects/round';

export class ChatWatcher extends Watcher {

    public override async Watch(timeout: number = 50, ...args: Array<{ messages: Array<Message>, players: Array<PlayerSearchReport>}>) {
        const commandNames = Commands.map(command => [command.name, ...command.aliases]).flat()
        const commands = Commands.map(command => command.name).flat()
        const messages = await ChatQuery.Get();
        const lastMessage = messages[messages.length - 1];
        const lastMessageDate = messages.length ? new Date(lastMessage.timestamp) : false;
        const roundInfo = global && global.roundInfo;
        const round = !roundInfo && await (await SearchClient.Search(RoundSearchReport, {
            "query": {
                "match_all": {}
            },
            "size": 1,
            "sort": [
                {
                    "Date": {
                        "order": "desc"
                    }
                }
            ]
        })).shift()
        const roundDate = round ? new Date(round.Date) : roundInfo && roundInfo.date && new Date(roundInfo.date)
        const roundId = round ? round.Id : roundInfo && roundInfo.roundId;
        const axios = Api.axios();
        const env = JSON.parse(process.argv[process.argv.length - 1]);
        const chatUrl = env["BASE_URL"] + ChatRoute.PostChat.Action
        const config: AxiosRequestConfig =
        {
            headers: {
                "Content-type": "application/x-www-form-urlencoded",
                "Cookie": `authcred="${env["AUTHCRED"]}"`
            },
        }
        let players = (args[0] && args[0].players) || []

        if (!players.length) {
            players = await SearchClient.Search(PlayerSearchReport, {
                "query": {
                    "exists": {
                        "field": "Role"
                    }
                }
            })
        }


        if (roundDate && lastMessageDate && (roundDate.getDate() === lastMessageDate.getDate())) {
            if (messages.length) {
                messages.forEach(async msg => {
                    if (msg.message.startsWith('/') || msg.message.startsWith('!') || msg.message.startsWith('\\') || msg.message.startsWith('>') || (msg.message.startsWith(':') && !msg.message.includes(':/'))){
                        const commandName = msg.message.split(' ')[0].slice(1)
                        if (commandNames.includes(commandName)) {
                            let player = players.find(pl => pl.Id === msg.id)
                            if (!player) {
                                player = await SearchClient.Get(msg.id as any, PlayerSearchReport)
                            }
                            const command = Commands.find(comm => comm.name === commandName || comm.aliases.includes(commandName))
                            if (typeof (player.Role) === 'number' && command.permissions.find(perm => perm.Value === player.Role)) {
                                const input = msg.message.match(/\#[A-Z0-9]{0,4}\:/) ? msg.message.slice(0, msg.message.match(/\#[A-Z0-9]{0,4}\:/).index) : msg.message
                                const { name, id, reason, duration } = this.parseCommand(input.split(' ').slice(1))

                                command.run(this.commandBus, msg.id, msg.username, name, id, reason, duration)
                            } else if (typeof (player.Role) === 'number') {
                                const frown = Math.floor(Math.random() * 32) > 28 ? '. :/ ' : ''

                                const message = `you do not have the required permissions to use this command ${msg.username}[${msg.id.slice(9)}]${frown}`
                                const chatUrlencoded = `ajax=1&message=${message}&teamsay=-1`
                                await axios.post(chatUrl, chatUrlencoded, config)
                            }

                        } else {
                            const commandName = msg.message.split(' ')[0].slice(1)
                            const chars = commandName.split('').filter((char, i, self) => (self.indexOf(char) === i) || Math.abs(self.indexOf(char) - i) === 1);
                            const options = commands.reduce((opts, opt) => {
                                return { ...opts, [opt]: 0 }
                            }, {})


                            for (let i = 0; i < chars.length; i++) {
                                let char = chars[i]
                                commands.forEach(cmd => {
                                    if (cmd.includes(char)) {
                                        options[cmd] = options[cmd] + 1
                                    }
                                })
                            }

                            const sorted = Object.entries(options).sort((optA, optB) => (optB[1] as number) - (optA[1] as number)).map(opt => opt[0]) 
                            sorted.some(async opt => {
                                const val = options[opt]
                                const perc = (100 / opt.length) * val

                                if (perc > 30 && perc < 60) {
                                    const message = `did you mean !${opt}`
                                    const chatUrlencoded = `ajax=1&message=${message}&teamsay=-1`
                                    await axios.post(chatUrl, chatUrlencoded, config)
                                    return true;
                                }

                                if (perc >= 60) {
                                    const player = await SearchClient.Get(msg.id as any, PlayerSearchReport)
                                    const command = Commands.find(comm => comm.name === opt || comm.aliases.includes(opt))
                                  
                                    if (typeof (player.Role) === 'number' && command.permissions.find(perm => perm.Value === player.Role)) {
                                        const input = msg.message.match(/\#[A-Z0-9]{0,4}\:/) ? msg.message.slice(0, msg.message.match(/\#[A-Z0-9]{0,4}\:/).index) : msg.message
                                        const { name, id, reason, duration } = this.parseCommand(input.split(' ').slice(1))
                                        command.run(this.commandBus, msg.username, name, id, reason, duration)
                                    } else if (typeof (player.Role) === 'number') {
                                        const frown = Math.floor(Math.random() * 32) >= 16 ? '. :/ ' : ''

                                        const message = `you do not have permission to use this command ${msg.username}[${msg.id.slice(9)}]${frown}`
                                        const chatUrlencoded = `ajax=1&message=${message}&teamsay=-1`
                                        await axios.post(chatUrl, chatUrlencoded, config)
                                    }
                                    return true;
                                }

                                return false;
                            })
                        }
                    } else if (msg.message.includes(':/') && msg.username !== 'admin' && Math.floor(Math.random() * 32) >= 28) {
                        const message = `:/`
                        const chatUrlencoded = `ajax=1&message=${message}&teamsay=-1`
                        await axios.post(chatUrl, chatUrlencoded, config)
                    }
                    
                })

                await this.commandBus.execute(new ReceiveChatLinesCommand(Guid.parse(roundId), new Date(), messages));
            }
        }
        setTimeout(async () => {
            await this.Watch(timeout, {...args[0], messages, players })
            return;
        }, timeout)

        return;
    }

    public parseCommand(command: Array<string>) {
        let formats = ['h', 'd', 'w', 'm']
        let duration
        let reason
        let name
        let id

        command.forEach((comm, i) => {
            if (comm.match(/^\d+[A-Za-z]$/) && formats.some(f => comm.endsWith(f))) {
                duration = comm
                if (!reason && (name || id)) {
                    reason = command.slice(i + 1).join(' ')
                }
            } else if (!reason && (name || id)) {
                reason = command.slice(i).join(' ')
            }

            if (comm && comm.match(/0x011[0]{4}[A-Z0-9]{9,10}/)) {
                id = comm
            } else if (comm && comm.match(/[A-Z0-9]{9,10}/)) {
                id = `0x0110000${comm}`
            } else if (!name && !id) {
                name = comm
            }



        })

        return {
            name,
            id,
            duration,
            reason,

        }

    }

}