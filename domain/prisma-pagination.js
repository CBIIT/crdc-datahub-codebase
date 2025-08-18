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
            pagination.orderBy = this._buildOrderBy();
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
        return (this._orderBy) ? this._buildOrderBy() : {};
    }

    _buildOrderBy() {
        if (!this._orderBy) return {};
        
        // Handle nested sorting (e.g., "organization.name" -> { organization: { name: "ASC" } })
        if (this._orderBy.includes('.')) {
            const parts = this._orderBy.split('.');
            // Validate: no empty parts (consecutive, leading, or trailing dots)
            if (parts.some(part => part === "")) {
                throw new Error(`Invalid orderBy value: "${this._orderBy}". Dot notation cannot contain consecutive, leading, or trailing dots.`);
            }
            let orderByObj = {};
            let current = orderByObj;
            
            for (let i = 0; i < parts.length - 1; i++) {
                current[parts[i]] = {};
                current = current[parts[i]];
            }
            
            current[parts[parts.length - 1]] = this._getSortDirection();
            return orderByObj;
        }
        
        // Handle direct field sorting
        return { [this._orderBy]: this._getSortDirection() };
    }

    _getSortDirection() {
        const direction = this._sortDirection?.toLowerCase();
        return direction === SORT.ASC ? SORT.ASC : SORT.DESC;
    }
}

module.exports = {
    PrismaPagination
}