import { SpiderPool, Spider } from '../tarantula'
import * as assert from 'assert';

describe('SpiderPool', () => {
    let pool: SpiderPool;

    beforeEach(async () => pool = await SpiderPool.create());
    afterEach(async () => await pool.dispose());

    it('#create', async () => {
        const pool_ = await SpiderPool.create();
        await pool_.dispose();
    }).timeout(10000);

    it('pool full', async () => {
        let errored = false;
        await pool.acquire();
        try {
            await pool.acquire(-1);
        } catch(err) {
            errored = true;
        } finally {
            assert.equal(errored, true);
        }
    }).timeout(10000);

    it('async pool full', async () => {
        let errored = false;
        const pool = await SpiderPool.create(1);
        await pool.acquire();
        try {
            await pool.acquire(1000);
        } catch(err) {
            errored = true;
        } finally {
            pool.dispose();
            assert.equal(errored, true);
        }
    }).timeout(10000);

    it('pool flooding and flushing', async () => {
        for (let i = 0; i < 5; i++) {
            const spider = await pool.acquire(-1);
            for (let j = 0; j < 5; j++)
                await pool.acquire(-1).catch(err => {});
            await pool.release(spider);
        }
        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
    }).timeout(10000);

    it('async pool flooding and flushing', async () => {
        const pool = await SpiderPool.create(5);

        // Acquire spiders and run operation that should end immediately
        const spiders: Spider[] = [];
        for (let i = 0; i < 5; i++) {
            const spider = await pool.acquire(100)
            assert.equal(i, await spider.exec((x: any) => x, i));
            spiders.push(spider);
        }

        // Try to acquire when pool is full
        for (let i = 0; i < 5; i++)
            await pool.acquire(100).catch(err => {});

        // Now release them all
        await new Promise((resolve, _) => setTimeout(resolve, 100));
        for (let i = 0; i < 5; i++)
            await pool.release(spiders[i]);

        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
        pool.dispose();
    }).timeout(10000);

    it('async pool release to callback', async () => {
        let acquired: Spider = null;
        const pool = await SpiderPool.create(5);

        // Acquire all spiders
        const spiders: Spider[] = [];
        for (let i = 0; i < 5; i++)
            spiders.push(await pool.acquire(100));

        // Try to acquire one spider when pool is full, but don't wait until timeout
        pool.acquire(1000).then(spider => acquired = spider);

        // Now release one
        const spider = spiders.pop();
        await pool.release(spider);

        // Verify that it got acquired
        assert.equal(acquired, spider);

        // Now release all spiders
        await pool.release(acquired);
        for (let i = 0; i < 4; i++)
            await pool.release(spiders[i]);

        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
        pool.dispose();
    }).timeout(10000);

    it('async pool release after timeout', async () => {
        const pool = await SpiderPool.create(5);

        // Acquire spiders and run operation that should end immediately
        const spiders: Spider[] = [];
        for (let i = 0; i < 5; i++) {
            const spider = await pool.acquire(100)
            assert.equal(i, await spider.exec((x: any) => x, i));
            spiders.push(spider);
        }

        // Try to acquire when pool is full
        for (let i = 0; i < 5; i++)
            await pool.acquire(100).catch(err => {});

        // Perform operation that will never end, do not wait on it
        for (let i = 0; i < 5; i++)
            spiders[i].exec(() => setInterval(() => console.log('waiting'), 100));

        // Give it a second for the queues to settle
        await new Promise((resolve, _) => setTimeout(resolve, 1000));

        // Now release them all
        await new Promise((resolve, _) => setTimeout(resolve, 100));
        for (let i = 0; i < 5; i++)
            await pool.release(spiders[i]);

        // Acquire again and run operation that should end immediately
        for (let i = 0; i < 5; i++) {
            const spider = await pool.acquire(100);
            assert.equal(i, await spider.exec((x: any) => x, i));
            await pool.release(spider);
        }

        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
        pool.dispose();
    }).timeout(10000);

    it('load page', async () => {
        const spider = await pool.acquire();
        await spider.load('https://google.com');
        await pool.dispose();
    }).timeout(10000);

    it('malformed js', async () => {
        let errored = false;
        const spider = await pool.acquire();
        try {
            await spider.exec(`gibberish`);
        } catch(err) {
            errored = true;
        } finally {
            assert.equal(errored, true);
        }
    });

    it('get document title using string', async () => {
        const spider = await pool.acquire();
        await spider.load('https://google.com');
        const res = await spider.exec(`document.querySelector('title').textContent`);
        assert.equal(res, 'Google');
    }).timeout(10000);

    it('get document title using function', async () => {
        const spider = await pool.acquire();
        await spider.load('https://google.com');
        const res = await spider.exec(() => document.querySelector('title').textContent);
        assert.equal(res, 'Google');
    }).timeout(10000);

    it('return object', async () => {
        const spider = await pool.acquire();
        const res = await spider.exec(() => { return {hello: 'world'} });
        assert.equal(JSON.stringify(res), JSON.stringify({hello: 'world'}))
    });

    // TODO: test waitFor
    // TODO: test userAgent
});
