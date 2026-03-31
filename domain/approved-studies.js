const {getCurrentTime} = require("../utility/time-utility");
const {isTrue} = require("../utility/string-utility");


class ApprovedStudies {
    constructor(applicationID, studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, useProgramPC, pendingModelChange, primaryContactID, pendingGPA, programID, pendingImageDeIdentification) {
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
        this.createdAt = this.updatedAt = getCurrentTime();
        this.useProgramPC = isTrue(useProgramPC);
        this.pendingModelChange = isTrue(pendingModelChange ?? true);
        if (applicationID) {
            this.applicationID = applicationID
        }

        if (primaryContactID) {
            this.primaryContactID = primaryContactID;
        }

        if (pendingGPA?.GPAName) {
            this.GPAName = pendingGPA?.GPAName;
        }

        this.isPendingGPA = isTrue(pendingGPA?.isPendingGPA && this.controlledAccess);
        this.programID = programID;
        this.pendingImageDeIdentification = isTrue(pendingImageDeIdentification ?? false);
    }

        static createApprovedStudies(applicationID, studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, useProgramPC, pendingModelChange, primaryContactID, pendingGPA, programID, pendingImageDeIdentification) {
        return new ApprovedStudies(applicationID, studyName, studyAbbreviation, dbGaPID, organizationName, controlledAccess, ORCID, PI, openAccess, useProgramPC, pendingModelChange, primaryContactID, pendingGPA, programID, pendingImageDeIdentification);
    }
}

module.exports = {
    ApprovedStudies
}
