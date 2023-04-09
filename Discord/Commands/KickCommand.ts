import { CommandInteraction, ApplicationCommandType, ApplicationCommandOptionType } from "discord.js";
import { Client, Utils } from '../Framework'
import { Command } from "../Framework/Command"
import { SearchClient } from '../../Elastic'
import { PlayerSearchReport } from '../../Reports/Entities/player'
import { ApplyPolicyCommand } from '../../Commands/Player'
import { Guid } from "guid-typescript";
import { Action } from "../../SMERSH/ValueObjects/player";
import { Api } from '../..//Web/Framework';
import { AxiosRequestConfig } from 'axios';
import { PlayersRoute } from '../../Services/WebAdmin/Routes';
import { PlayerQuery } from '../../Services/WebAdmin/Queries'

export const KickCommand: Command = {
    name: "kick",
    description: "search the SMERSH database for players",
    type: ApplicationCommandType.ChatInput,
    options: [
        {
        name: 'input',
        description: 'name or ID of player',
        type: ApplicationCommandOptionType.String
        },
        {
            name: 'reason',
            description: 'explain yourself',
            type: ApplicationCommandOptionType.String
        }
    ],
    run: async (client: Client, interaction: CommandInteraction) => {
        const input = interaction.options.get('input');
        const reason = interaction.options.get('reason');
        let match

        if (input && typeof (input.value) === 'string') {
            if (input.value.match(/0x011[0]{4}[A-Z0-9]{9,10}/)) {
                match = {
                    "Id": input.value
                }
            } else if (input.value.match(/[A-Z0-9]{9,10}/)) {
                match = {
                    "Id": `0x0110000${input.value}`
                }
            } else {
                match = {
                    "Name": `.*${input.value}.*`
                }
            }
        }



        const players = await SearchClient.Search<PlayerSearchReport>(PlayerSearchReport, {
            "query": {
                match
            }
        })
        const player = players.shift();
        const playa = await PlayerQuery.GetByName(player.Name)

        if (players.length > 1) {
            let playerTable: string = await Utils.generatePlayerTable(players, false)
            await interaction.followUp({
                ephemeral: true,
                content: `\`\`\`prolog
                ${playerTable}
                \`\`\``,
            });
            return;
        }

        await client.commandBus.execute(new ApplyPolicyCommand(Guid.create(), player.Id, interaction.channelId, Action.Kick, player.Name, reason.value.toString(), new Date()))

        const env = process.env;
        const axios = Api.axios();
        const url = env["BASE_URL"] + PlayersRoute.CondemnPlayer.Action
        const config: AxiosRequestConfig =
        {
            headers: {
                "Content-type": "application/x-www-form-urlencoded",
                "Cookie": `authcred="${env["AUTHCRED"]}"`
            },
        }

        const urlencoded = `ajax=1&action=kick&playerkey=${playa.PlayerKey}`

        axios.post(url, urlencoded, config).then(result => {
            client.log.info(JSON.stringify(result.data))
        });
        await interaction.followUp({
            ephemeral: true,
            content: `${player.Name} was kicked for ${reason.value}`
        });
    }
};