const fs = require('fs');
const os = require('os');
const path = require('path');

const DOCDB_ENV_KEYS = [
    'DOCDB_TLS',
    'DOCDB_CA_FILE',
    'docdb_endpoint',
    'docdb_port',
    'docdb_username',
    'docdb_password',
    'docdb_db_name',
];

/**
 * @returns {object}
 */
function loadConfig() {
    jest.resetModules();
    return require('../config');
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
        const config = loadConfig();
        process.env.docdb_endpoint = 'example.host';
        process.env.docdb_username = 'user@name';
        process.env.docdb_password = 'p@ss:word';
        process.env.docdb_db_name = 'my-db';

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
            process.env.DOCDB_CA_FILE = caFile;
            const config = loadConfig();
            process.env.docdb_endpoint = 'docdb.example';
            process.env.docdb_username = 'user';
            process.env.docdb_password = 'secret';
            process.env.docdb_db_name = 'crdc-datahub';
            process.env.docdb_port = '27017';

            const uri = config.document_db_connection_string;
            expect(uri).toContain('tls=true');
            expect(uri).toContain(`tlsCAFile=${encodeURIComponent(caFile)}`);
            expect(uri).toContain('authMechanism=SCRAM-SHA-1');
            expect(uri).toContain('retryWrites=false');
        } finally {
            fs.unlinkSync(caFile);
        }
    });

    test('TLS on without CA file throws', () => {
        process.env.DOCDB_TLS = 'true';
        process.env.DOCDB_CA_FILE = path.join(os.tmpdir(), 'authn-docdb-ca-missing.pem');
        const config = loadConfig();
        process.env.docdb_endpoint = 'docdb.example';
        process.env.docdb_username = 'user';
        process.env.docdb_password = 'secret';
        process.env.docdb_db_name = 'crdc-datahub';

        expect(() => config.document_db_connection_string).toThrow(/CA file was not found/);
    });

    test('missing required docdb_* variables throw listing the names', () => {
        process.env.DOCDB_TLS = 'false';
        const config = loadConfig();
        expect(() => config.document_db_connection_string).toThrow(
            'DocumentDB connection is missing required environment variables: docdb_endpoint, docdb_username, docdb_password, docdb_db_name'
        );
    });
});
