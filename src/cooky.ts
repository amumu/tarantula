import { SetCookie } from 'puppeteer';

export class Cooky {
    static parse(setCookie: string, url?: string): SetCookie {
        const parts = setCookie.split(';').map(chunk => chunk.trim());
        const [name, value] = parts[0].split('=', 2).map(decodeURIComponent);
        
        const settings = parts.slice(1).map(pair => pair.split('=', 2)).reduce((map, pair) => {
            const key = pair[0].toLocaleLowerCase();
            const val = pair.length === 1 ? '' : pair[1];
            map[key] = val;
            return map;
        }, {} as any);
    
        return {
            name: name,
            value: value,
            url: url,
            domain: settings.domain,
            expires: (settings['max-age'] && parseInt(settings['max-age'])) || undefined,
            httpOnly: 'httponly' in settings,
            path: settings.path,
            sameSite: settings.samesite,
            secure: 'secure' in settings
        }
    }
}