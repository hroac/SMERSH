import { Watcher } from '../Watcher'
import { LiftBanCommand } from '../../Commands/Player'
import { Guid } from 'guid-typescript'
import { SearchClient } from '../../Elastic'
import { PolicySearchReport } from '../../Reports/Entities/policy';
import { Action, Role } from '../../SMERSH/ValueObjects/player';
import { Api } from '../../Web/Framework'
import { PlayersRoute, PolicyRoute } from '../../Services/WebAdmin/Routes';
import { AxiosRequestConfig } from 'axios';
import qs from 'qs'
import { StatusQuery } from '../../Services/WebAdmin/Queries';
import { Team } from '../../SMERSH/ValueObjects';

export class BanWatcher extends Watcher {

    public override async Watch(timeout = 60000, ...args: any[]) {
        const count = await SearchClient.Count<PolicySearchReport>(PolicySearchReport)
        const status = await StatusQuery.Get();
        const players = status && status.Players ? status.Players: [];
        const bans = await SearchClient.Search(PolicySearchReport, {
            "query": {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "IsActive": true
                            }
                        },
                        {
                            "bool": {
                                "should": [
                                    {
                                        "match": {
                                            "Action": Action.Ban.DisplayName
                                        }
                                    },
                                    {
                                        "match": {
                                            "Action": Action.RoleBan.DisplayName
                                        }
                                    }
                                ]
                            }
                        }
                    ]

                }
            },
            "size": count.count
            })

        const env = process.env;
        const axios = Api.axios();

        for (let ban of bans) {
            this.log.info(JSON.stringify(ban))


            if (ban.Action === Action.RoleBan.DisplayName) {
                const player = players.find(player => player.Id && player.Id.toString() === ban.PlayerId.toString())
                if (player) {
                    const role : Role = Role.fromDisplayName(player.Role)
                    const team : Team = Team.fromValue(parseInt(player.Team, 10))
                    const side = status.Teams[team.Value].Attacking ? 'attacking': 'defending'
                   
                    Object.keys(ban.RoleBans).forEach(rol => {
                        const playerRole = parseInt(rol, 10)
                        const roleBans = ban.RoleBans[playerRole]

                        roleBans.forEach(roleBan => {
                            if (role.Value === playerRole && roleBan.Teams && roleBan.Teams.includes(team.Value)) {
                                if ((roleBan.Sides && roleBan.Sides.includes(side)) || (!roleBan.Sides || !roleBan.Sides.length)) {
                                    const url = env["BASE_URL"] + PlayersRoute.CondemnPlayer.Action
                                    const config: AxiosRequestConfig =
                                    {
                                        headers: {
                                            "Content-type": "application/x-www-form-urlencoded",
                                            "Cookie": `authcred="${env["AUTHCRED"]}"`
                                        },
                                    }

                                    const urlencoded = `ajax=1&action=kick&playerkey=${player.PlayerKey}`

                                    axios.post(url, urlencoded, config).then(result => {
                                        this.log.info(JSON.stringify(result.data))
                                    });
                                }
                            }
                        })

                     
                    })
                    
                }
               
            }

            if (ban.UnbanDate && new Date(ban.UnbanDate) <= new Date()) {

                const urlencoded = `banid=plainid:${ban.PlainId}&action=delete`
                const url = env["BASE_URL"] + PolicyRoute.AddBan.Action

                const config: AxiosRequestConfig =
                {
                    headers: {
                        "Content-type": "application/x-www-form-urlencoded",
                        "Cookie": `authcred="${env["AUTHCRED"]}"`
                    },
                }

                await axios.post(url, urlencoded, config).then(result => {
                    this.log.info(result)
                    //return result
                    this.commandBus.execute(new LiftBanCommand(Guid.parse(ban.Id), ban.PlayerId as any))

                });

            }  
        }

        setTimeout(() => {
            this.Watch(timeout)
        }, timeout)
    }
}