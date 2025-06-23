const {getCurrentTime} = require("../utility/time-utility");
const {isTrue} = require("../utility/string-utility");


class ApprovedStudies {
    constructor(studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, programName, useProgramPC, pendingModelChange, primaryContactID) {
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
        if (primaryContactID) {
            this.primaryContactID = primaryContactID;
        }
    }

    static createApprovedStudies(studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, programName, useProgramPC, pendingModelChange, primaryContactID) {
        return new ApprovedStudies(studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, programName, useProgramPC, pendingModelChange, primaryContactID);
    }
}

module.exports = {
    ApprovedStudies
}
