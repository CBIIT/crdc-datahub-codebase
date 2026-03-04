const {getSortDirection} = require("../utility/mongodb-utility");

class MongoPagination {
    constructor(first, offset, orderBy, sortDirection, isCaseInsensitive = false) {
        this.first = first;
        this.offset = offset;
        this.orderBy = orderBy;
        this.sortDirection = sortDirection;
        this.isCaseInsensitive = isCaseInsensitive;
    }

    getPaginationPipeline() {
        const pipeline = [];
        if (this.orderBy) {
            const orderBy = this.isCaseInsensitive ? `${this.orderBy}_lower` : this.orderBy;
            if (this.isCaseInsensitive) {
                pipeline.push({$addFields: {[orderBy]: { $toLower: `$${this.orderBy}` }}});
            }
            pipeline.push({"$sort": { [orderBy]: getSortDirection(this.sortDirection) } });
        }

        if (this.offset) {
            pipeline.push({"$skip": this.offset});
        }

        if (!(Number.isInteger(this?.first) && this?.first === -1)) {
            pipeline.push({"$limit": this?.first});
        }

        return pipeline;
    }

    getNoLimitPipeline() {
        return (this.orderBy) ? [{"$sort": { [this.orderBy]: getSortDirection(this.sortDirection) } }] : [];
    }

}

module.exports = {
    MongoPagination
}