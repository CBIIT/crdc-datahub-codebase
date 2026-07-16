/**
 * Mongoose-backed GenericDAO. Mirrors the Prisma GenericDAO method surface so DAOs
 * can migrate by swapping the parent class and passing a Mongoose model.
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
     * @param {object} where Mongo filter
     * @param {object} [option] Query options (sort, skip, limit/take)
     * @returns {Promise<object|null>}
     */
    async findFirst(where, option = {}) {
        try {
            let query = this.model.findOne(where);
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
     * @param {object} filter Mongo filter
     * @param {object} [option] Query options (sort, skip, limit/take)
     * @returns {Promise<object[]>}
     */
    async findMany(filter, option = {}) {
        try {
            let query = this.model.find(filter || {});
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
     * @param {object} condition Mongo filter
     * @param {object} data Fields to update
     * @returns {Promise<{count: number}>}
     */
    async updateMany(condition, data) {
        try {
            const result = await this.model.updateMany(condition, { $set: data });
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
     * @param {object} where Mongo filter
     * @returns {Promise<{count: number}>}
     */
    async deleteMany(where) {
        try {
            const result = await this.model.deleteMany(where);
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
     * @param {object} where Mongo filter
     * @returns {Promise<number>}
     */
    async count(where) {
        try {
            return await this.model.countDocuments(where || {});
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
     * Distinct values for a field.
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
