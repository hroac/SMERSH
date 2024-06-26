import { Command } from "./Command"
import { SearchClient } from '../../Elastic'
import { PlayerSearchReport } from '../../Reports/Entities/player'
import { ApplyPolicyCommand } from '../../Commands/Player'
import { Guid } from "guid-typescript";
import { Action, DiscordRole } from "../../SMERSH/ValueObjects/player";
import { Api } from '../../Web/Framework';
import { AxiosRequestConfig } from 'axios';
import { ChatRoute, PlayersRoute } from '../../Services/WebAdmin/Routes';
import { PlayerQuery } from '../../Services/WebAdmin/Queries'
import { CommandBus } from "@nestjs/cqrs";
import { PlayerInfo } from "../../Services/WebAdmin/Models";

export const GambleCommand: Command = {
    name: "gamble",
    aliases: [],
    permissions: [DiscordRole.Admin, DiscordRole.SmershAgent, DiscordRole.Veteran],
    run: async (commandBus: CommandBus, caller: PlayerSearchReport, player: PlayerInfo, name: string, id: string, reason: string, duration: string) => {
        const axios = Api.axios();
        const env = process.env;
        const config: AxiosRequestConfig =
        {
            headers: {
                "Content-Type": 'application/x-www-form-urlencoded',
            },
        }


        if (player || typeof parseInt(name, 10) !== 'number') {
            const message = `please use a valid amount or just use !gamble`
            const chatUrl = env["BASE_URL"] + ChatRoute.PostChat.Action
            const chatUrlencoded = `ajax=1&message=${message}&teamsay=-1`
            await axios.post(chatUrl, chatUrlencoded, config)
            return;
        }

        if (caller && caller.Riksdaler) {
            const parsed = parseInt(name);
            const riksdaler = name && typeof parsed === 'number' && Math.abs(parsed) < caller.Riksdaler ? Math.abs(parsed) : caller.Riksdaler
            const odds = Math.round((((100 / caller.Riksdaler * riksdaler * 0.9)) / 100) * 10) / 10 ;
            const gamble = Math.random() > odds ? Math.round(riksdaler * (2 + odds)) : riksdaler;
            let message = ``;

            caller.Riksdaler -= riksdaler;

            if (gamble > riksdaler) {
                caller.Riksdaler += gamble;
                message = `Congratulations ${caller.Name} you have won ${gamble} Riksdaler, you now have ${caller.Riksdaler} Riksdaler!`;
            } else {
                if (!caller.Riksdaler) {
                    message = `${caller.Name} just lost all their Riksdaler :/`;
                } else {
                    message = `${caller.Name} just lost ${gamble} Riksdaler, you now have ${caller.Riksdaler} Riksdaler!`;
                }
            }

            const chatUrl = env["BASE_URL"] + ChatRoute.PostChat.Action
            const chatUrlencoded = `ajax=1&message=${message}&teamsay=-1`

            if (Object.values(global.players).length) {
                global.players[caller.Id].Riksdaler = caller.Riksdaler;
            }

            await SearchClient.Update(caller);
            await axios.post(chatUrl, chatUrlencoded, config)


        } else {
            console.log(caller.Name, caller.Riksdaler)
            const message = `${caller.Name} has no Riksdaler :/`
            const chatUrl = env["BASE_URL"] + ChatRoute.PostChat.Action
            const chatUrlencoded = `ajax=1&message=${message}&teamsay=-1`
            await axios.post(chatUrl, chatUrlencoded, config)
        }

    }
};