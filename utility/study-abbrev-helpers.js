/**
 * Returns the study abbreviation or the study name if the abbreviation is empty.
 * Primarily intended for API responses used to get table data.
 * @param {string} abbrev the study abbreviation
 * @param {string} fullName the study name
 * @returns the study abbreviation or the study name if the abbreviation is empty
 */
function defaultStudyAbbreviationToStudyName(abbrev, fullName) {
    let value = isStudyAbbreviationEmpty(abbrev) ? fullName : abbrev;
    return (value ?? "").toString().trim();
}

/**
 * Returns the trimmed study abbreviation, or the literal "NA" if the abbreviation is empty
 * (null, empty, or whitespace only).
 * Used for the Inquire SR template's Study Abbreviation line and PV request notifications only;
 * other emails use defaultStudyAbbreviationToStudyName with the application study name.
 * @param {string} abbrev the study abbreviation
 * @returns {string} trimmed abbrev, or "NA" when there is no abbrev
 */
function defaultStudyAbbreviationToNA(abbrev) {
    const value = (abbrev ?? "").toString().trim();
    return value.length > 0 ? value : "NA";
}

/**
 * Checks if the study abbreviation is falsy or whitespace only.
 * @param {*} abbrev the study abbreviation
 * @returns true if the abbreviation is empty, false otherwise
 */
function isStudyAbbreviationEmpty(abbrev) {
    return (abbrev ?? "").toString().trim().length === 0;
}

/**
 * listPrograms API response only: when each approved study's abbreviation is empty, show studyName in the abbrev field.
 * @param {{ total?: number, programs?: Array }} listProgramsResult result of Organization#listPrograms
 * @returns {typeof listProgramsResult} new object if any `studies` were mapped; same reference if no work needed
 */
function applyStudyAbbreviationFallbackToListPrograms(listProgramsResult) {
    if (!listProgramsResult?.programs?.length) {
        return listProgramsResult;
    }
    if (!listProgramsResult.programs.some((p) => p?.studies?.length)) {
        return listProgramsResult;
    }
    return {
        ...listProgramsResult,
        programs: listProgramsResult.programs.map((program) => {
            if (!program?.studies?.length) {
                return program;
            }
            return {
                ...program,
                studies: program.studies.map((s) => ({
                    ...s,
                    studyAbbreviation: defaultStudyAbbreviationToStudyName(s.studyAbbreviation, s.studyName)
                }))
            };
        })
    };
}

module.exports = {
    defaultStudyAbbreviationToStudyName,
    defaultStudyAbbreviationToNA,
    applyStudyAbbreviationFallbackToListPrograms
};
