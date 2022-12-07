﻿import { Route } from '../'

export class PlayersRoute extends Route {
    private constructor(method: string, action: string) {
        super(method, action)
    }

    public static GetPlayers: PlayersRoute = new PlayersRoute('GET', "/current/players")

}