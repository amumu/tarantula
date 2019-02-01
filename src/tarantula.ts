import * as fs from 'fs'
import * as url from 'url'
import * as path from 'path'
import { Requests } from 'ootils'
import { Mutex } from 'await-semaphore'
import { Cooky } from './cooky'
import * as puppeteer from 'puppeteer'
const devices: any = require('puppeteer/DeviceDescriptors')

// Re-export our cookie parsing class
export { Cooky }

// Re-export some important puppeteer types
export type Request = puppeteer.Request
export type Response = puppeteer.Response
export type StringMap = {[key: string]: string}

export interface PostOptions extends Requests.RequestPromiseOptions {
    /**
     * Parse set-cookies from response header and copy them to this spider instance by default
     */
    rejectCookies?: boolean
}

export interface LoadOptions extends puppeteer.NavigationOptions {
    /**
     * "Wipe" the tab by loading about:blank before loading intended URL
     */
    blank?: boolean
}

export interface SpiderOptions {
    browser?: puppeteer.Browser,
    emulate?: string,
    verbose?: boolean
}

export class Spider {
    verbose: boolean
    ownBrowser = false
    page: puppeteer.Page
    browser: puppeteer.Browser
    clones: Spider[] = []

    constructor(
            browser: puppeteer.Browser, page: puppeteer.Page, ownBrowser = false, verbose = false) {
        this.browser = browser
        this.page = page
        this.ownBrowser = ownBrowser
        this.verbose = verbose
    }

    static async create(opts: SpiderOptions = {}) {
        let browser: puppeteer.Browser
        let page: puppeteer.Page
        let ownBrowser = false

        // Spider may need to launch its own browser process if we were not given one
        if (!opts.browser) {
            ownBrowser = true
            browser = await puppeteer.launch(
                {args: ['--no-sandbox', '--disable-setuid-sandbox']})
            page = (await browser.pages())[0]
        } else {
            browser = opts.browser
            page = await browser.newPage()
        }

        // Hide bot hints from user agent
        const userAgent = await page.evaluate(() => navigator.userAgent) as string
        page.setUserAgent(userAgent.replace('Headless', ''))

        // Spider can be anything we want!
        if (opts.emulate) {
            page.emulate(devices[opts.emulate])
        }

        return new Spider(browser, page, ownBrowser, opts.verbose)
    }

    /**
     * See https://github.com/GoogleChrome/puppeteer/blob/master/DeviceDescriptors.js
     * @param deviceName name of the device to emulate, for example "iPhone X"
     */
    emulate(deviceName: string) {
        this.page.emulate(devices[deviceName])
    }

    exec(code: puppeteer.EvaluateFn, ...args: any[]) {
        return this.page.evaluate(code, args)
    }

    async url() {
        return await this.exec(() => window.location.href) as string
    }

    async load(uri: url.Url | string, opts: LoadOptions = {}) {
        if (typeof uri !== 'string') uri = url.format(uri)
        if (opts.blank) await this.load('about:blank')
        if ((await this.url()) !== uri)
            return this.page.goto(uri, opts)
    }

    /**
     * Shorthand for the `page.screenshot()` function.
     * @param opts screenshot options object
     */
    screenshot(opts: puppeteer.ScreenshotOptions = {}) {
        if (!('fullPage' in opts)) opts.fullPage = true
        return this.page.screenshot(opts)
    }

    awaitResponse(filter: (response: Response) => any, timeout: number = 30000) {
        return new Promise<any>((resolve, reject) => {
            setTimeout(() => reject('Timeout exceeded'), timeout)
            const listener = async (response: Response) => {
                const res = await Promise.resolve(filter(response))
                if (res) {
                    this.page.removeListener('response', listener)
                    resolve(res)
                }
            }
            this.page.addListener('response', listener)
        })
    }

    /**
     * Creates a new tab using parent browser and copies settings from this instance into new page.
     */
    async clone() {
        const url = await this.exec(() => window.location.href) as string
        const userAgent = await this.exec(() => navigator.userAgent) as string

        // Instantiate new spider
        const opts: SpiderOptions = {browser: this.browser, verbose: this.verbose}
        const spider_ = await Spider.create(opts)

        // Add it to the list of clones
        this.clones.push(spider_)

        // Set options
        await spider_.page.setUserAgent(userAgent)

        // Load same URL
        await spider_.load(url)

        // Return cloned spider
        return spider_
    }

    async kill() {
        await Promise.all(this.clones.map(clone => clone.kill().catch(err => {/* no-op */})))
        await this.page.close().catch(err => {/* no-op */})
        if (this.ownBrowser) await this.browser.close()
    }

    async setCookie(...cookies: (puppeteer.SetCookie | string)[]) {
        cookies.forEach(cookie =>
            this.page.setCookie(typeof cookie === 'string' ? Cooky.parse(cookie) : cookie))
    }

    async mouseMove(x?: number, y?: number, steps: number = 100) {
        try {
            const [w, h] = await this.exec(() => [window.innerWidth, window.innerHeight])
            const [x_, y_] = [
                x || Math.floor(Math.random() * w),
                y || Math.floor(Math.random() * h)]
            if (this.verbose) console.log(`Moving mouse to ${x_}x${y_}`)
            await this.page.mouse.move(x_, y_, {steps: steps})
        } catch (exc) {
            // No-op: it could be that no window is loaded yet
            if (this.verbose) console.log('Error moving mouse:', exc)
        }
    }

    /**
     * Sends a POST request from Node, using the browser's cookies
     * TODO: send the POST request by injecting Javascript instead of from Node
     * @param url destination of the POST request
     * @param opts optional settings for the POST request
     */
    async post(url: string, opts?: PostOptions) {
        opts = opts || {}

        // Convert all headers to lower case
        opts.headers = Object.keys(opts.headers || {}).reduce((map, key) => {
            map[key.toLocaleLowerCase()] = opts.headers[key]
            return map
        }, {} as StringMap)

        // Copy user agent from spider if none is provided
        opts.headers['user-agent'] = opts.headers['user-agent'] || await this.exec(
            () => navigator.userAgent)

        // Copy cookie from spider if none is provided
        opts.headers['cookie'] = opts.headers['cookie'] || (await this.page.cookies()).map(
            cookie => `${cookie.name}=${cookie.value}`).join(' ')

        // Debug info
        if (this.verbose) {
            console.log(`Sending post request to ${url}`)
            console.log(opts)
        }

        // Submit request and return result
        return Requests.post(url, opts, (error, response, body) => {
            // Did you bring us cookies? We eat all the cookies
            if (!opts.rejectCookies) {
                (response.headers["set-cookie"] || [] as string[]).forEach(setCookie => {
                    this.setCookie(Cooky.parse(setCookie, url))
                })
            }
        })
    }

    /**
     * Injects the distiller used by Firefox into the webpage and returns the main content.
     */
    async distill() {
        // await this.exec(fs.readFileSync(path.join(__dirname, 'distiller.js'), 'UTF8'))
        // const distilled = await this.exec('org.chromium.distiller.DomDistiller.apply()[2][1]')
        await this.exec(fs.readFileSync(path.join(__dirname, 'readability.js'), 'UTF8'))
        const distilled = await this.exec('new Readability(document).parse().content')
        return distilled as string
    }

    /**
     * Saves the current page into a web archive in MHTML format
     * @param path local destination of the web archive MHTML file
     */
    async archive(path: string) {
        const session = await this.page.target().createCDPSession()
        await session.send('Page.enable')
        const data: any = await session.send('Page.captureSnapshot')
        return new Promise((resolve, reject) => {
            fs.writeFile(path, data['data'], err => {
                if (err) reject(err)
                else resolve()
            })
        })
    }
}

export class SpiderPool {
    spiders: Spider[]
    browser: puppeteer.Browser

    mutex: Mutex
    spidersFree: Spider[] = []
    spidersBusy: Spider[] = []
    awaiters: ((spider: Spider) => Promise<void>)[] = []

    protected constructor(browser: puppeteer.Browser, spiders: Spider[]) {
        this.browser = browser
        this.spiders = spiders
        this.spidersFree = spiders.slice(0)
        this.mutex = new Mutex()
    }

    static async create(num = 1, opts: SpiderOptions = {}) {
        if ('browser' in opts) throw new Error('"browser" is not a valid option')

        const browser = await puppeteer.launch(
            {args: ['--no-sandbox', '--disable-setuid-sandbox']})
        opts.browser = browser
        const firstPage = (await browser.pages())[0]

        // Create a spider for each slot in the pool
        const spiders = [new Spider(browser, firstPage)]
        for (let i = 1; i < num; i++) {
            spiders.push(await Spider.create(opts))
        }

        // When a page has an error, automatically release the spider
        return new SpiderPool(browser, spiders)
    }

    /**
     * Acquire an available Spider from the pool. If `timeoutMillis` is zero, wait indefinitely. If
     * it's a negative number, throw a timeout error immediately if no Spider is available.
     * Otherwise, wait the given number of milliseconds until a Spider becomes available. By default
     * this function waits indefinitely.
     * @param timeoutMillis milliseconds to wait until timeout error is thrown
     */
    async acquire(timeoutMillis: number = 0): Promise<Spider> {
        const timeoutError = new Error('Timeout exceeded waiting for a Spider')
        // Begin thread-safe block
        const releaseMutex = await this.mutex.acquire()

        // Early exit: a spider is immediately available
        if (this.spidersFree.length > 0) {
            const spider = this.spidersFree.shift()
            this.spidersBusy.push(spider)
            releaseMutex()
            return spider
        }

        // Early exit: a spider is not available and we can't wait
        if (timeoutMillis < 0) {
            releaseMutex()
            throw(timeoutError)
        }

        // Otherwise concurrent threads until the awaiter has been added
        return new Promise<Spider>(async (resolve, reject) => {

            // Otherwise, wait until timeout is over and then fail out if no spider becomes available
            let timer: NodeJS.Timer = null
            const callback = async (spider: Spider) => {
                clearTimeout(timer)
                resolve(spider)
                // Spider is already busy, no need to add it to the queue
            }

            // If timeout is zero, wait forever
            if (timeoutMillis > 0) {
                // When timeout is reached, remove callback from queue and reject promise
                timer = setTimeout(() => {
                    // Make sure that no other threads interfere with this operation
                    this.mutex.use(async () =>
                        this.awaiters.splice(this.awaiters.indexOf(callback), 1))
                        .then(() => reject(timeoutError))
                }, timeoutMillis)
            }

            // Add our callback to the queue for when the next spider becomes available
            this.awaiters.push(callback)

            // Now we can let other threads use the mutex, so spiders can be released
            releaseMutex()
        })
    }

    async release(spider: Spider) {
        // This entire function must be thread-safe
        return this.mutex.use(async () => {
            const idx = this.spidersBusy.indexOf(spider)

            // Early exit: Spider must be in the list of busy
            if (idx === -1) {
                throw new Error('Spider not found. Did you call release twice?')
            }

            // Load blank page and callback the first awaiter
            await spider.load('about:blank')
            if (this.awaiters.length > 0) {
                await this.awaiters.shift()(spider)

            // If no awaiter, just add to the list of free
            } else {
                this.spidersBusy.splice(idx, 1)
                this.spidersFree.push(spider)
            }
        })
    }

    async dispose() {
        await Promise.all(this.spiders.map(spider => spider.kill()))
        const pages = await this.browser.pages()
        // It's possible that the browser was
        if (pages.length === 0) await this.browser.close()
    }
}
