const fsp = require('fs/promises');
const path = require('path');
const https = require('https');
const yaml = require('js-yaml');
const {getInvalidEmailConstantKeys} = require('./email-content-constants');

const EMAIL_CONTENT_LOG_PREFIX = '[EMAIL_CONTENT]';

const YAML_RELATIVE_PATH = 'yaml/notification_email_values.yaml';
const DEFAULT_FETCH_TIMEOUT_MS = 10000; // 10 seconds
const MAX_EMAIL_CONTENT_BYTES = 65536; // 64KB
const PREFETCH_RETRY_MS = 60000; // 1 minute

const EMAIL_TEMPLATE_FILES = [
    'notification-template.html',
    'notification-template-user.html',
    'notification-template-submission.html',
    'notification-template-edit-submission.html',
    'notification-template-sr-reopen.html',
    'notification-template-sr-inquire.html',
    'notification-template-SR-pending-conditions.html',
    'notification-template-pending-clear.html',
];

const EMAIL_TEMPLATE_FILE_SET = new Set(EMAIL_TEMPLATE_FILES);

let instance = null;

/**
 * Log line when a notification is skipped because email content is unavailable.
 * @param {number} consecutiveFetchFailures
 * @returns {string}
 */
function getUninitializedCacheLogMessage(consecutiveFetchFailures) {
    const count = consecutiveFetchFailures || 0;
    return `${EMAIL_CONTENT_LOG_PREFIX} Email not sent: email content cache is not initialized (GitHub unreachable or files missing); consecutive GitHub failures: ${count} (~${count} min)`;
}

/**
 * Fetches a URL over HTTPS and returns the response body when status is 200.
 * Rejects when the body exceeds MAX_EMAIL_CONTENT_BYTES.
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
function fetchHttpsText(url, timeoutMs) {
    const requestTimeoutMs = timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const headers = { 'User-Agent': 'crdc-datahub-backend' };
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => {
            if (settled) {
                return;
            }
            settled = true;
            fn(value);
        };
        const req = https.get(url, { headers }, (res) => {
            const contentLength = Number.parseInt(res.headers?.['content-length'], 10);
            if (Number.isFinite(contentLength) && contentLength > MAX_EMAIL_CONTENT_BYTES) {
                req.destroy();
                finish(reject, new Error(`Response exceeds ${MAX_EMAIL_CONTENT_BYTES} byte limit`));
                return;
            }
            const chunks = [];
            let bytes = 0;
            res.on('data', (chunk) => {
                bytes += chunk.length;
                if (bytes > MAX_EMAIL_CONTENT_BYTES) {
                    req.destroy();
                    finish(reject, new Error(`Response exceeds ${MAX_EMAIL_CONTENT_BYTES} byte limit`));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => {
                if (settled) {
                    return;
                }
                if (res.statusCode !== 200) {
                    finish(reject, new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                const data = Buffer.concat(chunks).toString('utf8');
                if (!data) {
                    finish(reject, new Error('Empty response body'));
                    return;
                }
                finish(resolve, data);
            });
        });
        req.setTimeout(requestTimeoutMs, () => {
            req.destroy(new Error(`Request timed out after ${requestTimeoutMs}ms`));
        });
        req.on('error', (err) => {
            finish(reject, err);
        });
    });
}

class EmailContentCache {
    /**
     * @param {string} baseUrl Raw GitHub base URL including the branch
     * @param {string} branch Sanitized TIER branch name
     * @param {string} cacheDir Root cache directory (branch subdirectory is appended)
     * @param {number} refreshSeconds TTL before a file is refetched
     */
    constructor(baseUrl, branch, cacheDir, refreshSeconds) {
        this.baseUrl = String(baseUrl || '').replace(/\/$/, '');
        this.branch = branch;
        this.cacheDir = cacheDir;
        this.cacheRoot = path.resolve(cacheDir, branch);
        this.refreshSeconds = refreshSeconds;
        this.refreshMs = refreshSeconds * 1000;
        this.consecutiveFetchFailures = 0;
        this._inflight = new Map();
        this._parsedYaml = null;
        this._parsedYamlMtimeMs = null;
        this._retryTimer = null;
        this._hasLoggedStartupStatus = false;
        this._hasLoggedInitialized = false;
        this._prefetchInflight = null;
        this._cycleGitHubUnreachable = false;
    }

    /**
     * @returns {string[]}
     */
    _allowlistedRelativePaths() {
        return [
            YAML_RELATIVE_PATH,
            ...EMAIL_TEMPLATE_FILES.map((fileName) => `email-templates/${fileName}`),
        ];
    }

    /**
     * Disk and YAML health after a prefetch cycle.
     * @returns {Promise<{
     *   complete: boolean,
     *   missingTemplates: string[],
     *   yamlNotFound: boolean,
     *   yamlParseError: string|null,
     *   yamlNotMapping: boolean,
     *   missingKeys: string[],
     * }>}
     */
    async _inspectContentStatus() {
        const missingTemplates = [];
        for (const fileName of EMAIL_TEMPLATE_FILES) {
            try {
                await fsp.access(this._destPath(`email-templates/${fileName}`));
            } catch {
                missingTemplates.push(fileName);
            }
        }
        let yamlNotFound = false;
        let yamlParseError = null;
        let yamlNotMapping = false;
        let missingKeys = [];
        try {
            const text = await fsp.readFile(this._destPath(YAML_RELATIVE_PATH), 'utf8');
            try {
                const parsed = yaml.load(text);
                const invalidKeys = getInvalidEmailConstantKeys(parsed);
                if (invalidKeys[0] === '<root>') {
                    yamlNotMapping = true;
                } else {
                    missingKeys = invalidKeys;
                }
            } catch (e) {
                yamlParseError = e.message || String(e);
            }
        } catch {
            yamlNotFound = true;
        }
        const complete = missingTemplates.length === 0
            && !yamlNotFound
            && !yamlParseError
            && !yamlNotMapping
            && missingKeys.length === 0;
        return {
            complete,
            missingTemplates,
            yamlNotFound,
            yamlParseError,
            yamlNotMapping,
            missingKeys,
        };
    }

    _stopRetry() {
        if (this._retryTimer) {
            clearInterval(this._retryTimer);
            this._retryTimer = null;
        }
    }

    _startRetry() {
        if (this._retryTimer) {
            return;
        }
        this._retryTimer = setInterval(() => {
            this.prefetchAll().catch((e) => {
                console.error(e);
            });
        }, PREFETCH_RETRY_MS);
        if (typeof this._retryTimer.unref === 'function') {
            this._retryTimer.unref();
        }
    }

    /**
     * Builds the first-cycle incomplete status block. Each line uses EMAIL_CONTENT_LOG_PREFIX.
     * @param {object} status From _inspectContentStatus
     * @returns {string}
     */
    _formatStartupStatusBlock(status) {
        const lines = [
            `${EMAIL_CONTENT_LOG_PREFIX} initialization incomplete (branch: ${this.branch})`,
        ];
        if (status.missingTemplates.length > 0) {
            lines.push(`${EMAIL_CONTENT_LOG_PREFIX} missing templates: ${status.missingTemplates.join(', ')}`);
        }
        if (status.yamlNotFound) {
            lines.push(`${EMAIL_CONTENT_LOG_PREFIX} yaml: not found`);
        } else if (status.yamlParseError) {
            lines.push(`${EMAIL_CONTENT_LOG_PREFIX} yaml: parse error: ${status.yamlParseError}`);
        } else if (status.yamlNotMapping) {
            lines.push(`${EMAIL_CONTENT_LOG_PREFIX} yaml: not a mapping`);
        } else if (status.missingKeys.length > 0) {
            lines.push(`${EMAIL_CONTENT_LOG_PREFIX} yaml missing keys: ${status.missingKeys.join(', ')}`);
        }
        if (this._cycleGitHubUnreachable) {
            lines.push(
                `${EMAIL_CONTENT_LOG_PREFIX} github unreachable; consecutive failed attempts: ${this.consecutiveFetchFailures}`
            );
        }
        return lines.join('\n');
    }

    /**
     * Logs startup status (full block once) or a short retry line.
     * @param {object} status From _inspectContentStatus
     */
    _logPrefetchStatus(status) {
        const isFirstStatus = !this._hasLoggedStartupStatus;
        this._hasLoggedStartupStatus = true;
        if (status.complete) {
            if (!this._hasLoggedInitialized) {
                this._hasLoggedInitialized = true;
                console.info(`${EMAIL_CONTENT_LOG_PREFIX} initialized successfully (branch: ${this.branch})`);
            }
            return;
        }
        if (isFirstStatus) {
            console.error(this._formatStartupStatusBlock(status));
            return;
        }
        console.error(
            `${EMAIL_CONTENT_LOG_PREFIX} prefetch failed; consecutive failed attempts: ${this.consecutiveFetchFailures}`
        );
    }

    /**
     * Updates consecutive failure count and retry timer after a prefetch cycle.
     * @returns {Promise<void>}
     */
    async _updateCompletenessState() {
        const status = await this._inspectContentStatus();
        if (status.complete) {
            this.consecutiveFetchFailures = 0;
            this._stopRetry();
            this._logPrefetchStatus(status);
            return;
        }
        this.consecutiveFetchFailures += 1;
        this._logPrefetchStatus(status);
        this._startRetry();
    }

    /**
     * @returns {string}
     */
    getUninitializedCacheLogMessage() {
        return getUninitializedCacheLogMessage(this.consecutiveFetchFailures);
    }

    /**
     * Fetches every allowlisted email resource, ignoring TTL. Failures are logged.
     * Concurrent callers share one in-flight cycle.
     * @returns {Promise<void>}
     */
    async prefetchAll() {
        if (this._prefetchInflight) {
            return this._prefetchInflight;
        }
        this._prefetchInflight = this._runPrefetchAll().finally(() => {
            this._prefetchInflight = null;
        });
        return this._prefetchInflight;
    }

    /**
     * @returns {Promise<void>}
     */
    async _runPrefetchAll() {
        this._cycleGitHubUnreachable = false;
        const relativePaths = this._allowlistedRelativePaths();
        await Promise.all(relativePaths.map((relativePath) => this._getCachedOrFetch(relativePath, true)));
        await this._updateCompletenessState();
    }

    /**
     * Returns parsed YAML copy constants, refreshing when the cache is stale.
     * @returns {Promise<object|null>}
     */
    async getYaml() {
        const text = await this._getCachedOrFetch(YAML_RELATIVE_PATH, false);
        if (!text) {
            return null;
        }
        const dest = this._destPath(YAML_RELATIVE_PATH);
        try {
            const stat = await fsp.stat(dest);
            if (this._parsedYaml && this._parsedYamlMtimeMs === stat.mtimeMs) {
                return this._parsedYaml;
            }
            const parsed = yaml.load(text);
            if (getInvalidEmailConstantKeys(parsed).length > 0) {
                this._parsedYaml = null;
                this._parsedYamlMtimeMs = null;
                console.error(`${EMAIL_CONTENT_LOG_PREFIX} yaml is missing required keys or is not a mapping`);
                return null;
            }
            this._parsedYaml = parsed;
            this._parsedYamlMtimeMs = stat.mtimeMs;
            return this._parsedYaml;
        } catch (e) {
            console.error(`${EMAIL_CONTENT_LOG_PREFIX} yaml parse failed: ${e.message}`);
            this._parsedYaml = null;
            this._parsedYamlMtimeMs = null;
            return null;
        }
    }

    /**
     * Returns an HTML template by file name, refreshing when the cache is stale.
     * @param {string} fileName Template file name (no path)
     * @returns {Promise<string|null>}
     */
    async getTemplate(fileName) {
        if (!EMAIL_TEMPLATE_FILE_SET.has(fileName)) {
            console.error(`Unknown email template: ${fileName}`);
            return null;
        }
        return this._getCachedOrFetch(`email-templates/${fileName}`, false);
    }

    /**
     * @param {string} relativePath
     * @returns {string}
     */
    _destPath(relativePath) {
        return path.join(this.cacheRoot, relativePath);
    }

    /**
     * @param {string} filePath
     * @returns {Promise<boolean>}
     */
    async _isFresh(filePath) {
        if (this.refreshMs <= 0) {
            return false;
        }
        try {
            const stat = await fsp.stat(filePath);
            return (Date.now() - stat.mtimeMs) < this.refreshMs;
        } catch {
            return false;
        }
    }

    /**
     * @param {string} relativePath
     * @param {boolean} force When true, always fetch from GitHub
     * @returns {Promise<string|null>}
     */
    async _getCachedOrFetch(relativePath, force) {
        const dest = this._destPath(relativePath);
        if (!force && await this._isFresh(dest)) {
            try {
                return await fsp.readFile(dest, 'utf8');
            } catch {
                // Fall through to fetch
            }
        }
        const inflight = this._inflight.get(relativePath);
        if (inflight) {
            return inflight;
        }
        const pending = this._fetchAndStore(relativePath, dest).finally(() => {
            this._inflight.delete(relativePath);
        });
        this._inflight.set(relativePath, pending);
        return pending;
    }

    /**
     * @param {string} relativePath
     * @param {string} dest
     * @returns {Promise<string|null>}
     */
    async _fetchAndStore(relativePath, dest) {
        const url = `${this.baseUrl}/${relativePath}`;
        try {
            const body = await fetchHttpsText(url);
            await fsp.mkdir(path.dirname(dest), { recursive: true });
            const tmp = `${dest}.tmp`;
            await fsp.writeFile(tmp, body, 'utf8');
            await fsp.rename(tmp, dest);
            if (relativePath === YAML_RELATIVE_PATH) {
                this._parsedYaml = null;
                this._parsedYamlMtimeMs = null;
            }
            return body;
        } catch (e) {
            if (isGitHubUnreachableError(e.message)) {
                this._cycleGitHubUnreachable = true;
            }
            try {
                const cached = await fsp.readFile(dest, 'utf8');
                console.error(
                    `${EMAIL_CONTENT_LOG_PREFIX} Failed to fetch ${url}: ${e.message}; using cached copy`
                );
                return cached;
            } catch {
                console.error(
                    `${EMAIL_CONTENT_LOG_PREFIX} Failed to fetch ${url}: ${e.message}; no cached copy`
                );
                return null;
            }
        }
    }
}

/**
 * Creates or returns the process-wide email content cache.
 * @param {string} baseUrl
 * @param {string} branch
 * @param {string} cacheDir
 * @param {number} refreshSeconds
 * @returns {EmailContentCache}
 */
function initializeEmailContentCache(baseUrl, branch, cacheDir, refreshSeconds) {
    if (!instance) {
        instance = new EmailContentCache(baseUrl, branch, cacheDir, refreshSeconds);
        return instance;
    }
    const sameConfig = instance.baseUrl === String(baseUrl || '').replace(/\/$/, '')
        && instance.branch === branch
        && instance.cacheDir === cacheDir
        && instance.refreshSeconds === refreshSeconds;
    if (!sameConfig) {
        console.error(
            `${EMAIL_CONTENT_LOG_PREFIX} initialize ignored; cache already created with different config`
        );
    }
    return instance;
}

/**
 * Initializes the process-wide cache from `updateConfig` values.
 * @param {object} config Runtime config from updateConfig
 * @returns {EmailContentCache}
 */
function initializeEmailContentFromConfig(config) {
    return initializeEmailContentCache(
        config.email_content_base_url,
        config.email_content_branch,
        config.email_content_cache_dir,
        config.email_content_refresh_seconds
    );
}

/**
 * @returns {EmailContentCache|null}
 */
function getEmailContentCache() {
    return instance;
}

/**
 * Starts a background prefetch. Does not throw; retries every 60s until complete.
 * The API process must start even if email content is missing; emails skip until prefetch succeeds.
 */
function startEmailContentPrefetch() {
    if (!instance) {
        console.error(`${EMAIL_CONTENT_LOG_PREFIX} cache is not initialized; skipping prefetch`);
        return;
    }
    instance.prefetchAll().catch((e) => {
        console.error(e);
    });
}

/**
 * True when a fetch failure means GitHub was not usable (not a 404 missing file).
 * @param {string} [message]
 * @returns {boolean}
 */
function isGitHubUnreachableError(message) {
    if (!message) {
        return false;
    }
    if (/timed out/i.test(message)) {
        return true;
    }
    if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
        return true;
    }
    const httpMatch = String(message).match(/HTTP (\d+)/);
    if (httpMatch) {
        const statusCode = Number.parseInt(httpMatch[1], 10);
        return statusCode === 429 || statusCode >= 500;
    }
    return false;
}

/**
 * Resets the singleton (tests only).
 */
function resetEmailContentCacheForTests() {
    if (instance) {
        instance._stopRetry();
    }
    instance = null;
}

module.exports = {
    EmailContentCache,
    EMAIL_CONTENT_LOG_PREFIX,
    EMAIL_TEMPLATE_FILES,
    YAML_RELATIVE_PATH,
    MAX_EMAIL_CONTENT_BYTES,
    PREFETCH_RETRY_MS,
    getUninitializedCacheLogMessage,
    initializeEmailContentCache,
    initializeEmailContentFromConfig,
    getEmailContentCache,
    startEmailContentPrefetch,
    resetEmailContentCacheForTests,
};
