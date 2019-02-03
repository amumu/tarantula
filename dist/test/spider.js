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
const fs = require("fs");
const tmp = require("tmp");
const path = require("path");
const assert = require("assert");
const tarantula_1 = require("../tarantula");
describe('Spider', () => {
    let spider;
    beforeEach(() => __awaiter(this, void 0, void 0, function* () { return spider = yield tarantula_1.Spider.create(); }));
    afterEach(() => __awaiter(this, void 0, void 0, function* () { return yield spider.kill(); }));
    it('#create', () => __awaiter(this, void 0, void 0, function* () {
        const spider_ = yield tarantula_1.Spider.create();
        yield spider_.kill();
    })).timeout(10000);
    it('create more spiders', () => __awaiter(this, void 0, void 0, function* () {
        let errored = false;
        let spider1, spider2, spider3;
        try {
            spider1 = yield tarantula_1.Spider.create();
            spider2 = yield tarantula_1.Spider.create();
            spider3 = yield tarantula_1.Spider.create();
        }
        catch (err) {
            console.log(err);
            errored = true;
        }
        finally {
            spider1.kill();
            spider2.kill();
            spider3.kill();
            assert.equal(errored, false);
        }
    })).timeout(10000);
    it('load blank', () => __awaiter(this, void 0, void 0, function* () {
        yield spider.load('about:blank');
    })).timeout(10000);
    it('load page', () => __awaiter(this, void 0, void 0, function* () {
        yield spider.load('https://google.com');
    })).timeout(10000);
    it('load page after blank', () => __awaiter(this, void 0, void 0, function* () {
        yield spider.load('https://google.com', { blank: true });
    })).timeout(10000);
    it('load blank after blank', () => __awaiter(this, void 0, void 0, function* () {
        yield spider.load('about:blank', { blank: true });
    })).timeout(10000);
    it('malformed js', () => __awaiter(this, void 0, void 0, function* () {
        let errored = false;
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
        yield spider.load('https://google.com');
        const res = yield spider.exec(`document.querySelector('title').textContent`);
        assert.equal(res, 'Google');
    })).timeout(10000);
    it('get document title using function', () => __awaiter(this, void 0, void 0, function* () {
        yield spider.load('https://google.com');
        const res = yield spider.exec(() => document.querySelector('title').textContent);
        assert.equal(res, 'Google');
    })).timeout(10000);
    it('return object', () => __awaiter(this, void 0, void 0, function* () {
        const res = yield spider.exec(() => { return { hello: 'world' }; });
        assert.equal(JSON.stringify(res), JSON.stringify({ hello: 'world' }));
    }));
    it('use distiller', () => __awaiter(this, void 0, void 0, function* () {
        yield spider.load(path.join('file://', __dirname, '..', 'data', 'example_article.html'));
        for (let engine of ['chromium', 'firefox', 'safari']) {
            const res = yield spider.distill({ engine: engine });
            assert(res.length > 0, `Article length ${res.length} for ${engine} distiller: ${res}`);
        }
    }));
    it('use distiller failure', () => __awaiter(this, void 0, void 0, function* () {
        yield spider.page.setContent('<h1>gibberish</h1>');
        for (let engine of ['chromium', 'firefox', 'safari']) {
            const res = yield spider.distill({ engine: engine });
            assert(res.length === 0, `Article length ${res.length} for ${engine} distiller: ${res}`);
        }
    }));
    it('create web archive', () => __awaiter(this, void 0, void 0, function* () {
        const file = tmp.fileSync({ postfix: '.mhtml' });
        yield spider.archive(file.name);
        assert(fs.existsSync(file.name));
        assert(fs.readFileSync(file.name, 'UTF8').length > 0);
    })).timeout(10000);
    // TODO: test waitFor
    // TODO: test userAgent
});
