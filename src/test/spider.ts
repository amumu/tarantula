import * as fs from 'fs'
import * as tmp from 'tmp'
import * as path from 'path'
import * as assert from 'assert'
import { Spider, DistillerOptions } from '../tarantula'

describe('Spider', () => {
    let spider: Spider
    beforeEach(async () => spider = await Spider.create())
    afterEach(async () => await spider.kill())

    it('#create', async () => {
        const spider_ = await Spider.create()
        await spider_.kill()
    }).timeout(10000)

    it('create more spiders', async () => {
        let errored = false
        let spider1: any, spider2: any, spider3: any
        try {
            spider1 = await Spider.create()
            spider2 = await Spider.create()
            spider3 = await Spider.create()
        } catch(err) {
            console.log(err)
            errored = true
        } finally {
            spider1.kill()
            spider2.kill()
            spider3.kill()
            assert.equal(errored, false)
        }
    }).timeout(10000)

    it('load blank', async () => {
        await spider.load('about:blank')
    }).timeout(10000)

    it('load page', async () => {
        await spider.load('https://google.com')
    }).timeout(10000)

    it('load page after blank', async () => {
        await spider.load('https://google.com', {blank: true})
    }).timeout(10000)

    it('load blank after blank', async () => {
        await spider.load('about:blank', {blank: true})
    }).timeout(10000)

    it('malformed js', async () => {
        let errored = false
        try {
            await spider.exec(`gibberish`)
        } catch(err) {
            errored = true
        } finally {
            assert.equal(errored, true)
        }
    })

    it('get document title using string', async () => {
        await spider.load('https://google.com')
        const res = await spider.exec(`document.querySelector('title').textContent`)
        assert.equal(res, 'Google')
    }).timeout(10000)

    it('get document title using function', async () => {
        await spider.load('https://google.com')
        const res = await spider.exec(() => document.querySelector('title').textContent)
        assert.equal(res, 'Google')
    }).timeout(10000)

    it('return object', async () => {
        const res = await spider.exec(() => { return {hello: 'world'} })
        assert.equal(JSON.stringify(res), JSON.stringify({hello: 'world'}))
    })

    it('use distiller', async () => {
        await spider.load(path.join('file://', __dirname, '..', 'data', 'example_article.html'))
        for (let engine of ['chromium', 'firefox', 'safari']) {
            const res = await spider.distill({engine: engine} as DistillerOptions)
            assert(res.length > 0, `Article length ${res.length} for ${engine} distiller: ${res}`)
        }
    })

    it('use distiller failure', async () => {
        await spider.page.setContent('<h1>gibberish</h1>')
        for (let engine of ['chromium', 'firefox', 'safari']) {
            const res = await spider.distill({engine: engine} as DistillerOptions)
            assert(res.length === 0, `Article length ${res.length} for ${engine} distiller: ${res}`)
        }
    })

    it('create web archive', async () => {
        const file = tmp.fileSync({postfix: '.mhtml'})
        await spider.archive(file.name)
        assert(fs.existsSync(file.name))
        assert(fs.readFileSync(file.name, 'UTF8').length > 0)
    }).timeout(10000)

    // TODO: test waitFor
    // TODO: test userAgent
})
