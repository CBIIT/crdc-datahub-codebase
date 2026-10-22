const dotenv = require('dotenv')
const fs = require('fs');
const path = require('path');
const {isCaseInsensitiveEqual} = require("./util/string-util");
const {NIH} = require("./constants/idp-constants");
dotenv.config();

if (process.env.DOCDB_DB_NAME) {
  process.env.DATABASE_NAME = process.env.DOCDB_DB_NAME;
}

const DEFAULT_DOCUMENT_DB_CA_FILE = path.join(__dirname, 'resources/aws-documentdb-certificate/global-bundle.pem');
const rawDocumentDbTls = process.env.DOCDB_TLS;
const trimmedDocumentDbTls = rawDocumentDbTls == null ? '' : String(rawDocumentDbTls).trim();
let documentDbTlsEnabled;
if (!trimmedDocumentDbTls) {
  documentDbTlsEnabled = true;
} else {
  const normalizedTls = trimmedDocumentDbTls.toLowerCase();
  if (normalizedTls === 'true') {
    documentDbTlsEnabled = true;
  } else if (normalizedTls === 'false') {
    documentDbTlsEnabled = false;
  } else {
    throw new Error(`DOCDB_TLS must be true or false, received: ${rawDocumentDbTls}`);
  }
}
const documentDbCaFile = documentDbTlsEnabled
    ? (process.env.DOCDB_CA_FILE || DEFAULT_DOCUMENT_DB_CA_FILE)
    : null;

/**
 * Builds a MongoDB-compatible connection URI for DocumentDB.
 * Encodes user, password, and database for reserved URI characters.
 * When caFile is set, enables TLS and SCRAM-SHA-1. Always disables retryWrites.
 * @param {string} user
 * @param {string} password
 * @param {string} host
 * @param {string} port
 * @param {string} database
 * @param {string} [caFile]
 * @returns {string}
 */
function buildConnectionString(user, password, host, port, database, caFile) {
  const params = new URLSearchParams({
    authSource: 'admin',
    retryWrites: 'false',
  });
  if (caFile) {
    params.set('tls', 'true');
    params.set('tlsCAFile', caFile);
    params.set('authMechanism', 'SCRAM-SHA-1');
  }
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?${params.toString()}`;
}

/**
 * Builds the DocumentDB connection URI from DOCDB_* environment variables.
 * Port defaults to 27017 when DOCDB_PORT is unset. TLS is on when DOCDB_TLS
 * is unset, whitespace-only, or true; false disables TLS. Other DOCDB_TLS
 * values throw at module load. CA defaults to
 * resources/aws-documentdb-certificate/global-bundle.pem when DOCDB_CA_FILE
 * is unset. Throws at module load if required env vars are missing or if TLS
 * is on and the CA file is missing.
 * @returns {string}
 * @throws {Error} When required DOCDB_* environment variables are missing
 * @throws {Error} When TLS is enabled and the CA file does not exist
 */
function buildDocumentDbConnectionString() {
  const required = {
    DOCDB_ENDPOINT: process.env.DOCDB_ENDPOINT,
    DOCDB_USERNAME: process.env.DOCDB_USERNAME,
    DOCDB_PASSWORD: process.env.DOCDB_PASSWORD,
    DOCDB_DB_NAME: process.env.DOCDB_DB_NAME,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value || !String(value).trim())
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(`DocumentDB connection is missing required environment variables: ${missing.join(', ')}`);
  }
  if (documentDbTlsEnabled && !fs.existsSync(documentDbCaFile)) {
    throw new Error(`DocumentDB TLS is enabled but CA file was not found: ${documentDbCaFile}`);
  }
  return buildConnectionString(
    process.env.DOCDB_USERNAME,
    process.env.DOCDB_PASSWORD,
    process.env.DOCDB_ENDPOINT,
    process.env.DOCDB_PORT || '27017',
    process.env.DOCDB_DB_NAME,
    documentDbCaFile,
  );
}

const config = {
  version: process.env.VERSION,
  date: process.env.DATE,
  idp: process.env.IDP ? process.env.IDP.toLowerCase() : NIH,
  session_secret: process.env.SESSION_SECRET,
  session_timeout: process.env.SESSION_TIMEOUT ? parseInt(process.env.SESSION_TIMEOUT) * 1000 : 1000 * 30 * 60,  // 30 minutes
  document_db_tls: documentDbTlsEnabled,
  document_db_ca_file: documentDbCaFile,
  document_db_connection_string: buildDocumentDbConnectionString(),
  // NIH login settings
  nih: {
    CLIENT_ID: process.env.NIH_CLIENT_ID,
    CLIENT_SECRET: process.env.NIH_CLIENT_SECRET,
    BASE_URL: process.env.NIH_BASE_URL,
    REDIRECT_URL: process.env.NIH_REDIRECT_URL,
    USERINFO_URL: process.env.NIH_USERINFO_URL,
    AUTHORIZE_URL: process.env.NIH_AUTHORIZE_URL,
    TOKEN_URL: process.env.NIH_TOKEN_URL,
    LOGOUT_URL: process.env.NIH_LOGOUT_URL,
    SCOPE: process.env.NIH_SCOPE,
    PROMPT: process.env.NIH_PROMPT
  },
  // Disable local test page automatically sends /login request, so Postman can use the auth code
  noAutoLogin: process.env.NO_AUTO_LOGIN ? process.env.NO_AUTO_LOGIN.toLowerCase() === "true" : false,

  getIdpOrDefault: (idp) => {
    return (idp) ? idp : config.idp;
  },
  getUrlOrDefault: (idp, url) => {
    if (!url && isCaseInsensitiveEqual(idp,'NIH')) return process.env.NIH_REDIRECT_URL;
    return url;
  }
};

if (!config.version) {
  config.version = 'Version not set'
}

if (!config.date) {
  config.date = new Date();
}

module.exports = config;
