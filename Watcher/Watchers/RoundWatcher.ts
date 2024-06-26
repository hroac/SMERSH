import { Watcher } from '../Watcher'
import { WebAdminSession } from '../../Services/WebAdmin';
import { ChatRoute } from '../../Services/WebAdmin/Routes';
import { PlayerInfo, Status } from '../../Services/WebAdmin/Models';
import { StartRoundCommand, EndRoundCommand, ChangeMapCommand  } from '../../Commands/Round'
import { UpdatePlayerRoundCommand  } from '../../Commands/Round/PlayerRound'
import { RegisterPlayerCommand, ChangePlayerNameCommand, ChangePlayerIpAddressCommand  } from '../../Commands/Player'
import { RegisterMapCommand  } from '../../Commands/Map'
import { StatusQuery } from '../../Services/WebAdmin/Queries'
import { Guid } from 'guid-typescript'
import { SearchClient } from '../../Elastic'
import { RoundSearchReport } from '../../Reports/Entities/round'
import { MapSearchReport } from '../../Reports/Entities/map';
import { PlayerSearchReport } from '../../Reports/Entities/player';
import { stringify } from 'querystring';
import { hexToDec } from 'hex2dec'
import { Role, Team } from '../../SMERSH/ValueObjects';
import { stat } from 'fs';
import { Logger } from '../../Discord/Framework';
import { ActivityType } from 'discord.js';

export class RoundWatcher extends Watcher {

    public override async Watch(timeout = 500, ...args: Array<{status: Status, mapTime: number, lastLogTime:Date, lastStatusTime:Date}>) {
        const status = global.state

        const prevStatus = args[0] && args[0].status;
        let lastLogTime = (args[0] && args[0].lastLogTime) || this.nearestFiveMin();
        let lastStatusTime = (args[0] && args[0].lastStatusTime) || this.nearestFiveSec();
        let prevMapTime = args[0] && args[0].mapTime
        let mapTime = (prevStatus && prevStatus.Rules && prevStatus.Rules.TimeLeft) || 0


        if (status && status.Players && status.Players.length) { 
            let oldMap = prevStatus && prevStatus.Game && prevStatus.Game.Map;
            let newMap = status && status.Game && status.Game.Map
            let timeLimit = status && status.Rules && status.Rules.TimeLimit || 0;
            global.round = status;


            let map = newMap && (await SearchClient.Search(MapSearchReport, {
                "query": {
                    "match": {
                        "MapName": newMap,
                    }
                }
            })).shift()
        

            if (oldMap && newMap && oldMap !== newMap) {
                const mapId = map && map.Id ? Guid.parse(map.Id) : Guid.create();
                const roundId = Guid.create();
                const axis = status.Teams.find(team => team.Name === Team.Axis.DisplayName).Attacking ? 'attacking' : 'defending'
                const allies = status.Teams.find(team => team.Name === Team.Allies.DisplayName).Attacking ? 'attacking' : 'defending'
                const oldAxis = prevStatus.Teams.find(team => team.Name === Team.Axis.DisplayName).Attacking ? 'attacking' : 'defending'
                const oldAllies = prevStatus.Teams.find(team => team.Name === Team.Allies.DisplayName).Attacking ? 'attacking' : 'defending'
              
                this.commandBus.execute(new ChangeMapCommand(roundId, mapId, newMap))
                Logger.append(`${this.findDuplicateWords(oldMap)} ended with Axis ${oldAxis} and Allies ${oldAllies}`)
                Logger.append(`${this.findDuplicateWords(newMap)} started with Axis ${axis} and Allies ${allies}`)

            }

            if (!map) {

                map = new MapSearchReport(Guid.create(), newMap);

                this.commandBus.execute(new RegisterMapCommand(Guid.parse(map.Id), newMap, timeLimit))
            }

            if (map) {
                let roundQuery = {
                    "size": 1,
                    "sort": [
                        {
                            "Date": {
                                "order": "desc"
                            }
                        }
                    ],
                    "query": {
                        "bool": {
                            "must": [
                                {
                                    "match": {
                                        "MapId": map.Id,
                                    }
                                },
                                {
                                    "match": {
                                        "IsActive": true
                                    }
                                }
                            ]
                        }
                    }
                };

                const round = (await SearchClient.Search(RoundSearchReport, roundQuery)).shift()
                const players: Record<string, PlayerInfo> = status.Players && status.Players.length ? status.Players.filter(p => !p.Bot && p.Id).reduce((list, player) => { return { ...list, [player.Id]: player } }, {}) : {};
                const playerIds: string[] = Object.keys(players)
                const timeLimit = status.Rules && status.Rules.TimeLimit ? status.Rules.TimeLimit : 0
                const newMapTime = status.Rules && status.Rules.TimeLeft ? status.Rules.TimeLeft : 0
                const BotsBeGone = status.Players.every(player => !player.Bot)


                if (round && mapTime && timeLimit && timeLimit && Math.abs(mapTime - timeLimit) <= 1) {
                    console.log(mapTime, timeLimit)
                    this.commandBus.execute(new StartRoundCommand(Guid.parse(round.Id), timeLimit, new Date(), playerIds))
                }


                //time stopped              //first time it stopped     //timelimit so its not preround
                const score = status.Teams && status.Teams.length && status.Teams[0].Score + status.Teams[1].Score
                if (prevStatus && round && newMapTime === mapTime && mapTime !== prevMapTime && timeLimit && score) {
                    console.log('new map time:', newMapTime, 'current map time:', mapTime, 'prev map time:', prevMapTime, 'time limit', timeLimit)
                    this.commandBus.execute(new EndRoundCommand(Guid.parse(round.Id), new Date(), playerIds));
                    const battleDesc = this.battleDesc(prevStatus, status)
                    Logger.append(battleDesc)

                }

                if (round) {
                    global.roundInfo = { roundId: round.Id, date: round.Date }
                }


                if (playerIds.length) {
                    global.currentPlayers = players;
                    const globalPlayers = {};
                    for (let playerId of playerIds) {
                        const exists = await SearchClient.Get(playerId as any as Guid, PlayerSearchReport)
                        const player = players[playerId];
                        
                        

                        if (!exists) {
                            if (player && player.Id) {
                                const decId = hexToDec(player.Id)
                                let playa
                                try {
                                    playa = decId && await this.steam.getUserSummary(decId)
                                } catch (error) {
                                    console.log(error)
                                }
                                  
                                if (playa && player.Playername !== playa.nickname) {
                                    this.log.info(player.Id, player.Playername, playa.nickname, playa.steamID)
                                    this.commandBus.execute(new RegisterPlayerCommand(player.Id, `(${player.Playername})${playa.nickname}`, player.IpAddress))

                                } else {
                                    this.commandBus.execute(new RegisterPlayerCommand(player.Id, player.Playername, player.IpAddress))

                                }


                            }
                        } else if (player && !exists.Name ||  !exists.Name.includes(player.Playername)) {
                            this.commandBus.execute(new ChangePlayerNameCommand(player.Id, player.Playername))

                        } else if (player && !exists.Ip || exists.Ip !== player.IpAddress) {
                            this.commandBus.execute(new ChangePlayerIpAddressCommand(player.Id, player.IpAddress))
                        }

                        if (exists) {
                            globalPlayers[exists.Id] = exists;
                        }

                        if (exists && status && status.Teams && status.Teams.length && round && BotsBeGone && player && player.Id && newMapTime && newMapTime === mapTime && mapTime !== prevMapTime) {
                            const team = Team.fromValue<Team>(player.Team);
                            const role = Role.fromDisplayName<Role>(player.Role);
                            const id = Guid.parse((round.Id.toString().slice(0, 27) + playerId.slice(9)))

                            if (team && role && (player.Kills || player.Score > 5) ) {
                                const attacking = status.Teams[player.Team].Attacking

                                this.commandBus.execute(new UpdatePlayerRoundCommand(id, player.Id, Guid.parse(round.Id), team.Value, role.Value, attacking, player.Score, player.Kills, player.Deaths))
                            }
                        }
                    }
                    global.players = globalPlayers;
                }

                const nextLogTime = lastLogTime.getMinutes() === 55 ? 0 : lastLogTime.getMinutes() + 5
                const currentTime = new Date().getMinutes();
                if (currentTime >= nextLogTime  && currentTime !== lastLogTime.getMinutes() && !(new Date().getMinutes() % 5)) {
                    const env = process.env;
                    let crossedSwords = `\u2694`
                    let shield = `\u26CA`
                    let axisIcon = `\u2720`
                    let alliesIcon = '\u262D'

                    if (env["GAME"] === "RS1") {
                        axisIcon = `\u6698`
                        alliesIcon = `\u272A`
                    }

                    const axisPlayers = status.Players.filter(p => !p.Team).length
                    const alliesPlayers = status.Players.filter(p => !p.Team).length
                    const attacking = status.Teams.map(team => team.Attacking ? crossedSwords : shield).join('')
                    lastLogTime = lastLogTime.getMinutes() === 55 ? new Date(this.nearestFiveMin().getTime() + 300000) : this.nearestFiveMin();
                    Logger.append(`there are currently ${status.Players.filter(p => !p.Bot).length} players ${axisIcon}${axisPlayers}${attacking}${alliesPlayers}${alliesIcon}`)

                }
                const nextStatusTime = lastStatusTime.getSeconds() === 55 ? 0 : lastStatusTime.getSeconds() + 5
                if (new Date().getSeconds() >= nextStatusTime) {
                    this.handleDiscordStatus(status);
                    lastStatusTime = this.nearestFiveSec();
                }
            } 
        }

       

        setTimeout(() => {
            this.Watch(timeout, { status: status ?? prevStatus, mapTime, lastLogTime, lastStatusTime })
        }, timeout)
    }

    public handleDiscordStatus(status: Status) {
        const env = process.env;
        let crossedSwords = `\u2694`
        let shield = `\u26CA`
        let axisIcon = `\u2720`
        let alliesIcon = '\u262D'
        const balanced = 'idle'
        const staxis = 'online'
        const stallies = 'dnd'
        let stat = balanced;


        if (env["GAME"] === "RS1") {
            axisIcon = `\u6698`
            alliesIcon = `\u272A`
        }
        const attacking = status.Teams.map(team => team.Attacking ? crossedSwords : shield).join('')
        let statusMap,
            timeLeft,
            territories

        statusMap = this.findDuplicateWords(status.Game.Map)
        timeLeft = this.secToMin(status.Rules.TimeLeft)

        territories = `${axisIcon}${status.Teams[0].Territories}/${status.Teams[1].Territories}${alliesIcon}`

        let stats = status.Players.reduce((stats, player) => {
            const team = player.Team ? 'allies' : 'axis'
            stats.scores[team] += player.Score
            stats.count[team].total += 1

            if (player.Bot) {
                stats.count[team].bots += 1
                stats.count.bots += 1
            } else {
                stats.count[team].players += 1
                stats.count.players += 1
            }

            stats.count.total++
            return stats
        }, {
            scores: { axis: 0, allies: 0 },
            count: {
                bots: 0,
                players: 0,
                total: 0,
                axis: { bots: 0, players: 0, total: 0 },
                allies: { bots: 0, players: 0, total: 0 }
            }
        })
        const scores = `${axisIcon}${stats.scores.axis}/${stats.scores.allies}${alliesIcon}`
        const teamCount = `${axisIcon}${stats.count.axis.players}${attacking}${stats.count.allies.players}${alliesIcon}`
        let discordStatus = ''



        if (stats.count.total === 1) {
            discordStatus += `${stats.count.total} player`
        } else if (stats.count.players && stats.count.players > stats.count.bots) {
            discordStatus += `${stats.count.players} players`
        } else if (!stats.count.players && stats.count.bots > 1) {
            discordStatus = `${stats.count.bots} bots`
        } else {
            discordStatus += `${stats.count.players} players`
        }

        if (statusMap.length) {
            discordStatus += ` on ${statusMap}`
        }

        if (timeLeft.length) {
            discordStatus += ` ${timeLeft}`
        }

        if (teamCount.length && stats.count.players > stats.count.bots) {
            discordStatus += ` ${teamCount}`
        }

        if (territories.length) {
            discordStatus += `${territories}`
        }

        if (scores.length) {
            discordStatus += ` ${scores}`
        }

        if (stats.scores.allies > (stats.scores.axis * 1.3)) {
            stat = stallies;
        }

        if (stats.scores.axis > (stats.scores.allies * 1.3)) {
            stat = staxis;
        }

        this.client.user.setPresence({
            activities: [{
                name: discordStatus,
                type: ActivityType.Watching
            }],
            status: 'online'
        })
    }

    public battleDesc(oldStatus: Status, status: Status): string {
        const env = process.env;
        let axisIcon = `\u2720`
        let alliesIcon = '\u262D'

        if (env["GAME"] === "RS1") {
            axisIcon = `\u6698`
            alliesIcon = `\u272A`
        }
        let teams = oldStatus.Teams.map(team => {
            let nextRound = status.Teams.find(tm => tm.Name === team.Name)
            let description = []
            if (team.RoundsWon) {
                description[0] = `${team.Name} `
                description[1] = 'has crushed '

                if (nextRound.Territories >= team.Territories) {
                    description[4] = ' and has taken the territory'
                }

                if (!team.Attacking) {
                    description[4] = ' and keeps the territory'

                    if (oldStatus.Rules.TimeLeft === -1) {
                        description[1] = 'has withstood '
                    }
                }

            } else if(oldStatus.Teams.some(tm => tm.RoundsWon)) {
                if (env["GAME"] === "RO2") {
                    if (team.Name === 'Allies') {
                        description[2] = 'the soviet '
                    }

                    if (team.Name === 'Axis') {
                        description[2] = 'the german '
                    }
                } else {
                    if (team.Name === 'Allies') {
                        description[2] = 'the american '
                    }

                    if (team.Name === 'Axis') {
                        description[2] = 'the japanese '
                    }
                }
             

                if (team.Attacking) {
                    description[2] += 'attack'
                } else {
                    description[2] += 'defense'
                }
            }


            return description
        })
        let map = this.findDuplicateWords(oldStatus.Game.Map)
        let timeLeft = this.secToMin(oldStatus.Rules.TimeLeft)
        teams[1][3] = ` at ${map}`
        teams[1][6] = ` with ${timeLeft} left`
        teams = teams.reduce((keys, arr) => [...Object.keys(arr), ...keys].flat().sort((a, b) => a - b), []).map((key, index) => teams.find(item => item[key])[key])
        const description = teams.join('')

        const players = oldStatus.Players.filter(player => !player.Bot)
        const axisScore = players.reduce((total, player) => { return player && player.Team === Team.Axis.Value ? total + player.Score : total }, 0)
        const alliesScore = players.reduce((total, player) => { return player && player.Team === Team.Allies.Value ? total + player.Score : total }, 0)
        const axisPlayers = oldStatus.Teams.find(team => team.Name === Team.Axis.DisplayName)
        const alliesPlayers = oldStatus.Teams.find(team => team.Name === Team.Allies.DisplayName)
        const scores = `${axisIcon}${axisPlayers.Territories}${axisIcon} ${axisScore}/${alliesScore} ${alliesIcon}${alliesPlayers.Territories}${alliesIcon}`
        return `${description} ${scores}`
    }

   

    public secToMin(sec: number) {
        if (sec === undefined || sec === null) {
            return '00:00';
        }

        let minutesLeft,
            secondsLeft,
            timeLeft

        secondsLeft = sec % 60 <= 9 ? '0'.concat((sec % 60).toString()) : sec % 60
        minutesLeft = `${secondsLeft.toString().includes('-') ? '-' : ''}${(sec - sec % 60) / 60 <= 9 ? '0'.concat(((sec - sec % 60) / 60).toString()) : (sec - sec % 60) / 60}`
        secondsLeft = secondsLeft.toString().replace('-', '')
        timeLeft = `${minutesLeft}:${secondsLeft}`

        if (!minutesLeft) {
            return `00:${secondsLeft}`
        }

        if (!secondsLeft) {
            return `${minutesLeft}:00`
        }
        return timeLeft
    }



    public findDuplicateWords(input: string) {
        const str = input.replaceAll('\'', '').replaceAll('_', ' ').replace(/(^\w{1})|(\s{1}\w{1})|(?:- |\d\. ).*/g, match => match.toUpperCase()).match(/[A-Z][a-z]+/g).join(' ')
        const months = [...Array(11).keys()].map(key => new Date(0, key).toLocaleString('en', { month: 'long' }))
        const strArr = str.split(" ");
        let res = [];
        for (let i = 0; i < strArr.length; i++) {
            if (strArr.indexOf(strArr[i]) !== strArr.lastIndexOf(strArr[i]) || strArr.lastIndexOf(strArr[i])) {
                if (!res.includes(strArr[i])) {
                    res.push(strArr[i]);
                } else if (strArr.includes('The') || strArr.includes('Red')) {
                    res = res.filter(str => str !== strArr[i]);
                    res.push(strArr[i]);
                };
            };
        };
        res = res.filter(w => !months.includes(w))
        return res.join(" ");
    };

    public nearestFiveMin(date = new Date()) : Date {
        const coeff = 1000 * 60 * 5
        let newDate = new Date(Math.round(date.getTime() / coeff) * coeff)
        return newDate
    }

    public nearestFiveSec(date = new Date()) : Date {
        let newDate = new Date(date)
        newDate.setSeconds(Math.ceil(newDate.getSeconds() / 5) * 5)
        return newDate
    }
}