# Tarantula
Wrapper around the [Puppeteer](https://github.com/GoogleChrome/puppeteer) package.

## Features
- Typescript definitions
- Native Promise async/await API
- Handles initialization of browser / pages
- Provides pool scheduling mechanism to limit concurrency

## Examples
To create a single `Spider` and load a page:
```ts
const spider = await Spider.create();
await spider.load('https://google.com');
```

To create a `SpiderPool` and load a page before discarding resource:
```ts
// Create a pool with 2 Spiders
const pool = await SpiderPool.create(2);

// Acquire a spider from the pool and load a page 5 times
for (let i = 0; i < 5; i++) {
    // This call will await until a Spider becomes available
    const spider = await pool.acquire();
    // Once we have a Spider available, we can load a page
    await spider.load('https://google.com');
    // Don't forget to release the resource to put it back in the pool
    await pool.release(spider);
}
```

We can also set a timeout for acquiring a `Spider` from the pool:
```ts
const pool: SpiderPool = ...
const timeoutMillis = 5000;
const spider = await pool.acquire(timeoutMillis);
```