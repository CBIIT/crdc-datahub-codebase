const {v4} = require("uuid");
const DATABASE_ERROR = new Error("Database operation failed, please see logs for more information");
class MongoDBCollection {

    constructor(client, databaseName, collectionName) {
        this.collection = client.db(databaseName).collection(collectionName);
    }

    async find(id){
        try{
            return await this.collection.find({_id: id}).toArray();
        }
        catch (e){
            logAndThrow("An exception occurred during a find operation", e);
        }
    }

    async findOne(id){
        try{
            return await this.collection.findOne({_id: id});
        }
        catch (e){
            logAndThrow("An exception occurred during a find operation", e);
        }
    }

    // Returns all documents in the collection
    async findAll() {
        try{
            return await this.collection.find().toArray();
        }
        catch (e){
            logAndThrow("An exception occurred during a findAll operation", e);
        }
    }

    async countDoc(query){
        try{
            return await this.collection.countDocuments(query);
        }
        catch (e){
            logAndThrow("An exception occurred during count documents", e);
        }
    }

    async aggregate(pipeline){
        try{
            return await this.collection.aggregate(pipeline).toArray()
        }
        catch (e){
            logAndThrow("An exception occurred during an aggregate operation", e);
        }
    }

    async insert(application){
        try{
            return await this.collection.insertOne(application);
        }
        catch (e){
            logAndThrow("An exception occurred during an insert operation", e);
        }
    }

    async insertMany(inputs){
        try{
            let bulkOperation = this.collection.initializeOrderedBulkOp()
            inputs.filter((x) => {
                bulkOperation.insert(x);
            });
            return await bulkOperation.execute();
        }
        catch (e){
            logAndThrow("An exception occurred during an insert operation", e);
        }
    }


    async findOneAndUpdate(query, doc, option) {
        const updateDoc = {
            $set: doc,
            $setOnInsert: { _id: v4() }
        };
        try{
            return await this.collection.findOneAndUpdate(query, updateDoc, option ? option : { upsert: true});
        }
        catch (e){
            logAndThrow("An exception occurred during an findOne and update operation", e);
        }
    }

    async update(application, option) {
        const filter = {
            _id: application._id
        };
        const updateDoc = {
            $set: application,
            ...option
        };
        try{
            return await this.collection.updateOne(filter, updateDoc);
        }
        catch (e){
            logAndThrow("An exception occurred during an update one operation", e);
        }
    }

    async updateMany(query, document, option) {
        const updateDoc = Array.isArray(document)
            ? document
            : { $set: document, ...option };

        try{
            return await this.collection.updateMany(query, updateDoc);
        }
        catch (e){
            logAndThrow("An exception occurred during an updateMany operation", e);
        }
    }
    async updateOne(query, document, option) {
        const updateDoc = {
            $set: document,
            ...option
        };
        try{
            return await this.collection.updateOne(query, updateDoc);
        }
        catch (e){
            logAndThrow("An exception occurred during an updateMany operation", e);
        }
    }
    async deleteOneById(id) {
        return await this.deleteOne({_id: id});
    }

    async deleteOne(query) {
        try{
            return await this.collection.deleteOne(query);
        }
        catch (e){
            logAndThrow("An exception occurred during a delete operation", e);
        }
    }

    async deleteMany(query) {
        try{
            return await this.collection.deleteMany(query);
        }
        catch (e){
            logAndThrow("An exception occurred during a delete operation", e);
        }
    }

    /**
     * Finds the distinct values for a specified field across a single collection.
     * Applies the specified filter to a collection then returns the distinct values of the specified field in the filter results as an array.
     * @param field A string value for which the distinct values are returned.
     * @param filter An object containing the filter to apply to the collection before retrieving the distinct values. Example: {color: "green", shape: "square"}
     * @returns {Promise<*>} A promise that will return an array of distinct values when resolved
     */
    async distinct(field, filter){
        try{
            return await this.collection.distinct(field, filter);
        }
        catch (e){
            logAndThrow("An exception occurred during a distinct operation", e);
        }
    }

    /**
     * Performs a bulk write operation.
     * Allows multiple update operations in a single request, improving efficiency.
     *
     * @param {Array} operations - An array of bulk write operations, such as updateOne or updateMany.
     * @returns {Promise<Object>} A promise that resolves to the result of the bulk write operation,
     *
     * @example
     * const operations = [
     *   { updateOne: { filter: { _id: 1 }, update: { $set: { name: "CRDC", status: "Active" } } } }
     * ];
     */
    async bulkWrite(operations){
        try {
            return await this.collection.bulkWrite(operations);
        } catch (e){
            logAndThrow("An exception occurred during a distinct operation", e);
        }
    }
}

function logAndThrow(message, error){
    console.error(message)
    console.error(error)
    throw DATABASE_ERROR;
}

module.exports = {
    MongoDBCollection
}
