const {DatabaseConnector} = require("./database-connector");
class MongoQueries {
    constructor(connectionString, database) {
        this.connectionString = connectionString;
        this.database = database
    }
    async execute(operator) {
        const connector = new DatabaseConnector(this.connectionString);
        const client = await connector.connect();
        const db = client.db(this.database);
        let result = [];
        try {
            result = await operator(db);
        } catch (err) {
            console.error('Error running Mongo query', err);
        }
        await connector.disconnect();
        return result;
    }

    async find(collection, query) {
        const operator = async (db)=> {
            const database = db.collection(collection);
            return await database.find(query).toArray();
        }
        return await this.execute(operator);
    }

    async insertOne(collection, document) {
        const operator = async (db)=> {
            const database = db.collection(collection);
            return await database.insertOne(document);
        }
        return await this.execute(operator);
    }

    async updateOne(collection, query, document) {
        const operator = async (db)=> {
            const database = db.collection(collection);
            return await database.updateOne(query, document);
        }
        return await this.execute(operator);
    }

    async updateMany(collection, query, document) {
        const operator = async (db)=> {
            const database = db.collection(collection);
            return await database.updateMany(query, document);
        }
        return await this.execute(operator);
    }

    async deleteOne(collection, document) {
        const operator = async (db)=> {
            const database = db.collection(collection);
            return await database.deleteOne(document);
        }
        return await this.execute(operator);
    }

    async deleteMany(collection, document) {
        const operator = async (db)=> {
            const database = db.collection(collection);
            return await database.deleteMany(document);
        }
        return await this.execute(operator);
    }
}

module.exports = {
    MongoQueries
};