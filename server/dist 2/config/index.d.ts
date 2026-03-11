export declare const config: {
    readonly env: string;
    readonly port: number;
    readonly database: {
        readonly url: string;
    };
    readonly jwt: {
        readonly secret: string;
        readonly expiresIn: string;
    };
    readonly cors: {
        readonly origin: (string | RegExp)[];
    };
    readonly defaultAdmin: {
        readonly email: string;
        readonly password: string;
    };
    readonly smtp: {
        readonly host: string;
        readonly port: number;
        readonly secure: boolean;
        readonly user: string;
        readonly pass: string;
        readonly fromName: string;
        readonly fromEmail: string;
    };
    readonly appUrl: string;
};
//# sourceMappingURL=index.d.ts.map