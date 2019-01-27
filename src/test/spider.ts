import * as fs from 'fs';
import * as tmp from 'tmp';
import * as assert from 'assert';
import { Spider } from '../tarantula'

describe('Spider', () => {
    let spider: Spider;
    beforeEach(async () => spider = await Spider.create());
    afterEach(async () => await spider.kill());

    it('#create', async () => {
        const spider_ = await Spider.create();
        await spider_.kill();
    }).timeout(10000);

    it('create more spiders', async () => {
        let errored = false;
        let spider1: any, spider2: any, spider3: any;
        try {
            spider1 = await Spider.create();
            spider2 = await Spider.create();
            spider3 = await Spider.create();
        } catch(err) {
            console.log(err);
            errored = true;
        } finally {
            spider1.kill();
            spider2.kill();
            spider3.kill();
            assert.equal(errored, false);
        }
    }).timeout(10000);

    it('load blank', async () => {
        await spider.load('about:blank');
    }).timeout(10000);

    it('load page', async () => {
        await spider.load('https://google.com');
    }).timeout(10000);

    it('load page after blank', async () => {
        await spider.load('https://google.com', {blank: true});
    }).timeout(10000);

    it('load blank after blank', async () => {
        await spider.load('about:blank', {blank: true});
    }).timeout(10000);

    it('malformed js', async () => {
        let errored = false;
        try {
            await spider.exec(`gibberish`);
        } catch(err) {
            errored = true;
        } finally {
            assert.equal(errored, true);
        }
    });

    it('get document title using string', async () => {
        await spider.load('https://google.com');
        const res = await spider.exec(`document.querySelector('title').textContent`);
        assert.equal(res, 'Google');
    }).timeout(10000);

    it('get document title using function', async () => {
        await spider.load('https://google.com');
        const res = await spider.exec(() => document.querySelector('title').textContent);
        assert.equal(res, 'Google');
    }).timeout(10000);

    it('return object', async () => {
        const res = await spider.exec(() => { return {hello: 'world'} });
        assert.equal(JSON.stringify(res), JSON.stringify({hello: 'world'}))
    });

    it('use distiller', async () => {
        await spider.load('https://example.com');
        const res = await spider.distill();
        assert(res.length > 0);
    }).timeout(10000);

    it('create web archive', async () => {
        const path = tmp.fileSync({postfix: '.mhtml'})
        await spider.load('https://example.com');
        await spider.archive(path.name);
        assert(fs.existsSync(path.name));
        assert(fs.readFileSync(path.name, 'UTF8').length > 0)
    }).timeout(10000);

    // TODO: test waitFor
    // TODO: test userAgent
});
