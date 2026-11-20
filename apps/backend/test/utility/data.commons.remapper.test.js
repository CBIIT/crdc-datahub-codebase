const {getDataCommonsDisplayName, getDataCommonsDisplayNamesForSubmission, getDataCommonsDisplayNamesForListSubmissions, genericGetDataCommonsDisplayNames,
    getDataCommonsDisplayNamesForUser, applyStudyAbbreviationFallbackToListSubmission
} = require('../../utility/data-commons-remapper');
const { DATA_SYNC_STATUS } = require('../../constants/data-sync-constants');

const NOT_STARTED_ROLLUPS = {
    metadataDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
    fileDataSyncStatus: DATA_SYNC_STATUS.NOT_STARTED,
};

describe('Data Commons Remapper Test', () => {
    let baseInput = {
        dataCommons: ["ICDC", "CDS"],
        notDataCommons: ["ICDC", "CDS"]
    };
    let baseOutput = {
        dataCommons: ["ICDC", "GC"],
        notDataCommons: ["ICDC", "CDS"]
    }

    test('/test mapping', () => {
        expect(getDataCommonsDisplayName("CDS")).toStrictEqual("GC");
    });

    test('/test no mapping', () => {
        expect(getDataCommonsDisplayName("test")).toStrictEqual("test");
    });

    test('/test null', () => {
        expect(getDataCommonsDisplayName(null)).toStrictEqual(null);
    });

    test('/test undefined', () => {
        expect(getDataCommonsDisplayName(undefined)).toStrictEqual(null);
    });

    test('/test non-string', () => {
        expect(getDataCommonsDisplayName(false)).toStrictEqual(null);
        expect(getDataCommonsDisplayName(true)).toStrictEqual(null);
        expect(getDataCommonsDisplayName(1.5)).toStrictEqual(null);
        expect(getDataCommonsDisplayName(1)).toStrictEqual(null);
    });

    test('/test genericGetDataCommonsDisplayNames', () => {
        expect(genericGetDataCommonsDisplayNames(["ICDC", "CDS"], getDataCommonsDisplayName)).toStrictEqual(["ICDC", "GC"]);
        expect(genericGetDataCommonsDisplayNames("CDS", getDataCommonsDisplayName)).toStrictEqual("GC");
        expect(genericGetDataCommonsDisplayNames(null, getDataCommonsDisplayName)).toStrictEqual(null);
        expect(genericGetDataCommonsDisplayNames("CDS", null)).toStrictEqual(null);
        expect(genericGetDataCommonsDisplayNames("CDS", "test")).toStrictEqual(null);
        expect(genericGetDataCommonsDisplayNames("CDS", {})).toStrictEqual(null);
    });

    test('/test getDataCommonsDisplayNamesForSubmission', () => {
        let inputSubmission = {
            dataCommons: "CDS"
        };
        let outputSubmission = {
            dataCommons: "CDS",
            dataCommonsDisplayName: "GC",
            ...NOT_STARTED_ROLLUPS,
        };
        expect(getDataCommonsDisplayNamesForSubmission(inputSubmission)).toStrictEqual(outputSubmission);
        inputSubmission = {
            dataCommons: "ICDC"
        };
        outputSubmission = {
            dataCommons: "ICDC",
            dataCommonsDisplayName: "ICDC",
            ...NOT_STARTED_ROLLUPS,
        };
        expect(getDataCommonsDisplayNamesForSubmission(inputSubmission)).toStrictEqual(outputSubmission);
        inputSubmission = {
            dataCommons: null
        };
        expect(getDataCommonsDisplayNamesForSubmission(inputSubmission)).toStrictEqual({
            dataCommons: null,
            ...NOT_STARTED_ROLLUPS,
        });
    });

    test('getDataCommonsDisplayNamesForSubmission normalizes invalid DataSync rollup values', () => {
        const input = {
            metadataDataSyncStatus: null,
            fileDataSyncStatus: '',
        };
        const out = getDataCommonsDisplayNamesForSubmission(input);
        expect(out.metadataDataSyncStatus).toBe(DATA_SYNC_STATUS.NOT_STARTED);
        expect(out.fileDataSyncStatus).toBe(DATA_SYNC_STATUS.NOT_STARTED);

        const withProgress = {
            metadataDataSyncStatus: DATA_SYNC_STATUS.IN_PROGRESS,
            fileDataSyncStatus: DATA_SYNC_STATUS.SUCCEEDED,
        };
        const outProgress = getDataCommonsDisplayNamesForSubmission(withProgress);
        expect(outProgress.metadataDataSyncStatus).toBe(DATA_SYNC_STATUS.IN_PROGRESS);
        expect(outProgress.fileDataSyncStatus).toBe(DATA_SYNC_STATUS.SUCCEEDED);
    });

    test('/test getDataCommonsDisplayNamesForListSubmissions', () => {
        let inputListSubmission = {
            dataCommons: ["ICDC", "CDS"]
        };
        let outputListSubmission = {
            dataCommons: ["ICDC", "CDS"],
            dataCommonsDisplayNames: ["ICDC", "GC"]
        }
        expect(getDataCommonsDisplayNamesForListSubmissions(inputListSubmission)).toStrictEqual(outputListSubmission);
        let inputSubmission = {
            dataCommons: "CDS"
        };
        let outputSubmission = {
            dataCommons: "CDS",
            dataCommonsDisplayName: "GC",
            studyAbbreviation: "",
            ...NOT_STARTED_ROLLUPS,
        };
        inputListSubmission.submissions = [inputSubmission, {}, inputSubmission];
        outputListSubmission.submissions = [
            outputSubmission,
            { studyAbbreviation: '', ...NOT_STARTED_ROLLUPS },
            outputSubmission,
        ];
        expect(getDataCommonsDisplayNamesForListSubmissions(inputListSubmission)).toStrictEqual(outputListSubmission);
    });

    test('applyStudyAbbreviationFallbackToListSubmission uses studyName when studyAbbreviation is empty', () => {
        const row = {
            dataCommons: "CDS",
            studyName: "Top level name",
            studyAbbreviation: "   ",
            study: { studyName: "Nested name", studyAbbreviation: " \t " }
        };
        const out = applyStudyAbbreviationFallbackToListSubmission({ ...row });
        expect(out.studyAbbreviation).toBe("Top level name");
        expect(out.study.studyAbbreviation).toBe("Nested name");
    });

    test('/test getDataCommonsDisplayNamesForUser', () => {
        let inputUser = {
            dataCommons: ["CDS", "ICDC"]
        };
        let outputUser = {
            dataCommons: ["CDS", "ICDC"],
            dataCommonsDisplayNames: ["GC", "ICDC"]
        }
        expect(getDataCommonsDisplayNamesForUser(inputUser)).toStrictEqual(outputUser);
        inputUser.studies = []
        outputUser.studies = ["GC"]

    });

    test('/test getDataCommonsDisplayNamesForApprovedStudy', () => {
        let inputUser = {
            dataCommons: "CDS"
        };
        let outputUser = {
            dataCommons: "CDS",
            dataCommonsDisplayName: "GC"
        }
        let inputUserOrg = {
            test: "test"
        }
        let outputUserOrg = {
            test: "test"
        }
        let inputApprovedStudy = {
            program: inputUserOrg,
            primaryContact: inputUser
        }
        let outputApprovedStudy = {
            program: inputUserOrg,
            primaryContact: outputUser
        }

    });

    test('/test getDataCommonsDisplayNamesForApprovedStudyList', () => {

    });

    test('/test getDataCommonsDisplayNamesForUserOrganization', () => {

    });

    test('/test stuck in loop', () => {

    });
});
