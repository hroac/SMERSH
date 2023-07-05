import { Guid } from "guid-typescript";
import { SearchReport } from '../../Framework'
import { Index, Field } from '@../../../SMERSH/Utilities'

@Index()
export class PlayerSearchReport extends SearchReport {
    constructor(id?: Guid) {
        super(id)

        this.Invisible = true;
    }

    @Field('text')
    public Name: string;

    @Field('text')
    public Ip: string;

    @Field('integer')
    public Role: number;

    @Field('boolean')
    public Invisible: boolean;

    UpdateCalculatedProperties(): void { }
}