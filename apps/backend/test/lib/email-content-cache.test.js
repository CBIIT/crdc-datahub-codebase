const { EventEmitter } = require('events');
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const https = require('https');

jest.mock('https');

const {
    EmailContentCache,
    EMAIL_CONTENT_LOG_PREFIX,
    EMAIL_TEMPLATE_FILES,
    YAML_RELATIVE_PATH,
    MAX_EMAIL_CONTENT_BYTES,
    PREFETCH_RETRY_MS,
    getUninitializedCacheLogMessage,
    initializeEmailContentCache,
    resetEmailContentCacheForTests,
} = require('../../lib/email-content-cache');

const FIXTURE_YAML = fs.readFileSync(
    path.join(__dirname, '../fixtures/notification_email_values.yaml'),
    'utf8'
);

function mockHttpsGet(handler) {
    https.get.mockImplementation((url, _options, callback) => {
        const res = new EventEmitter();
        const req = new EventEmitter();
        req.setTimeout = jest.fn();
        req.destroy = jest.fn();
        process.nextTick(() => {
            handler(url, res, req);
            if (callback) {
                callback(res);
            }
        });
        return req;
    });
}

function succeedWith(body, statusCode = 200) {
    mockHttpsGet((_url, res) => {
        res.statusCode = statusCode;
        process.nextTick(() => {
            res.emit('data', Buffer.from(body));
            res.emit('end');
        });
    });
}

function failWithStatus(statusCode) {
    mockHttpsGet((_url, res) => {
        res.statusCode = statusCode;
        process.nextTick(() => {
            res.emit('data', Buffer.from('not found'));
            res.emit('end');
        });
    });
}

function failWithNetworkError(message) {
    mockHttpsGet((_url, _res, req) => {
        process.nextTick(() => {
            req.emit('error', new Error(message));
        });
    });
}

describe('EmailContentCache', () => {
    let cacheDir;
    let cache;
    let errorSpy;

    beforeEach(async () => {
        jest.clearAllMocks();
        cacheDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'email-content-'));
        cache = new EmailContentCache(
            'https://raw.githubusercontent.com/CBIIT/crdc-submission-portal-email-content/dev',
            'dev',
            cacheDir,
            300
        );
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(async () => {
        cache._stopRetry();
        errorSpy.mockRestore();
        await fsp.rm(cacheDir, { recursive: true, force: true });
    });

    it('writes fetched YAML and HTML to the branch cache directory', async () => {
        mockHttpsGet((url, res) => {
            res.statusCode = 200;
            const body = String(url).includes(YAML_RELATIVE_PATH)
                ? FIXTURE_YAML
                : '<p>Hello {{ firstName }}</p>';
            process.nextTick(() => {
                res.emit('data', Buffer.from(body));
                res.emit('end');
            });
        });

        const yamlConstants = await cache.getYaml();
        const template = await cache.getTemplate('notification-template.html');

        expect(yamlConstants).not.toBeNull();
        expect(yamlConstants.NOTIFICATION_SENDER).toBeDefined();
        expect(template).toBe('<p>Hello {{ firstName }}</p>');
        expect(fs.existsSync(path.join(cacheDir, 'dev', YAML_RELATIVE_PATH))).toBe(true);
        expect(fs.existsSync(path.join(cacheDir, 'dev', 'email-templates/notification-template.html'))).toBe(true);
        expect(https.get).toHaveBeenCalled();
        expect(https.get.mock.calls[0][1].headers.Authorization).toBeUndefined();
        expect(https.get.mock.calls[0][1].headers['User-Agent']).toBe('crdc-datahub-backend');
    });

    it('uses the previous cache when GitHub returns an error status', async () => {
        const dest = path.join(cacheDir, 'dev', 'email-templates/notification-template.html');
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, '<p>cached</p>', 'utf8');
        const past = new Date(Date.now() - 10 * 60 * 1000);
        await fsp.utimes(dest, past, past);

        failWithStatus(503);
        const template = await cache.getTemplate('notification-template.html');

        expect(template).toBe('<p>cached</p>');
        expect(errorSpy.mock.calls.some((call) => {
            const text = String(call[0]);
            return text.includes(EMAIL_CONTENT_LOG_PREFIX)
                && text.includes('HTTP 503')
                && text.includes('using cached copy');
        })).toBe(true);
    });

    it('returns null when GitHub is down and the cache is empty', async () => {
        failWithNetworkError('getaddrinfo ENOTFOUND');
        const yamlConstants = await cache.getYaml();
        expect(yamlConstants).toBeNull();
        expect(errorSpy.mock.calls.some((call) => {
            const text = String(call[0]);
            return text.includes(EMAIL_CONTENT_LOG_PREFIX) && text.includes('no cached copy');
        })).toBe(true);
    });

    it('skips https.get when the cached file is still within the TTL', async () => {
        const dest = path.join(cacheDir, 'dev', 'email-templates/notification-template.html');
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, '<p>fresh</p>', 'utf8');

        succeedWith('<p>remote</p>');
        const template = await cache.getTemplate('notification-template.html');

        expect(template).toBe('<p>fresh</p>');
        expect(https.get).not.toHaveBeenCalled();
    });

    it('fetches again after the TTL expires', async () => {
        const dest = path.join(cacheDir, 'dev', 'email-templates/notification-template.html');
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, '<p>stale</p>', 'utf8');
        const past = new Date(Date.now() - 10 * 60 * 1000);
        await fsp.utimes(dest, past, past);

        succeedWith('<p>updated</p>');
        const template = await cache.getTemplate('notification-template.html');

        expect(template).toBe('<p>updated</p>');
        expect(https.get).toHaveBeenCalled();
        expect(await fsp.readFile(dest, 'utf8')).toBe('<p>updated</p>');
    });

    it('coalesces concurrent fetches for the same path', async () => {
        let sendResponse;
        https.get.mockImplementation((_url, _options, callback) => {
            const res = new EventEmitter();
            const req = new EventEmitter();
            req.setTimeout = jest.fn();
            req.destroy = jest.fn();
            sendResponse = () => {
                res.statusCode = 200;
                callback(res);
                res.emit('data', Buffer.from('<p>once</p>'));
                res.emit('end');
            };
            return req;
        });

        const first = cache.getTemplate('notification-template.html');
        const second = cache.getTemplate('notification-template.html');
        for (let i = 0; i < 20 && typeof sendResponse !== 'function'; i += 1) {
            await new Promise((resolve) => setImmediate(resolve));
        }
        sendResponse();
        const [a, b] = await Promise.all([first, second]);

        expect(a).toBe('<p>once</p>');
        expect(b).toBe('<p>once</p>');
        expect(https.get).toHaveBeenCalledTimes(1);
    });

    it('prefetchAll fetches every allowlisted file and does not throw on failure', async () => {
        failWithStatus(404);
        await expect(cache.prefetchAll()).resolves.toBeUndefined();
        expect(https.get).toHaveBeenCalledTimes(EMAIL_TEMPLATE_FILES.length + 1);
        expect(errorSpy).toHaveBeenCalled();
    });

    it('rejects unknown template names without fetching', async () => {
        const result = await cache.getTemplate('../secret.html');
        expect(result).toBeNull();
        expect(https.get).not.toHaveBeenCalled();
    });

    it('does not overwrite cache when the response exceeds the size limit', async () => {
        const dest = path.join(cacheDir, 'dev', 'email-templates/notification-template.html');
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, '<p>cached</p>', 'utf8');
        const past = new Date(Date.now() - 10 * 60 * 1000);
        await fsp.utimes(dest, past, past);

        succeedWith('x'.repeat(MAX_EMAIL_CONTENT_BYTES + 1));
        const template = await cache.getTemplate('notification-template.html');

        expect(template).toBe('<p>cached</p>');
        expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('byte limit'))).toBe(true);
    });

    it('rejects oversized Content-Length before reading the body', async () => {
        mockHttpsGet((_url, res) => {
            res.statusCode = 200;
            res.headers = { 'content-length': String(MAX_EMAIL_CONTENT_BYTES + 1) };
            process.nextTick(() => {
                res.emit('data', Buffer.from('x'));
                res.emit('end');
            });
        });
        const yamlConstants = await cache.getYaml();
        expect(yamlConstants).toBeNull();
        expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('byte limit'))).toBe(true);
    });

    it('increments consecutive failures on incomplete prefetch and retries until complete', async () => {
        failWithStatus(404);
        await cache.prefetchAll();
        expect(cache.consecutiveFetchFailures).toBe(1);
        expect(cache._retryTimer).not.toBeNull();
        const firstStatus = String(errorSpy.mock.calls.find((call) => String(call[0]).includes('initialization incomplete'))?.[0] || '');
        expect(firstStatus).toContain(`${EMAIL_CONTENT_LOG_PREFIX} initialization incomplete (branch: dev)`);
        expect(firstStatus).toContain('missing templates:');
        expect(firstStatus).toContain('yaml: not found');
        expect(firstStatus).not.toContain('github unreachable');

        mockHttpsGet((url, res) => {
            res.statusCode = 200;
            const body = String(url).includes(YAML_RELATIVE_PATH)
                ? FIXTURE_YAML
                : '<p>ok</p>';
            process.nextTick(() => {
                res.emit('data', Buffer.from(body));
                res.emit('end');
            });
        });

        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        await cache.prefetchAll();
        expect(cache.consecutiveFetchFailures).toBe(0);
        expect(cache._retryTimer).toBeNull();
        expect(fs.existsSync(path.join(cacheDir, 'dev', YAML_RELATIVE_PATH))).toBe(true);
        expect(infoSpy).toHaveBeenCalledWith(`${EMAIL_CONTENT_LOG_PREFIX} initialized successfully (branch: dev)`);
        infoSpy.mockRestore();
    });

    it('schedules another prefetch after the retry interval when the cache is incomplete', async () => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
        try {
            failWithStatus(404);
            await cache.prefetchAll();
            const spy = jest.spyOn(cache, 'prefetchAll').mockResolvedValue(undefined);
            await jest.advanceTimersByTimeAsync(PREFETCH_RETRY_MS);
            expect(spy).toHaveBeenCalled();
            spy.mockRestore();
        } finally {
            cache._stopRetry();
            jest.useRealTimers();
        }
    });

    it('describes skipped sends with consecutive failure count', () => {
        cache.consecutiveFetchFailures = 12;
        expect(cache.getUninitializedCacheLogMessage()).toBe(
            `${EMAIL_CONTENT_LOG_PREFIX} Email not sent: email content cache is not initialized (GitHub unreachable or files missing); consecutive GitHub failures: 12 (~12 min)`
        );
        expect(getUninitializedCacheLogMessage(0)).toContain('cache is not initialized');
    });

    it('logs a single success line when prefetch loads templates and valid YAML', async () => {
        mockHttpsGet((url, res) => {
            res.statusCode = 200;
            const body = String(url).includes(YAML_RELATIVE_PATH)
                ? FIXTURE_YAML
                : '<p>ok</p>';
            process.nextTick(() => {
                res.emit('data', Buffer.from(body));
                res.emit('end');
            });
        });
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        await cache.prefetchAll();
        expect(infoSpy).toHaveBeenCalledTimes(1);
        expect(infoSpy).toHaveBeenCalledWith(`${EMAIL_CONTENT_LOG_PREFIX} initialized successfully (branch: dev)`);
        infoSpy.mockRestore();
    });

    it('logs yaml parse error when the file is present but invalid', async () => {
        failWithStatus(404);
        const dest = path.join(cacheDir, 'dev', YAML_RELATIVE_PATH);
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, 'NOTIFICATION_SENDER: [unterminated', 'utf8');
        for (const fileName of EMAIL_TEMPLATE_FILES) {
            const templateDest = path.join(cacheDir, 'dev', 'email-templates', fileName);
            await fsp.mkdir(path.dirname(templateDest), { recursive: true });
            await fsp.writeFile(templateDest, '<p>ok</p>', 'utf8');
        }
        await cache.prefetchAll();
        const status = String(errorSpy.mock.calls.find((call) => String(call[0]).includes('initialization incomplete'))?.[0] || '');
        expect(status).toContain(`${EMAIL_CONTENT_LOG_PREFIX} yaml: parse error:`);
        expect(status).not.toContain('initialized successfully');
    });

    it('logs missing YAML keys and does not log success', async () => {
        const incompleteYaml = FIXTURE_YAML.replace(/^INQUIRE_CONTENT:.*$/m, '');
        mockHttpsGet((url, res) => {
            res.statusCode = 200;
            const body = String(url).includes(YAML_RELATIVE_PATH)
                ? incompleteYaml
                : '<p>ok</p>';
            process.nextTick(() => {
                res.emit('data', Buffer.from(body));
                res.emit('end');
            });
        });
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        await cache.prefetchAll();
        const status = String(errorSpy.mock.calls.find((call) => String(call[0]).includes('initialization incomplete'))?.[0] || '');
        expect(status).toContain(`${EMAIL_CONTENT_LOG_PREFIX} yaml missing keys: INQUIRE_CONTENT`);
        expect(infoSpy).not.toHaveBeenCalled();
        infoSpy.mockRestore();
    });

    it('uses a short retry line on the second incomplete prefetch', async () => {
        failWithStatus(404);
        await cache.prefetchAll();
        errorSpy.mockClear();
        await cache.prefetchAll();
        const retryLines = errorSpy.mock.calls
            .map((call) => String(call[0]))
            .filter((text) => text.includes('prefetch failed; consecutive failed attempts:'));
        expect(retryLines.some((text) => text === `${EMAIL_CONTENT_LOG_PREFIX} prefetch failed; consecutive failed attempts: 2`)).toBe(true);
        expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('initialization incomplete'))).toBe(false);
        expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('missing templates:'))).toBe(false);
    });

    it('logs github unreachable and consecutive attempts on network failure', async () => {
        failWithNetworkError('getaddrinfo ENOTFOUND raw.githubusercontent.com');
        await cache.prefetchAll();
        const status = String(errorSpy.mock.calls.find((call) => String(call[0]).includes('initialization incomplete'))?.[0] || '');
        expect(status).toContain(`${EMAIL_CONTENT_LOG_PREFIX} github unreachable; consecutive failed attempts: 1`);
        expect(status).toContain('yaml: not found');
    });

    it('getYaml returns null when YAML is missing required keys', async () => {
        succeedWith('NOTIFICATION_SENDER: "noreply@example.org"\n');
        const yamlConstants = await cache.getYaml();
        expect(yamlConstants).toBeNull();
        expect(errorSpy.mock.calls.some((call) => String(call[0]).includes('missing required keys'))).toBe(true);
    });

    it('getYaml returns null when YAML is a sequence', async () => {
        succeedWith('- one\n- two\n');
        const yamlConstants = await cache.getYaml();
        expect(yamlConstants).toBeNull();
    });

    it('treats invalid Handlebars templates as incomplete', async () => {
        mockHttpsGet((url, res) => {
            res.statusCode = 200;
            const href = String(url);
            let body;
            if (href.includes(YAML_RELATIVE_PATH)) {
                body = FIXTURE_YAML;
            } else if (href.includes('email-templates/notification-template.html')) {
                body = '{{#if unclosed';
            } else {
                body = '<p>ok</p>';
            }
            process.nextTick(() => {
                res.emit('data', Buffer.from(body));
                res.emit('end');
            });
        });
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        await cache.prefetchAll();
        expect(cache.consecutiveFetchFailures).toBe(1);
        expect(cache._retryTimer).not.toBeNull();
        const status = String(errorSpy.mock.calls.find((call) => String(call[0]).includes('initialization incomplete'))?.[0] || '');
        expect(status).toContain(`${EMAIL_CONTENT_LOG_PREFIX} invalid templates: notification-template.html`);
        expect(infoSpy).not.toHaveBeenCalled();
        infoSpy.mockRestore();
    });
});

describe('initializeEmailContentCache', () => {
    afterEach(() => {
        resetEmailContentCacheForTests();
    });

    it('keeps the first instance when a second call uses different config', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const first = initializeEmailContentCache('https://example.com/a', 'dev', '/tmp/a', 300);
        const second = initializeEmailContentCache('https://example.com/b', 'test', '/tmp/b', 0);
        expect(second).toBe(first);
        expect(first.branch).toBe('dev');
        expect(errorSpy).toHaveBeenCalledWith(
            `${EMAIL_CONTENT_LOG_PREFIX} initialize ignored; cache already created with different config`
        );
        errorSpy.mockRestore();
    });

    it('does not warn when a second call uses the same config', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        initializeEmailContentCache('https://example.com/a', 'dev', '/tmp/a', 300);
        initializeEmailContentCache('https://example.com/a', 'dev', '/tmp/a', 300);
        expect(errorSpy).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});
