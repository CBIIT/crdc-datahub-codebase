/**
 * Mongoose-backed GenericDAO
 */
class MongooseGenericDAO {
    /**
     * @param {import('mongoose').Model} model Mongoose model
     */
    constructor(model) {
        this.model = model;
    }

    /**
     * @returns {string}
     */
    get _modelName() {
        return this.model?.modelName || 'Model';
    }

    /**
     * Normalize a Mongoose document or lean object to include both id and _id.
     * @param {object|null} doc
     * @returns {object|null}
     */
    _mapDoc(doc) {
        if (!doc) {
            return null;
        }
        const plain = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
        const id = plain._id ?? plain.id;
        if (id === undefined || id === null) {
            return plain;
        }
        return { ...plain, id, _id: id };
    }

    /**
     * @param {import('mongoose').Query} query
     * @param {object} [option]
     * @returns {import('mongoose').Query}
     */
    _applyQueryOptions(query, option = {}) {
        if (option.sort) {
            query = query.sort(option.sort);
        }
        if (option.skip !== undefined) {
            query = query.skip(option.skip);
        }
        const limit = option.limit ?? option.take;
        if (limit !== undefined) {
            query = query.limit(limit);
        }
        return query;
    }

    /**
     * Requires an explicit filter object. Null/undefined are rejected so callers
     * cannot accidentally match or delete all documents (Mongoose 9 throws on null filters).
     * Explicit `{}` remains allowed when matching all documents is intentional.
     * @param {object} filter Mongo filter
     * @param {string} methodName Calling method name for the error message
     * @returns {object}
     * @throws {Error} When filter is null or undefined
     */
    _requireFilter(filter, methodName) {
        if (filter == null) {
            throw new Error(
                `MongooseGenericDAO.${methodName} requires a filter object for ${this._modelName}`
            );
        }
        return filter;
    }

    /**
     * Create a single document
     * @param {object} data Document fields to create
     * @returns {Promise<object>}
     */
    async create(data) {
        try {
            const res = await this.model.create(data);
            return this._mapDoc(res);
        } catch (error) {
            console.error(`MongooseGenericDAO.create failed for ${this._modelName}:`, {
                error: error.message,
                dataType: typeof data,
                dataKeys: data && typeof data === 'object' ? Object.keys(data) : null,
                dataLength: Array.isArray(data) ? data.length : null,
                stack: error.stack
            });
            throw new Error(`Failed to create ${this._modelName}`);
        }
    }

    /**
     * Create multiple documents
     * @param {object[]} data Documents to insert
     * @returns {Promise<{count: number}>}
     */
    async createMany(data) {
        try {
            const docs = await this.model.insertMany(data);
            return { count: docs.length };
        } catch (error) {
            console.error(`MongooseGenericDAO.createMany failed for ${this._modelName}:`, {
                error: error.message,
                dataCount: Array.isArray(data) ? data.length : 0,
                dataType: typeof data,
                stack: error.stack
            });
            throw new Error(`Failed to create many ${this._modelName}`);
        }
    }

    /**
     * Find a single document by ID
     * @param {string} id Document ID
     * @returns {Promise<object|null>}
     */
    async findById(id) {
        try {
            const result = await this.model.findById(id).lean();
            return this._mapDoc(result);
        } catch (error) {
            console.error(`MongooseGenericDAO.findById failed for ${this._modelName}:`, {
                error: error.message,
                id,
                stack: error.stack
            });
            throw new Error(`Failed to find ${this._modelName} by ID`);
        }
    }

    /**
     * Find all documents
     * @returns {Promise<object[]>}
     */
    async findAll() {
        try {
            const result = await this.model.find({}).lean();
            return result.map((item) => this._mapDoc(item));
        } catch (error) {
            console.error(`MongooseGenericDAO.findAll failed for ${this._modelName}:`, {
                error: error.message,
                stack: error.stack
            });
            throw new Error(`Failed to find all ${this._modelName}`);
        }
    }

    /**
     * Find the first document matching the filter.
     * Requires an explicit filter object; null/undefined are rejected.
     * Pass `{}` to match any document intentionally.
     * @param {object} where Mongo filter
     * @param {object} [option] Query options (sort, skip, limit/take)
     * @returns {Promise<object|null>}
     */
    async findFirst(where, option = {}) {
        const filter = this._requireFilter(where, 'findFirst');
        try {
            let query = this.model.findOne(filter);
            query = this._applyQueryOptions(query, option);
            const result = await query.lean();
            return this._mapDoc(result);
        } catch (error) {
            console.error(`MongooseGenericDAO.findFirst failed for ${this._modelName}:`, {
                error: error.message,
                where: JSON.stringify(where),
                options: JSON.stringify(option),
                stack: error.stack
            });
            throw new Error(`Failed to find first ${this._modelName}`);
        }
    }

    /**
     * Find multiple documents matching the filter.
     * Requires an explicit filter object; null/undefined are rejected.
     * Pass `{}` to match all documents intentionally.
     * @param {object} filter Mongo filter
     * @param {object} [option] Query options (sort, skip, limit/take)
     * @returns {Promise<object[]>}
     */
    async findMany(filter, option = {}) {
        const where = this._requireFilter(filter, 'findMany');
        try {
            let query = this.model.find(where);
            query = this._applyQueryOptions(query, option);
            const result = await query.lean();
            return result.map((item) => this._mapDoc(item));
        } catch (error) {
            console.error(`MongooseGenericDAO.findMany failed for ${this._modelName}:`, {
                error: error.message,
                filter: JSON.stringify(filter),
                options: JSON.stringify(option),
                stack: error.stack
            });
            throw new Error(`Failed to find many ${this._modelName}`);
        }
    }

    /**
     * Update a single document by ID
     * @param {string} id Document ID
     * @param {object} data Fields to update
     * @returns {Promise<object>}
     */
    async update(id, data) {
        try {
            if (!id) {
                id = data._id || data.id;
            }
            const { _id, id: dataId, ...updateData } = data;
            const res = await this.model.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
            if (!res) {
                throw new Error(`Document not found`);
            }
            return this._mapDoc(res);
        } catch (error) {
            console.error(`MongooseGenericDAO.update failed for ${this._modelName}:`, {
                error: error.message,
                id,
                updateDataKeys: data && typeof data === 'object' ? Object.keys(data) : null,
                stack: error.stack
            });
            throw new Error(`Failed to update ${this._modelName}`);
        }
    }

    /**
     * Update multiple documents matching the condition.
     * Requires an explicit filter object; null/undefined are rejected to avoid
     * accidentally updating all documents. Pass `{}` only when update-all is intentional.
     * @param {object} condition Mongo filter
     * @param {object} data Fields to update
     * @returns {Promise<{count: number}>}
     * @throws {Error} When condition is null or undefined
     */
    async updateMany(condition, data) {
        const filter = this._requireFilter(condition, 'updateMany');
        try {
            const result = await this.model.updateMany(filter, { $set: data });
            return { count: result.modifiedCount };
        } catch (error) {
            console.error(`MongooseGenericDAO.updateMany failed for ${this._modelName}:`, {
                error: error.message,
                conditionKeys: condition && typeof condition === 'object' ? Object.keys(condition) : null,
                dataKeys: data && typeof data === 'object' ? Object.keys(data) : null,
                stack: error.stack
            });
            throw new Error(`Failed to update many ${this._modelName}`);
        }
    }

    /**
     * Delete multiple documents matching the condition.
     * Requires an explicit filter object; null/undefined are rejected to avoid
     * accidentally deleting all documents. Pass `{}` only when delete-all is intentional.
     * @param {object} where Mongo filter
     * @returns {Promise<{count: number}>}
     */
    async deleteMany(where) {
        const filter = this._requireFilter(where, 'deleteMany');
        try {
            const result = await this.model.deleteMany(filter);
            return { count: result.deletedCount };
        } catch (error) {
            console.error(`MongooseGenericDAO.deleteMany failed for ${this._modelName}:`, {
                error: error.message,
                where: JSON.stringify(where),
                stack: error.stack
            });
            throw new Error(`Failed to delete many ${this._modelName}`);
        }
    }

    /**
     * Delete a single document by ID
     * @param {string} id Document ID
     * @returns {Promise<object>}
     */
    async delete(id) {
        try {
            const result = await this.model.findByIdAndDelete(id).lean();
            if (!result) {
                throw new Error(`Document not found`);
            }
            return this._mapDoc(result);
        } catch (error) {
            console.error(`MongooseGenericDAO.delete failed for ${this._modelName}:`, {
                error: error.message,
                id,
                stack: error.stack
            });
            throw new Error(`Failed to delete ${this._modelName}`);
        }
    }

    /**
     * Counts documents matching the filter.
     * Requires an explicit filter object; null/undefined are rejected.
     * Pass `{}` to count all documents intentionally.
     * @param {object} where Mongo filter
     * @returns {Promise<number>}
     */
    async count(where) {
        const filter = this._requireFilter(where, 'count');
        try {
            return await this.model.countDocuments(filter);
        } catch (error) {
            console.error(`MongooseGenericDAO.count failed for ${this._modelName}:`, {
                error: error.message,
                where: JSON.stringify(where),
                stack: error.stack
            });
            throw new Error(`Failed to count ${this._modelName}`);
        }
    }

    /**
     * Finds distinct values for a given field.
     * @param {string} field Field name
     * @param {object} [filter] Mongo filter
     * @returns {Promise<Array>}
     */
    async distinct(field, filter = {}) {
        try {
            return await this.model.distinct(field, filter);
        } catch (error) {
            console.error(`MongooseGenericDAO.distinct failed for ${this._modelName}:`, {
                error: error.message,
                field,
                filter: JSON.stringify(filter),
                stack: error.stack
            });
            throw new Error(`Failed to get distinct ${this._modelName}`);
        }
    }

    /**
     * Runs an aggregation pipeline.
     * @param {object[]} pipeline Aggregation stages
     * @returns {Promise<object[]>}
     */
    async aggregate(pipeline) {
        try {
            const results = await this.model.aggregate(pipeline);
            return results.map((item) => this._mapDoc(item));
        } catch (error) {
            console.error(`MongooseGenericDAO.aggregate failed for ${this._modelName}:`, {
                error: error.message,
                pipeline: JSON.stringify(pipeline),
                stack: error.stack
            });
            throw new Error(`Failed to aggregate ${this._modelName}`);
        }
    }
}

module.exports = MongooseGenericDAO;
