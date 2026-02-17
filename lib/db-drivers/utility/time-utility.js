const subtractDaysFromNow = (days) => {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - days);
    return currentDate;
};

const subtractDaysFromNowTimestamp = (days) => {
    return subtractDaysFromNow(days).getTime();
}

module.exports = {
    getCurrentTime() {
        return new Date();
    },
    subtractDaysFromNow,
    subtractDaysFromNowTimestamp
}