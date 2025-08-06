const {LOGIN, LOGOUT, PROFILE_UPDATE, CREATE_ACCESS_TOKEN, CREATE_APPLICATION, UPDATE_APPLICATION_STATE, CREATE_BATCH,
    UPDATE_BATCH, REGISTRATION, SUBMISSION_ACTION, REACTIVATE_USER, DELETE_DATA, EDIT_SUBMISSION_NAME
} = require("../constants/event-constants");

const {v4} = require("uuid");
const {NOT_APPLICABLE} = require("../constants/user-constants");
const {getCurrentTime} = require("../utility/time-utility");
class AbstractLog {
    constructor() {
        this._id= v4();
        this.localtime = getCurrentTime();
        this.timestamp = this.localtime.getTime();
    }

    setUser(id, email, idp) {
        this.userID = id;
        this.userEmail = email;
        if (idp) {
            this.userIDP = idp;
        }
    }

    setUserName(userName) {
        this.userName = userName;
    }

    setEventType(eventType) {
        this.eventType = eventType;
    }
}

const LoginEvent = class extends AbstractLog {
    constructor(userEmail, userIDP) {
        super();
        this.setUser(NOT_APPLICABLE, userEmail, userIDP);
        this.setEventType(LOGIN);
    }
    static create(userEmail, userIDP) {
        return new LoginEvent(userEmail, userIDP);
    }
}

const UpdateSubmissionNameEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP, submissionID, prevName, newName) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(EDIT_SUBMISSION_NAME);
        this.submissionID = submissionID;
        this.prevName = prevName;
        this.newName = newName;
    }
    static create(userID, userEmail, userIDP, submissionID, prevName, newName) {
        return new UpdateSubmissionNameEvent(userID, userEmail, userIDP, submissionID, prevName, newName);
    }
}


const LogoutEvent = class extends AbstractLog {
    constructor(userEmail, userIDP) {
        super();
        this.setUser(NOT_APPLICABLE, userEmail, userIDP);
        this.setEventType(LOGOUT);
    }
    static create(userEmail, userIDP) {
        return new LogoutEvent(userEmail, userIDP);
    }
}

const RegistrationEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(REGISTRATION);
    }
    static create(userID, userEmail, userIDP) {
        return new RegistrationEvent(userID, userEmail, userIDP);
    }
}

const UpdateProfileEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP,prevProfile, newProfile) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(PROFILE_UPDATE);
        this.prevProfile = prevProfile;
        this.newProfile = newProfile;
    }
    static create(userID, userEmail, userIDP,prevProfile, newProfile) {
        return new UpdateProfileEvent(userID, userEmail, userIDP,prevProfile, newProfile);
    }
}

const ReactivateUserEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(REACTIVATE_USER);
    }

    static create(userID, userEmail, userIDP) {
        return new ReactivateUserEvent(userID, userEmail, userIDP);
    }
}

const CreateTokenEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(CREATE_ACCESS_TOKEN);
    }
    static create(userID, userEmail, userIDP) {
        return new CreateTokenEvent(userID, userEmail, userIDP);
    }
}

const CreateApplicationEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP, applicationID) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(CREATE_APPLICATION);
        this.applicationID = applicationID;
    }
    static create(userID, userEmail, userIDP, applicationID) {
        return new CreateApplicationEvent(userID, userEmail, userIDP, applicationID);
    }
}

const UpdateApplicationStateEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP, applicationID, prevState, newState) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(UPDATE_APPLICATION_STATE);
        this.applicationID = applicationID;
        this.prevState = prevState;
        this.newState = newState;
    }
    static create(userID, userEmail, userIDP, applicationID, prevState, newState) {
        return new UpdateApplicationStateEvent(userID, userEmail, userIDP, applicationID, prevState, newState);
    }
    static createByApp(applicationID, prevState, newState) {
        return new UpdateApplicationStateEvent(NOT_APPLICABLE, NOT_APPLICABLE, NOT_APPLICABLE, applicationID, prevState, newState);
    }
}

const CreateBatchEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(CREATE_BATCH);
    }
    static create(userID, userEmail, userIDP) {
        return new CreateBatchEvent(userID, userEmail, userIDP);
    }
}

const UpdateBatchEvent = class extends AbstractLog {
    constructor(userID, userEmail, userIDP) {
        super();
        this.setUser(userID, userEmail, userIDP);
        this.setEventType(UPDATE_BATCH);
    }
    static create(userID, userEmail, userIDP, prevState, newState) {
        return new UpdateBatchEvent(userID, userEmail, userIDP, prevState, newState);
    }
}

const SubmissionActionEvent = class extends AbstractLog {
    constructor(userID, userEmail, submissionID, action, prevStatus, newStatus) {
        super();
        this.setUser(userID, userEmail);
        this.setEventType(SUBMISSION_ACTION);
        this.submissionID = submissionID;
        this.action = action
        this.prevState = prevStatus;
        this.newState = newStatus;
    }
    static create(userID, userEmail, userIDP, submissionID, action, prevStatus, newStatus) {
        return new SubmissionActionEvent(userID, userEmail, userIDP, submissionID, action, prevStatus, newStatus);
    }
}

const DeleteRecordEvent = class extends AbstractLog {
    constructor(userID, userEmail, userName, submissionID, nodeType, nodeIDs) {
        super();
        this.setUser(userID, userEmail);
        this.setUserName(userName);
        this.setEventType(DELETE_DATA);
        this.eventDetail = {
            submissionID: submissionID,
            nodeType: nodeType,
            nodeIDs: nodeIDs
        }
    }
    static create(userID, userEmail, userName, submissionID, nodeType, nodeIDs) {
        return new DeleteRecordEvent(userID, userEmail, userName, submissionID, nodeType, nodeIDs);
    }
}

module.exports = {
    LoginEvent,
    LogoutEvent,
    RegistrationEvent,
    UpdateProfileEvent,
    CreateTokenEvent,
    CreateApplicationEvent,
    UpdateApplicationStateEvent,
    CreateBatchEvent,
    UpdateBatchEvent,
    SubmissionActionEvent,
    ReactivateUserEvent,
    DeleteRecordEvent,
    UpdateSubmissionNameEvent
}