const {getCurrentTime} = require("../utility/time-utility");
const {isTrue} = require("../utility/string-utility");


class ApprovedStudies {
    constructor(applicationID, studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, programName, useProgramPC, pendingModelChange, primaryContactID, pendingGPA) {
        this.studyName = studyName;
        this.studyAbbreviation = studyAbbreviation;
        if (dbGaPID) {
            this.dbGaPID = dbGaPID;
        }
        // Optional
        if (organizationName) {
            this.originalOrg = organizationName;
        }
        if (ORCID) {
            this.ORCID = ORCID;
        }

        this.controlledAccess = isTrue(controlledAccess);

        if (PI) {
            this.PI = PI;
        }

        this.openAccess = isTrue(openAccess);

        if (programName !== undefined) {
            this.programName = programName?.trim();
        }
        this.createdAt = this.updatedAt = getCurrentTime();
        this.useProgramPC = isTrue(useProgramPC);
        this.pendingModelChange = isTrue(pendingModelChange ?? true);

        // store application ID when the application is approved(setting PendingGPA) or model version change
        if (applicationID && (pendingGPA?.isPendingGPA || this.pendingModelChange === true)) {
            this.pendingApplicationID = applicationID
        }

        if (primaryContactID) {
            this.primaryContactID = primaryContactID;
        }

        if (pendingGPA?.isPendingGPA) {
            this.isPendingGPA = pendingGPA?.isPendingGPA
            this.GPAName = pendingGPA?.GPAName;
            this.GPAEmail = pendingGPA?.GPAEmail;
        }
    }

    static createApprovedStudies(applicationID, studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, programName, useProgramPC, pendingModelChange, primaryContactID, pendingGPA) {
        return new ApprovedStudies(applicationID, studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, programName, useProgramPC, pendingModelChange, primaryContactID, pendingGPA);
    }
}

module.exports = {
    ApprovedStudies
}
