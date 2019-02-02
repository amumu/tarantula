"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const tarantula_1 = require("../tarantula");
const assert = require("assert");
describe('SpiderPool', () => {
    let pool;
    beforeEach(() => __awaiter(this, void 0, void 0, function* () { return pool = yield tarantula_1.SpiderPool.create(); }));
    afterEach(() => __awaiter(this, void 0, void 0, function* () { return yield pool.dispose(); }));
    it('#create', () => __awaiter(this, void 0, void 0, function* () {
        const pool_ = yield tarantula_1.SpiderPool.create();
        yield pool_.dispose();
    })).timeout(10000);
    it('pool full', () => __awaiter(this, void 0, void 0, function* () {
        let errored = false;
        yield pool.acquire();
        try {
            yield pool.acquire(-1);
        }
        catch (err) {
            errored = true;
        }
        finally {
            assert.equal(errored, true);
        }
    })).timeout(10000);
    it('async pool full', () => __awaiter(this, void 0, void 0, function* () {
        let errored = false;
        const pool = yield tarantula_1.SpiderPool.create(1);
        yield pool.acquire();
        try {
            yield pool.acquire(1000);
        }
        catch (err) {
            errored = true;
        }
        finally {
            pool.dispose();
            assert.equal(errored, true);
        }
    })).timeout(10000);
    it('pool flooding and flushing', () => __awaiter(this, void 0, void 0, function* () {
        for (let i = 0; i < 5; i++) {
            const spider = yield pool.acquire(-1);
            for (let j = 0; j < 5; j++)
                yield pool.acquire(-1).catch(err => { });
            yield pool.release(spider);
        }
        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
    })).timeout(10000);
    it('async pool flooding and flushing', () => __awaiter(this, void 0, void 0, function* () {
        const pool = yield tarantula_1.SpiderPool.create(5);
        // Acquire spiders and run operation that should end immediately
        const spiders = [];
        for (let i = 0; i < 5; i++) {
            const spider = yield pool.acquire(100);
            assert.equal(i, yield spider.exec((x) => x, i));
            spiders.push(spider);
        }
        // Try to acquire when pool is full
        for (let i = 0; i < 5; i++)
            yield pool.acquire(100).catch(err => { });
        // Now release them all
        yield new Promise((resolve, _) => setTimeout(resolve, 100));
        for (let i = 0; i < 5; i++)
            yield pool.release(spiders[i]);
        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
        pool.dispose();
    })).timeout(10000);
    it('async pool release to callback', () => __awaiter(this, void 0, void 0, function* () {
        let acquired = null;
        const pool = yield tarantula_1.SpiderPool.create(5);
        // Acquire all spiders
        const spiders = [];
        for (let i = 0; i < 5; i++)
            spiders.push(yield pool.acquire(100));
        // Try to acquire one spider when pool is full, but don't wait until timeout
        pool.acquire(1000).then(spider => acquired = spider);
        // Now release one
        const spider = spiders.pop();
        yield pool.release(spider);
        // Verify that it got acquired
        assert.equal(acquired, spider);
        // Now release all spiders
        yield pool.release(acquired);
        for (let i = 0; i < 4; i++)
            yield pool.release(spiders[i]);
        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
        pool.dispose();
    })).timeout(10000);
    it('async pool release after timeout', () => __awaiter(this, void 0, void 0, function* () {
        const pool = yield tarantula_1.SpiderPool.create(5);
        // Acquire spiders and run operation that should end immediately
        const spiders = [];
        for (let i = 0; i < 5; i++) {
            const spider = yield pool.acquire(100);
            assert.equal(i, yield spider.exec((x) => x, i));
            spiders.push(spider);
        }
        // Try to acquire when pool is full
        for (let i = 0; i < 5; i++)
            yield pool.acquire(100).catch(err => { });
        // Perform operation that will never end, do not wait on it
        for (let i = 0; i < 5; i++)
            spiders[i].exec(() => setInterval(() => console.log('waiting'), 100));
        // Give it a second for the queues to settle
        yield new Promise((resolve, _) => setTimeout(resolve, 1000));
        // Now release them all
        yield new Promise((resolve, _) => setTimeout(resolve, 100));
        for (let i = 0; i < 5; i++)
            yield pool.release(spiders[i]);
        // Acquire again and run operation that should end immediately
        for (let i = 0; i < 5; i++) {
            const spider = yield pool.acquire(100);
            assert.equal(i, yield spider.exec((x) => x, i));
            yield pool.release(spider);
        }
        assert.equal(0, pool.awaiters.length);
        assert.equal(0, pool.spidersBusy.length);
        yield pool.dispose();
    })).timeout(10000);
    it('load page', () => __awaiter(this, void 0, void 0, function* () {
        const spider = yield pool.acquire();
        yield spider.load('https://google.com');
        yield pool.dispose();
    })).timeout(10000);
    it('malformed js', () => __awaiter(this, void 0, void 0, function* () {
        let errored = false;
        const spider = yield pool.acquire();
        try {
            yield spider.exec(`gibberish`);
        }
        catch (err) {
            errored = true;
        }
        finally {
            assert.equal(errored, true);
        }
    }));
    it('get document title using string', () => __awaiter(this, void 0, void 0, function* () {
        const spider = yield pool.acquire();
        yield spider.load('https://google.com');
        const res = yield spider.exec(`document.querySelector('title').textContent`);
        assert.equal(res, 'Google');
    })).timeout(10000);
    it('get document title using function', () => __awaiter(this, void 0, void 0, function* () {
        const spider = yield pool.acquire();
        yield spider.load('https://google.com');
        const res = yield spider.exec(() => document.querySelector('title').textContent);
        assert.equal(res, 'Google');
    })).timeout(10000);
    it('return object', () => __awaiter(this, void 0, void 0, function* () {
        const spider = yield pool.acquire();
        const res = yield spider.exec(() => { return { hello: 'world' }; });
        assert.equal(JSON.stringify(res), JSON.stringify({ hello: 'world' }));
    }));
    it('using with() to auto-release on success', () => __awaiter(this, void 0, void 0, function* () {
        const pool = yield tarantula_1.SpiderPool.create(1);
        const res = yield pool.with((spider) => __awaiter(this, void 0, void 0, function* () {
            return yield spider.exec(() => 'hello world');
        }));
        // Result should be expected
        assert.equal(res, 'hello world');
        // Acquiring a new Spider should work
        yield pool.acquire(-1);
        yield pool.dispose();
    }));
    it('using with() to auto-release on failure', () => __awaiter(this, void 0, void 0, function* () {
        const pool = yield tarantula_1.SpiderPool.create(1);
        let errored = false;
        yield pool.with((spider) => __awaiter(this, void 0, void 0, function* () {
            return yield spider.exec('gibberish');
        })).catch(_ => errored = true);
        // Error should have been raised
        assert.equal(errored, true);
        // Acquiring a new Spider should work
        yield pool.acquire(-1);
        yield pool.dispose();
    }));
    // TODO: test waitFor
    // TODO: test userAgent
});
