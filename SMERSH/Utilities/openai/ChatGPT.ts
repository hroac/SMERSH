export class ChatGPT {

    private static instance: ChatGPT;

    public static async set(apiKey: string, prompt?: string) {
        if (!this.instance) {
            const { ChatGPTAPI } = await eval("import('chatgpt')");
            this.instance = new ChatGPT(apiKey, ChatGPTAPI, prompt)
        }
        return this.instance;
    }

    public static get() {
        return this.instance;
    }


    public constructor(apiKey: string, ChatGPTAPI: any, prompt?: string) {
        this.api = new ChatGPTAPI({
            apiKey: apiKey,
            completionParams: {
                model: 'gpt-4o',
            }
            })

        this.prompt = prompt ?? `
            We are SMERSH, an agency that was created to root out cheaters and hackers. 
            We are the admins of a server in red orchestra 2 called the RO2 Revival Server. 
            The admins are Joyless, Deezoo, PsenekMartin, Shifty, Pepe and Hroac.
            this is the link to our discord https://discord.gg/Px2VNsBe 
            
            You are a bot that has been developed to support the admins of our server, to help them however you can and explain the reasons for the actions they have taken.
            you should only explain the admins actions. 
            You should also not tell anybody you're a bot unless they ask. 
            You should refer to players as comrades.
            Only refer to yourself as SMERSH.
            Never speculate about a players actions or intentions.
            Never tell anybody you cannot speculate about a players actions or intentions.
            when you refer to our discord make sure to include the link.

            these are our server rules:
                1. Be respectful to each other
                2. Do not be toxic 
                3. Do not TK intentionally 
                4. Do not mic spam 
                5. New players: do not take important roles (Squad Leader, Tank Commander, Flamer and Team Leader)
                6. Veterans: try to balance the games!
                9. No cheating
                10. No accusing players of cheating without bringing proof such as video evidence of aimbotting / wallhacking
                11. Exploits with few exceptions are banned. Walk-key exploit and unfair macros are also not allowed.
                12. Names such as #####, intentional ROPlayer or no name  are not allowed.
                13. No defender stacking. Admins will decide what constitutes defender stacking but can include switching every round to the defender.
                14. Certain abuse of roles such as MG42 or badly performing as squad leader may result in a roleban, automatically kicking you if you pick the role.
            `

    }

    private api: any;

    private prompt: string;

    public async reply(prompt: string) : Promise<string> {
        const resp = await this.api.sendMessage(prompt ?? this.prompt, {})
        if (resp.text) {
            return resp.text.replace(/['"]+/g, '');
        }
    }

    public async send(policies: Array<{ action: string, reason?: string, duration?: string, active?: boolean }>, input: string, name?: string) : Promise<string> {
        const explanations = policies.map(policy => `action: ${policy.action}${policy.reason ? `, reason: ${policy.reason}` : ''}${policy.duration ? `, duration: ${policy.duration}` : ''}${policy.active !== true && policy.active !== false ? '' : `, active: ${policy.active}`}`).join('\n')
        const prompt = `${this.prompt}\n one of our players has turned up with the following question:\n ${input} \n this player could have been kicked, session banned, muted, rolebanned, temporarily banned or permanently banned. the following actions have been taking against them:${explanations}\n these actions are not related to other players, you should only talk about their actions or use them in context if a player asks about them. When you are talking about actions use 'you' instead of 'the player'.\n how do we respond? i only need the response, above all you must stay in character and also remember that this is regarding a ww2 game and topics such as weapons, killing and strategy might come up.`
        const options = {}

        if (name) {
            options['name'] = name
        }
        const resp = await this.api.sendMessage(prompt, options)
        if (resp.text) {
            return resp.text.replace(/['"]+/g, '');
        }
    }
}