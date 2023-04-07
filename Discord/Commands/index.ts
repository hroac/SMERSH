import { Command } from "../Framework/Command"
import { HelloCommand } from './HelloCommand'
import { LookupCommand } from './LookupCommand'
import { TestCommand } from './TestCommand'
import { TempbanCommand } from './TempbanCommand'
import { KickCommand } from './KickCommand'
export const Commands: Command[] = [HelloCommand, LookupCommand, TempbanCommand, KickCommand];