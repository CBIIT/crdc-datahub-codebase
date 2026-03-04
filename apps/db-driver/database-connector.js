const MongoClient = require('mongodb').MongoClient;

class DatabaseConnector {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.client = null;
    }

    async connect() {
        try {
            this.client = new MongoClient(this.connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
            await this.client.connect();
            console.log('Connected to MongoDB');
        } catch (err) {
            console.error('Error connecting to MongoDB:', err);
        }
        return this.client;
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
                console.log('Disconnected from MongoDB');
            }
        } catch (err) {
            console.error('Error disconnecting from MongoDB:', err);
        }
    }
}

module.exports = {
    DatabaseConnector
};