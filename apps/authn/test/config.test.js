const fs = require('fs');
const os = require('os');
const path = require('path');

const DOCDB_ENV_KEYS = [
    'DOCDB_TLS',
    'DOCDB_CA_FILE',
    'DOCDB_ENDPOINT',
    'DOCDB_PORT',
    'DOCDB_USERNAME',
    'DOCDB_PASSWORD',
    'DOCDB_DB_NAME',
];

/**
 * @returns {object}
 */
function loadConfig() {
    jest.resetModules();
    return require('../config');
}

/**
 * @param {string} [caFile]
 */
function setRequiredDocdbEnv(caFile) {
    process.env.DOCDB_ENDPOINT = 'example.host';
    process.env.DOCDB_USERNAME = 'user@name';
    process.env.DOCDB_PASSWORD = 'p@ss:word';
    process.env.DOCDB_DB_NAME = 'my-db';
    if (caFile) {
        process.env.DOCDB_CA_FILE = caFile;
    }
}

describe('document_db_connection_string', () => {
    const saved = {};

    beforeEach(() => {
        for (const key of DOCDB_ENV_KEYS) {
            saved[key] = process.env[key];
            delete process.env[key];
        }
    });

    afterEach(() => {
        for (const key of DOCDB_ENV_KEYS) {
            if (saved[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = saved[key];
            }
        }
    });

    test('TLS off builds URI with authSource, retryWrites=false, default port, and encoded credentials', () => {
        process.env.DOCDB_TLS = 'false';
        setRequiredDocdbEnv();
        const config = loadConfig();

        const uri = config.document_db_connection_string;
        expect(uri).toContain('authSource=admin');
        expect(uri).toContain('retryWrites=false');
        expect(uri).not.toContain('tls=true');
        expect(uri).not.toContain('tlsCAFile');
        expect(uri).toContain('example.host:27017/');
        expect(uri).toContain(encodeURIComponent('user@name'));
        expect(uri).toContain(encodeURIComponent('p@ss:word'));
        expect(uri).toContain(encodeURIComponent('my-db'));
    });

    test('TLS on with CA file includes tls, tlsCAFile, and SCRAM-SHA-1', () => {
        const caFile = path.join(os.tmpdir(), `authn-docdb-ca-${Date.now()}.pem`);
        fs.writeFileSync(caFile, 'test-ca');
        try {
            process.env.DOCDB_TLS = 'true';
            process.env.DOCDB_ENDPOINT = 'docdb.example';
            process.env.DOCDB_USERNAME = 'user';
            process.env.DOCDB_PASSWORD = 'secret';
            process.env.DOCDB_DB_NAME = 'crdc-datahub';
            process.env.DOCDB_PORT = '27017';
            process.env.DOCDB_CA_FILE = caFile;
            const config = loadConfig();

            const uri = config.document_db_connection_string;
            expect(uri).toContain('tls=true');
            expect(uri).toContain(`tlsCAFile=${encodeURIComponent(caFile)}`);
            expect(uri).toContain('authMechanism=SCRAM-SHA-1');
            expect(uri).toContain('retryWrites=false');
        } finally {
            fs.unlinkSync(caFile);
        }
    });

    test('TLS on without CA file throws at load', () => {
        process.env.DOCDB_TLS = 'true';
        process.env.DOCDB_CA_FILE = path.join(os.tmpdir(), 'authn-docdb-ca-missing.pem');
        process.env.DOCDB_ENDPOINT = 'docdb.example';
        process.env.DOCDB_USERNAME = 'user';
        process.env.DOCDB_PASSWORD = 'secret';
        process.env.DOCDB_DB_NAME = 'crdc-datahub';

        expect(() => loadConfig()).toThrow(/CA file was not found/);
    });

    test('missing required DOCDB_* variables throw at load listing the names', () => {
        process.env.DOCDB_TLS = 'false';
        expect(() => loadConfig()).toThrow(
            'DocumentDB connection is missing required environment variables: DOCDB_ENDPOINT, DOCDB_USERNAME, DOCDB_PASSWORD, DOCDB_DB_NAME'
        );
    });

    test('unset DOCDB_TLS enables TLS', () => {
        const caFile = path.join(os.tmpdir(), `authn-docdb-ca-default-${Date.now()}.pem`);
        fs.writeFileSync(caFile, 'test-ca');
        try {
            setRequiredDocdbEnv(caFile);
            const config = loadConfig();
            expect(config.document_db_tls).toBe(true);
            expect(config.document_db_connection_string).toContain('tls=true');
        } finally {
            fs.unlinkSync(caFile);
        }
    });

    test('DOCDB_TLS TRUE and False are parsed case-insensitively', () => {
        const caFile = path.join(os.tmpdir(), `authn-docdb-ca-case-${Date.now()}.pem`);
        fs.writeFileSync(caFile, 'test-ca');
        try {
            setRequiredDocdbEnv(caFile);
            process.env.DOCDB_TLS = 'TRUE';
            expect(loadConfig().document_db_tls).toBe(true);

            process.env.DOCDB_TLS = 'False';
            expect(loadConfig().document_db_tls).toBe(false);
        } finally {
            fs.unlinkSync(caFile);
        }
    });

    test('invalid DOCDB_TLS throws at load', () => {
        process.env.DOCDB_TLS = 'treu';
        expect(() => loadConfig()).toThrow(/DOCDB_TLS must be true or false/);
    });
});
