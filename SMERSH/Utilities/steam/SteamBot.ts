const SteamUser = require('steam-user');
import { hexToDec, decToHex } from 'hex2dec'
import { ChatGPT } from '../openai'

export class SteamBot {
    public constructor(steamUser) {
        this.steam = steamUser;
    }

    public static async set(accountName: string, password: string) {
        if (!this.bot) {
            this.bot = new SteamBot(new SteamUser());
            
            await this.bot.login(accountName, password)
            await this.bot.setStatus(9800);
        }
        return this.bot;
    }

    public static get() {
        if (!this.bot) {
            const env = process.env;

            this.set(env["STEAM_ACCOUNT_NAME"], env["STEAM_ACCOUNT_PASSWORD"])
        }
        return this.bot;
    }

    private static bot: SteamBot;

    public steam;

    public async login(accountName: string, password: string) {
        await this.steam.logOn({
            accountName: accountName,
            password: password,
            logonID: Math.round(Math.random() * 100),
        });

        await new Promise<void>((resolve) => {
            this.steam.once('loggedOn', () => {
                resolve();
            });
        });
        return;
    }

    public async setStatus(gameId: number) {
        const { blocked, appid } = this.steam.playingState

        if (!appid) {
            this.steam.setPersona(SteamUser.EPersonaState.Online);
        }

        if (!blocked && appid && appid.toString() !== gameId.toString()) {
            this.steam.gamesPlayed(gameId);
        }
    }

    public async sendMessageToFriend(id: string, message: string) {
        const env = process.env
        const steamId64 = hexToDec(id);
        const online = this.steam.logOnResult && this.steam.logOnResult.eresult;
        let friends = Object.keys(this.steam.myFriends).filter(steamId => this.steam.myFriends[steamId] == SteamUser.EFriendRelationship.Friend);
        let isFriend = friends.includes(steamId64);

        if (!online) {
            await this.login(env["STEAM_ACCOUNT_NAME"], env["STEAM_ACCOUNT_PASSWORD"])
        }

        if (!isFriend) {
            try {
                await this.steam.addFriend(steamId64, () => { });
            } catch (error) {
                console.log('could not add friend ', steamId64, error)
            }

            let addFriendResult;
            try {
                addFriendResult = await new Promise<any>((resolve) => {
                    this.steam.on('friendRelationship', (steamId: any, relationship: any) => {
                        if (relationship === SteamUser.EFriendRelationship.Friend && steamId.getSteamID64() === steamId64) {
                            friends[decToHex(steamId64)] = SteamUser.EFriendRelationship.Friend;
                            resolve(SteamUser.EResult.OK);
                        } else {
                            resolve(SteamUser.EResult.AccountNotFriends)
                        }
                    });
                });
            } catch (error) {
                console.log('add friend result', error)
            }
               

                if (addFriendResult !== SteamUser.EResult.OK) {
                    console.log(`Failed to add user with ID ${id} as a friend`);
                }
        }

        isFriend = friends.includes(steamId64);

        if (isFriend) {
            await this.steam.chat.sendFriendMessage(steamId64, message, { chatEntryType: SteamUser.EChatEntryType.ChatMsg }, () => { });
        }
    }

    public async respondToFriend(id: string, policies: Array<{ action: string, reason?: string, duration?: string, active?: boolean }>, message: string, name?: string) {
        const chatGPT = ChatGPT.get();
        const response = await chatGPT.send(policies, message, name)

        await this.steam.chat.sendFriendMessage(id, response, { chatEntryType: SteamUser.EChatEntryType.ChatMsg }, () => { });
    }
}