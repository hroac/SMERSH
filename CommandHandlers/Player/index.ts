import { RegisterPlayerCommandHandler } from './RegisterPlayerCommandHandler'
import { ChangePlayerNameCommandHandler } from './ChangePlayerNameCommandHandler'
import { ApplyPolicyCommandHandler } from './ApplyPolicyCommandHandler'
import { LiftBanCommandHandler } from './LiftBanCommandHandler'
import { ApplyRoleBanCommandHandler } from './ApplyRoleBanCommandHandler'
import { LiftRoleBanCommandHandler } from './LiftRoleBanCommandHandler'
import { LiftMuteCommandHandler } from './LiftMuteCommandHandler'


export const PlayerCommandHandlers = [
    RegisterPlayerCommandHandler,
    ChangePlayerNameCommandHandler,
    ApplyPolicyCommandHandler,
    LiftBanCommandHandler,
    ApplyRoleBanCommandHandler,
    LiftRoleBanCommandHandler,
    LiftMuteCommandHandler
]