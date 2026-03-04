const {ERROR} = require("../constants/error-constants");
const parseJsonString = (jsonString) => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error(ERROR.JSON_PARSING, error);
        return null;
    }
};

const isTrue = (value) => {
    return String(value)?.toLowerCase() === 'true'
}

const includesAll = (arr, values) => values.every(v => arr.includes(v));

module.exports = {
    parseJsonString, 
    includesAll,
    isTrue
}