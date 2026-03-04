const {DIRECTION, SORT} = require("../constants/monogodb-constants");
module.exports = {
    getSortDirection(direction) {
        if (direction && direction.toLowerCase() === SORT.ASC) return DIRECTION.ASC;
        return DIRECTION.DESC;
    }
}