const ERROR = require("../constants/error-constants");

function verifySubmissionRequest(submissionRequestArray) {
    return new SubmissionRequestVerifier(submissionRequestArray);
}

class SubmissionRequestVerifier {
    constructor(submissionRequestArray) {
        if (submissionRequestArray && !Array.isArray(submissionRequestArray)){
            submissionRequestArray = [submissionRequestArray];
        }
        this.submissionRequestArray = submissionRequestArray;
    }

    isUndefined() {
        if (!Array.isArray(this.submissionRequestArray)) throw new Error(ERROR.VERIFY.UNDEFINED_SUBMISSION_REQUEST);
        return this;
    }

    notEmpty() {
        if (!this.submissionRequestArray||!this.submissionRequestArray?.length) throw new Error(ERROR.VERIFY.EMPTY_SUBMISSION_REQUEST);
        return this;
    }

    state(state) {
        if (!Array.isArray(state)){
            state = [state];
        }
        if (!this.submissionRequestArray[0].status) throw new Error(ERROR.VERIFY.UNDEFINED_STATUS_SUBMISSION_REQUEST);
        if (!state.includes(this.submissionRequestArray[0].status)) throw Error(ERROR.VERIFY.INVALID_STATE_SUBMISSION_REQUEST);
        return this;
    }
}

module.exports = {
    verifySubmissionRequest
}
