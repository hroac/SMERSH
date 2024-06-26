import { CommandInteraction, ApplicationCommandType, ApplicationCommandOptionType, AutocompleteInteraction, GuildMember } from "discord.js";
import { Client, Utils } from '../Framework'
import { Command } from "../Framework/Command"
import { SearchClient } from '../../Elastic'
import { PlayerSearchReport } from '../../Reports/Entities/player'
import { ApplyPolicyCommand } from '../../Commands/Player'
import { Guid } from "guid-typescript";
import { Action, DiscordRole } from "../../SMERSH/ValueObjects/player";
import { Api } from '../..//Web/Framework';
import { AxiosRequestConfig } from 'axios';
import { PlayersRoute } from '../../Services/WebAdmin/Routes';
import { PlayerQuery } from '../../Services/WebAdmin/Queries'

export const KickCommand: Command = {
    name: "kick",
    description: "kick a player from the server",
    permissions: [DiscordRole.SmershAgent, DiscordRole.Admin],
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'input',
            description: 'name or ID of player',
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true,
        },
        {
            name: 'reason',
            description: 'explain yourself',
            type: ApplicationCommandOptionType.String,
            required: true,
        }
    ],
    autocomplete: async (client: Client, interaction: AutocompleteInteraction): Promise<void> => {
        const focusedValue = interaction.options.getFocused(true);
        const players = global.state.Players;
        if (players) {
            const choices = players.filter(player => !player.Bot && player.Id).map(player => { return { name: player.Playername.toString(), value: player.PlayerKey } })
            const filtered = choices.filter(choice => choice.name && choice.name.toString().toLowerCase().startsWith(focusedValue.value.toLowerCase()) || choice.name.toLowerCase().includes(focusedValue.value.toLowerCase()))
            interaction.respond(filtered.slice(0, 24));
        }
    },
    run: async (client: Client, interaction: CommandInteraction) => {
        const input = interaction.options.get('input');
        const reason = interaction.options.get('reason');
        let id = input.value.toString().slice(input.value.toString().indexOf('_') + 1, input.value.toString().lastIndexOf('_'))
        let match
        let regexp

        if (input && typeof (input.value) === 'string') {
            if (id.match(/0x011[0]{4}[A-Z0-9]{9,10}/)) {
                match = {
                    "Id": id
                }
            } else if (input.value.match(/[A-Z0-9]{9,10}/)) {
                id = `0x0110000${id}`
                match = {
                    "Id": id,
                }
            } else {
                regexp = {
                    "Name": {
                        "value": `.*${input.value}.*`,
                        "flags": "ALL",
                        "case_insensitive": true
                    }
                }
            }
        }



        const players = await SearchClient.Search<PlayerSearchReport>(PlayerSearchReport, {
            "query": {
                match,
                regexp
            }
        })
        const player = players.shift();
        let name = input.name
        let playerKey = input.value.toString();


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

        if (player) {

            name = player.Name;
            if (!playerKey.match(/[0-9]{4}\_0x011[0]{4}[A-Z0-9]{9,10}\_\d\.[0-9]{4}/)) {
                const playa = await PlayerQuery.GetById(player.Id);
                playerKey = playa.PlayerKey;
                if (name !== playa.Playername) {
                    name = playa.Playername;
                }
            }
        }
        await client.commandBus.execute(new ApplyPolicyCommand(Guid.create(), id, interaction.channelId, Action.Kick, name, reason.value.toString(), (interaction.member as GuildMember).displayName, new Date()))

        const env = process.env;
        const axios = Api.axios();
        const url = env["BASE_URL"] + PlayersRoute.CondemnPlayer.Action
        const config: AxiosRequestConfig =
        {
            headers: {
                "Content-Type": 'application/x-www-form-urlencoded',
            },
        }

        const urlencoded = `ajax=1&action=kick&playerkey=${playerKey}`

        axios.post(url, urlencoded, config).then(result => {
            client.log.info(JSON.stringify(result.data))
        });
        await interaction.followUp({
            ephemeral: true,
            content: `${name} was kicked for ${reason.value}`
        });
        
    }
};