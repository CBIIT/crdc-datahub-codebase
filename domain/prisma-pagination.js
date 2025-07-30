const {SORT} = require("../../constants/db-constants");

class PrismaPagination {
    constructor(first, offset, orderBy, sortDirection) {
        this._first = first;
        this._offset = offset;
        this._orderBy = orderBy;
        this._sortDirection = sortDirection || SORT.DESC;
    }

    getPagination() {
        let pagination = {};
        if (this._orderBy) {
            pagination.orderBy = {[this._orderBy]: this._getSortDirection()};
        }

        if (this._offset) {
            pagination.skip = this._offset;
        }

        if (!(Number.isInteger(this?._first) && this?._first === -1)) {
            pagination.take = this._first;
        }

        return pagination;
    }

    getNoLimit() {
        return (this._orderBy) ? { [this._orderBy]: this._getSortDirection() } : {};
    }

    _getSortDirection() {
        return this._sortDirection?.toLowerCase() === SORT.DESC ? SORT.DESC : SORT.ASC;
    }
}

module.exports = {
    PrismaPagination
}