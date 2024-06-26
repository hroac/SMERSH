﻿import { Guid } from "guid-typescript";
import { Domain } from './Domain'
import { ChatLinesReceivedEvent, RoundStartedEvent, RoundEndedEvent } from '../Events/Round'
import { MapChangedEvent } from '../Events/Map'
import { Message } from "../SMERSH/ValueObjects/round";

export class Round extends Domain {

    public MapId: Guid;

    public Date: Date;

    public Lines: Array<Message>;

    public Players: string[];

    constructor(id: Guid) {
        super(id);
        this.Date = new Date();
        this.Lines = []
        this.Players = []
    }

    public async receiveChatLines(lines: Array<Message>, date: Date) {
        this.Date = date;

        if (this.Lines) {
            const newLines = lines.filter(line => !this.Lines.some(line2 => line2.message === line.message))
            this.Lines = [...this.Lines, ...newLines]

        } else {
            this.Lines = lines
        }

        await this.apply(new ChatLinesReceivedEvent(this.Id, this.MapId, this.Date, this.Lines));
        return;
    }

    public async startRound(timeLimit: number, date: Date, players: string[]) {
       
        if (!this.Date) {
            this.Date = date;
            this.Players = players

            await this.apply(new RoundStartedEvent(this.Id, this.MapId, timeLimit, this.Date, this.Players));

        }
        return;
    }

    public async endRound(date: Date, players: string[]) {
        this.Date = date;

        if (this.Players && this.Players.length) {
            this.Players = [...this.Players, ...players].filter((player, index, self) => self.findIndex(playa => player === playa) === index);
        } else {
            this.Players = players;
        }

        await this.apply(new RoundEndedEvent(this.Id, this.MapId, this.Date, this.Players));
        return;
    }

    public async changeMap(mapId: Guid, mapName: string) {

        this.MapId = mapId;
        await this.apply(new MapChangedEvent(this.Id, this.MapId, mapName));
        return;
    }

}