const {getCurrentTime} = require("../crdc-datahub-database-drivers/utility/time-utility");

/**
 * Builds immutable history-event objects used for application/submission state timelines.
 */
class HistoryEventBuilder {
    /**
     * HistoryEventBuilder constructor.
     * 
     * @param {string|null|undefined} userID User responsible for the state transition.
     * @param {string|null|undefined} status State value to record on the event.
     * @param {string|null|undefined} comment Optional review comment.
     * @param {Date|undefined} dateTime Optional explicit event timestamp.
     */
    constructor(userID, status, comment, dateTime) {
        this._userID = userID;
        this._status = status;
        this._comment = comment;
        this._dateTime = dateTime;
    }

    /**
     * Convenience factory for building a history-event payload.
     *
     * @param {string|null|undefined} userID User responsible for the state transition.
     * @param {string|null|undefined} status State value to record on the event.
     * @param {string|null|undefined} comment Optional review comment.
     * @param {Date|undefined} dateTime Optional explicit event timestamp.
     * @returns {{status?: string, reviewComment?: string, userID?: string, dateTime: Date}}
     */
    static createEvent(userID, status, comment, dateTime = undefined) {
        return new HistoryEventBuilder(userID, status, comment, dateTime)
            .build();
    }

    /**
     * Creates the serialized history-event object.
     *
     * @returns {{status?: string, reviewComment?: string, userID?: string, dateTime: Date}}
     */
    build() {
        let event = {};
        if (this._status) event.status = this._status;
        if (this._comment) event.reviewComment = this._comment;
        if (this._userID != null) event.userID = this._userID;
        if (this._dateTime instanceof Date) {
            event.dateTime = this._dateTime
        } else {
            event.dateTime = getCurrentTime();
        }
        return event;
    }
}

module.exports = {
    HistoryEventBuilder
};