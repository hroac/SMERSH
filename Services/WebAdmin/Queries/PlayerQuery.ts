import { PolicyRoute } from '../Routes';
import { WebAdminSession } from '..';
import { Parsers } from "../../../Web/Utils";
import { StatusRoute, PlayersRoute } from '../Routes';
import { Query } from './Query';
import { PlayerSearchReport } from '../../../Reports/Entities/player';
import { Player, PlayerInfo } from '../Models';

export class PlayerQuery extends Query {

    public static async Get() {
        const session = WebAdminSession.get();

        const status = await session.navigate(StatusRoute.GetStatus.Action)
        const admin = await session.navigate(PlayersRoute.GetPlayers.Action)

      
        let players : Array<PlayerInfo>

        if (status && status.window && status.window.document) {
            const playerTable = status.window.document.querySelector("#players");
         
            if (playerTable) {
                players = Parsers.playerTable(playerTable as HTMLTableElement);
                if (admin && admin.window && admin.window.document) {
                    const table = admin.window.document.querySelector("#players");
                    let playas;

                    if (table) {
                        playas = Parsers.playerTable(table as HTMLTableElement)
                        try {
                            players = players.map((player, i) => {
                                 const playa = playas.find(playa => playa.Playername === player.Playername)
                                 if(playa) {
                                 return Object.assign({}, player, { Id: playa.UniqueID, IpAddress: playa.IP, PlayerKey: playa.PlayerKey })
                                 }
                                 return player
                             });
  
                         } catch (error) { }
                    }

                }
            }

           
            return players;
        }
        return null;
    }

    public static async GetByName(name: string) {
        const session = WebAdminSession.get();

        const status = await session.navigate(StatusRoute.GetStatus.Action)
        const admin = await session.navigate(PlayersRoute.GetPlayers.Action)


        let players : Array<Player>

        if (status && status.window && status.window.document) {
            const playerTable = status.window.document.querySelector("#players");

            if (playerTable) {
                players = Parsers.playerTable(playerTable as HTMLTableElement);
                if (admin && admin.window && admin.window.document) {
                    const table = admin.window.document.querySelector("#players");
                    let playas;

                    if (table) {
                        playas = Parsers.playerTable(table as HTMLTableElement)
                       try {
                           // players = players.map((player, i) => Object.assign({}, player, { Id: playas[i].UniqueID, IpAddress: playas[i].IP, PlayerKey: playas[i].PlayerKey }));
                            players = players.map((player, i) => {
                                const playa = playas.find(playa => playa.Playername === player.Playername)
                                if(playa) {
                                return Object.assign({}, player, { Id: playa.UniqueID, IpAddress: playa.IP, PlayerKey: playa.PlayerKey })
                                }
                                return player
                            });
                            players = players.filter(player => player.Playername.toLowerCase().includes(name.toLowerCase()))
 
                        } catch (error) { }
                    }

                }
            }


            return players.shift();
        }
        return null;
    }

    public static async GetPlayer(name: string) {
        const session = WebAdminSession.get();

        const admin = await session.navigate(PlayersRoute.GetPlayers.Action)


        let players: Array<Player>;
        if (admin && admin.window && admin.window.document) {
            const table = admin.window.document.querySelector("#players");

            if (table) {
                players = Parsers.playerTable(table as HTMLTableElement)
            }

            return players.shift()
        }
        return null;
    }

    public static async GetPlayers() {
        const session = WebAdminSession.get();

        const admin = await session.navigate(PlayersRoute.GetPlayers.Action)


        let players: Array<Player>;
        if (admin && admin.window && admin.window.document) {
            const table = admin.window.document.querySelector("#players");

            if (table) {
                players = Parsers.playerTable(table as HTMLTableElement)
            }
        }
        return players
    }
}