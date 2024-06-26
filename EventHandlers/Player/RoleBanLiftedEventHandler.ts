export { }
import { IEventHandler } from '@nestjs/cqrs';
import { EventsHandler } from '@nestjs/cqrs/dist/decorators/events-handler.decorator';
import { PolicyQuery } from '../../Services/WebAdmin/Queries/PolicyQuery'
import { RoleBanLiftedEvent } from '../../Events'
import { SearchClient } from '../../Elastic/app'
import { PolicySearchReport } from '../../Reports/Entities/policy'
import { CommandBus } from '@nestjs/cqrs';
import { Guid } from 'guid-typescript';
import { Client, Logger } from '../../Discord/Framework';
import { TextChannel } from 'discord.js';
import { Role } from '../../SMERSH/ValueObjects';
import { SteamBot } from '../../SMERSH/Utilities/steam';

@EventsHandler(RoleBanLiftedEvent)
export class RoleBanLiftedEventHandler implements IEventHandler<RoleBanLiftedEvent>
{
    public client: Client;
    public constructor(protected readonly commandBus: CommandBus) {
        const token = process.env["DISCORD_TOKEN"]
        this.client = new Client(token, {
            intents: []
        }, commandBus)
        this.steam = SteamBot.get();
    }

    public steam: SteamBot;

    async handle(event: RoleBanLiftedEvent) {
        let policy: PolicySearchReport = await SearchClient.Get(event.Id, PolicySearchReport)
        let role = Role.fromValue<Role>(event.Role)

        policy.IsActive = false;

        await SearchClient.Update(policy);
        this.client.on('ready', async (client) => {
            const channel = await client.channels.fetch(policy.ChannelId) as TextChannel;
            if (channel) {
                await channel.send(`${role.DisplayName} roleban lifted from ${policy.Name}, originally banned for ${policy.Reason} on ${new Date(policy.BanDate).toString().split(' GMT')[0]}`)
            } 
        });

        Logger.append(`${role.DisplayName} roleban lifted from ${policy.Name}, originally banned for ${policy.Reason} on ${new Date(policy.BanDate).toString().split(' GMT')[0]}`)

        const message = `your roleban for ${role.DisplayName} has been lifted`

        await this.steam.sendMessageToFriend(event.PlayerId, `/pre this is an automated message integrated with ChatGPT`)
        await this.steam.sendMessageToFriend(event.PlayerId, message)

        return;
    }
}