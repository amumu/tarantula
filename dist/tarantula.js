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
const url = require("url");
const path = require("path");
const ootils_1 = require("ootils");
const await_semaphore_1 = require("await-semaphore");
const cooky_1 = require("./cooky");
exports.Cooky = cooky_1.Cooky;
const puppeteer = require("puppeteer");
const devices = require('puppeteer/DeviceDescriptors');
class Spider {
    constructor(browser, page, ownBrowser = false, verbose = false) {
        this.ownBrowser = false;
        this.clones = [];
        this.browser = browser;
        this.page = page;
        this.ownBrowser = ownBrowser;
        this.verbose = verbose;
    }
    static create(opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            let browser;
            let page;
            let ownBrowser = false;
            // Spider may need to launch its own browser process if we were not given one
            if (!opts.browser) {
                ownBrowser = true;
                browser = yield puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
                page = (yield browser.pages())[0];
            }
            else {
                browser = opts.browser;
                page = yield browser.newPage();
            }
            // Hide bot hints from user agent
            const userAgent = yield page.evaluate(() => navigator.userAgent);
            page.setUserAgent(userAgent.replace('Headless', ''));
            // Spider can be anything we want!
            if (opts.emulate) {
                page.emulate(devices[opts.emulate]);
            }
            return new Spider(browser, page, ownBrowser, opts.verbose);
        });
    }
    /**
     * See https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js
     * @param deviceName name of the device to emulate, for example "iPhone X"
     */
    emulate(deviceName) {
        this.page.emulate(devices[deviceName]);
    }
    exec(code, ...args) {
        return this.page.evaluate(code, args);
    }
    url() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.exec(() => window.location.href);
        });
    }
    load(uri, opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof uri !== 'string')
                uri = url.format(uri);
            if (opts.blank)
                yield this.load('about:blank');
            if ((yield this.url()) !== uri)
                return this.page.goto(uri, opts);
        });
    }
    /**
     * Shorthand for the `page.screenshot()` function.
     * @param opts screenshot options object
     */
    screenshot(opts = {}) {
        if (!('fullPage' in opts))
            opts.fullPage = true;
        return this.page.screenshot(opts);
    }
    awaitResponse(filter, timeout = 30000) {
        return new Promise((resolve, reject) => {
            setTimeout(() => reject('Timeout exceeded'), timeout);
            const listener = (response) => __awaiter(this, void 0, void 0, function* () {
                const res = yield Promise.resolve(filter(response));
                if (res) {
                    this.page.removeListener('response', listener);
                    resolve(res);
                }
            });
            this.page.addListener('response', listener);
        });
    }
    /**
     * Creates a new tab using parent browser and copies settings from this instance into new page.
     */
    clone() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = yield this.exec(() => window.location.href);
            const userAgent = yield this.exec(() => navigator.userAgent);
            // Instantiate new spider
            const opts = { browser: this.browser, verbose: this.verbose };
            const spider_ = yield Spider.create(opts);
            // Add it to the list of clones
            this.clones.push(spider_);
            // Set options
            yield spider_.page.setUserAgent(userAgent);
            // Load same URL
            yield spider_.load(url);
            // Return cloned spider
            return spider_;
        });
    }
    kill() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(this.clones.map(clone => clone.kill().catch(err => { })));
            yield this.page.close().catch(err => { });
            if (this.ownBrowser)
                yield this.browser.close();
        });
    }
    setCookie(...cookies) {
        return __awaiter(this, void 0, void 0, function* () {
            cookies.forEach(cookie => this.page.setCookie(typeof cookie === 'string' ? cooky_1.Cooky.parse(cookie) : cookie));
        });
    }
    mouseMove(x, y, steps = 100) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [w, h] = yield this.exec(() => [window.innerWidth, window.innerHeight]);
                const [x_, y_] = [
                    x || Math.floor(Math.random() * w),
                    y || Math.floor(Math.random() * h)
                ];
                if (this.verbose)
                    console.log(`Moving mouse to ${x_}x${y_}`);
                yield this.page.mouse.move(x_, y_, { steps: steps });
            }
            catch (exc) {
                // No-op: it could be that no window is loaded yet
                if (this.verbose)
                    console.log('Error moving mouse:', exc);
            }
        });
    }
    /**
     * Sends a POST request from Node, using the browser's cookies
     * TODO: send the POST request by injecting Javascript instead of from Node
     * @param url destination of the POST request
     * @param opts optional settings for the POST request
     */
    post(url, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            opts = opts || {};
            // Convert all headers to lower case
            opts.headers = Object.keys(opts.headers || {}).reduce((map, key) => {
                map[key.toLocaleLowerCase()] = opts.headers[key];
                return map;
            }, {});
            // Copy user agent from spider if none is provided
            opts.headers['user-agent'] = opts.headers['user-agent'] || (yield this.exec(() => navigator.userAgent));
            // Copy cookie from spider if none is provided
            opts.headers['cookie'] = opts.headers['cookie'] || (yield this.page.cookies()).map(cookie => `${cookie.name}=${cookie.value}`).join(' ');
            // Debug info
            if (this.verbose) {
                console.log(`Sending post request to ${url}`);
                console.log(opts);
            }
            // Submit request and return result
            return ootils_1.Requests.post(url, opts, (error, response, body) => {
                // Did you bring us cookies? We eat all the cookies
                if (!opts.rejectCookies) {
                    (response.headers["set-cookie"] || []).forEach(setCookie => {
                        this.setCookie(cooky_1.Cooky.parse(setCookie, url));
                    });
                }
            });
        });
    }
    /**
     * Injects the distiller used by Firefox into the webpage and returns the main content.
     */
    distill() {
        return __awaiter(this, void 0, void 0, function* () {
            // await this.exec(fs.readFileSync(path.join(__dirname, 'distiller.js'), 'UTF8'))
            // const distilled = await this.exec('org.chromium.distiller.DomDistiller.apply()[2][1]')
            yield this.exec(fs.readFileSync(path.join(__dirname, 'readability.js'), 'UTF8'));
            const distilled = yield this.exec('new Readability(document).parse().content');
            return distilled;
        });
    }
    /**
     * Saves the current page into a web archive in MHTML format
     * @param path local destination of the web archive MHTML file
     */
    archive(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield this.page.target().createCDPSession();
            yield session.send('Page.enable');
            const data = yield session.send('Page.captureSnapshot');
            return new Promise((resolve, reject) => {
                fs.writeFile(path, data['data'], err => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        });
    }
}
exports.Spider = Spider;
class SpiderPool {
    constructor(browser, spiders) {
        this.spidersFree = [];
        this.spidersBusy = [];
        this.awaiters = [];
        this.browser = browser;
        this.spiders = spiders;
        this.spidersFree = spiders.slice(0);
        this.mutex = new await_semaphore_1.Mutex();
    }
    static create(num = 1, opts = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if ('browser' in opts)
                throw new Error('"browser" is not a valid option');
            const browser = yield puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            opts.browser = browser;
            const firstPage = (yield browser.pages())[0];
            // Create a spider for each slot in the pool
            const spiders = [new Spider(browser, firstPage)];
            for (let i = 1; i < num; i++) {
                spiders.push(yield Spider.create(opts));
            }
            // When a page has an error, automatically release the spider
            return new SpiderPool(browser, spiders);
        });
    }
    /**
     * Acquire an available Spider from the pool. If `timeoutMillis` is zero, wait indefinitely. If
     * it's a negative number, throw a timeout error immediately if no Spider is available.
     * Otherwise, wait the given number of milliseconds until a Spider becomes available. By default
     * this function waits indefinitely.
     * @param timeoutMillis milliseconds to wait until timeout error is thrown
     */
    acquire(timeoutMillis = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const timeoutError = new Error('Timeout exceeded waiting for a Spider');
            // Begin thread-safe block
            const releaseMutex = yield this.mutex.acquire();
            // Early exit: a spider is immediately available
            if (this.spidersFree.length > 0) {
                const spider = this.spidersFree.shift();
                this.spidersBusy.push(spider);
                releaseMutex();
                return spider;
            }
            // Early exit: a spider is not available and we can't wait
            if (timeoutMillis < 0) {
                releaseMutex();
                throw (timeoutError);
            }
            // Otherwise concurrent threads until the awaiter has been added
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                // Otherwise, wait until timeout is over and then fail out if no spider becomes available
                let timer = null;
                const callback = (spider) => __awaiter(this, void 0, void 0, function* () {
                    clearTimeout(timer);
                    resolve(spider);
                    // Spider is already busy, no need to add it to the queue
                });
                // If timeout is zero, wait forever
                if (timeoutMillis > 0) {
                    // When timeout is reached, remove callback from queue and reject promise
                    timer = setTimeout(() => {
                        // Make sure that no other threads interfere with this operation
                        this.mutex.use(() => __awaiter(this, void 0, void 0, function* () { return this.awaiters.splice(this.awaiters.indexOf(callback), 1); }))
                            .then(() => reject(timeoutError));
                    }, timeoutMillis);
                }
                // Add our callback to the queue for when the next spider becomes available
                this.awaiters.push(callback);
                // Now we can let other threads use the mutex, so spiders can be released
                releaseMutex();
            }));
        });
    }
    release(spider) {
        return __awaiter(this, void 0, void 0, function* () {
            // This entire function must be thread-safe
            return this.mutex.use(() => __awaiter(this, void 0, void 0, function* () {
                const idx = this.spidersBusy.indexOf(spider);
                // Early exit: Spider must be in the list of busy
                if (idx === -1) {
                    throw new Error('Spider not found. Did you call release twice?');
                }
                // Load blank page and callback the first awaiter
                yield spider.load('about:blank');
                if (this.awaiters.length > 0) {
                    yield this.awaiters.shift()(spider);
                    // If no awaiter, just add to the list of free
                }
                else {
                    this.spidersBusy.splice(idx, 1);
                    this.spidersFree.push(spider);
                }
            }));
        });
    }
    with(callback, acquireTimeout = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const spider = yield this.acquire(acquireTimeout);
            try {
                return yield callback(spider);
            }
            finally {
                this.release(spider);
            }
        });
    }
    dispose() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(this.spiders.map(spider => spider.kill()));
            yield this.browser.close();
        });
    }
}
exports.SpiderPool = SpiderPool;
