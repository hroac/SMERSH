export { }
import { IEventHandler } from '@nestjs/cqrs';
import { EventsHandler } from '@nestjs/cqrs/dist/decorators/events-handler.decorator';
import { PolicyQuery } from '../../Services/WebAdmin/Queries/PolicyQuery'
import { RoleBanLiftedEvent } from '../../Events'
import { SearchClient } from '../../Elastic/app'
import { PolicySearchReport } from '../../Reports/Entities/policy'
import { CommandBus } from '@nestjs/cqrs';
import { Guid } from 'guid-typescript';
import { Client } from '../../Discord/Framework';
import { TextChannel } from 'discord.js';
import { Role } from '../../SMERSH/ValueObjects';
let cls: { new(id: Guid): PolicySearchReport } = PolicySearchReport;

@EventsHandler(RoleBanLiftedEvent)
export class RoleBanLiftedEventHandler implements IEventHandler<RoleBanLiftedEvent>
{
    public client: Client;
    public constructor(protected readonly commandBus: CommandBus) {
        const token = JSON.parse(process.argv[process.argv.length - 1])["DISCORD_TOKEN"]
        this.client = new Client(token, {
            intents: []
        }, commandBus)
    }

    async handle(event: RoleBanLiftedEvent) {
        let policy: PolicySearchReport = await SearchClient.Get(event.Id, PolicySearchReport)
        let role = Role.fromValue<Role>(event.Role)

        policy.IsActive = false;


        await SearchClient.Update(policy);

        const channel = await this.client.channels.cache.get(policy.ChannelId) as TextChannel
        await channel.send(`${role.DisplayName} roleban lifted from ${policy.Name}, originally banned on ${policy.BanDate.toString().split(' GMT')[0]} for ${policy.Reason}`)
        return;
    }
}