export { }
import { IEventHandler } from '@nestjs/cqrs';
import { EventsHandler } from '@nestjs/cqrs/dist/decorators/events-handler.decorator';
import { RoundStartedEvent } from '../../Events'
import { SearchClient } from '../../Elastic'
import { RoundSearchReport } from '../../Reports/Entities/round'
import { MapSearchReport } from '../../Reports/Entities/map'
import { IndexedClass } from '../../SMERSH/Utilities/types';
import { CommandBus } from '@nestjs/cqrs';
import { Guid } from 'guid-typescript';
let cls: { new(id: Guid, mapId: Guid): RoundSearchReport } = RoundSearchReport;
let map: { new(id: Guid): MapSearchReport } = MapSearchReport;

@EventsHandler(RoundStartedEvent)
export class RoundStartedEventHandler implements IEventHandler<RoundStartedEvent>
{
    public constructor(protected readonly commandBus: CommandBus) {
    }

    async handle(event: RoundStartedEvent) {

        let partial: RoundSearchReport = new cls(event.Id, event.MapId);
        partial.Players = event.Players;
        partial.IsActive = true;

        delete partial.Lines;
        await SearchClient.Update(partial);

        let partialMap: Partial<MapSearchReport> = new map(event.MapId)
        partialMap.TimeLimit = event.TimeLimit;

        delete partialMap.MapName;
        delete partialMap.Layouts;
        delete partialMap.Tickets;

        await SearchClient.Update(partialMap);
        return;
    }
}