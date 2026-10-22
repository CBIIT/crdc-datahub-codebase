const MongoClient = require('mongodb').MongoClient;

class DatabaseConnector {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.client = null;
    }

    /**
     * Opens the DocumentDB connection.
     * @returns {Promise<MongoClient>} The connected client
     * @throws {Error} When the connection cannot be established
     */
    async connect() {
        try {
            this.client = new MongoClient(this.connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
            await this.client.connect();
            console.log('Connected to DocumentDB');
        } catch (err) {
            console.error('Error connecting to DocumentDB:', err);
            this.client = null;
            throw err;
        }
        return this.client;
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
                console.log('Disconnected from DocumentDB');
            }
        } catch (err) {
            console.error('Error disconnecting from DocumentDB:', err);
        }
    }
}

module.exports = {
    DatabaseConnector
};