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
 * Returns true if any approved study has an empty (null/undefined/whitespace-only) studyAbbreviation.
 * @param {Array} programs
 */
function programsHaveAnyEmptyStudyAbbrev(programs) {
    if (!programs?.length) {
        return false;
    }
    for (const p of programs) {
        if (!p?.studies?.length) {
            continue;
        }
        for (const s of p.studies) {
            if (isStudyAbbreviationEmpty(s?.studyAbbreviation)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * listPrograms API response only: when a study's abbreviation is empty, set studyAbbreviation to studyName (trimmed).
 * Returns the same top-level reference when no program has a study with an empty abbrev; otherwise clones only
 * programs/studies that need updates.
 * @param {{ total?: number, programs?: Array }} listProgramsResult result of Organization#listPrograms
 * @returns {typeof listProgramsResult}
 */
function applyStudyAbbreviationFallbackToListPrograms(listProgramsResult) {
    if (!listProgramsResult?.programs?.length) {
        return listProgramsResult;
    }
    const programs = listProgramsResult.programs;
    if (!programsHaveAnyEmptyStudyAbbrev(programs)) {
        return listProgramsResult;
    }
    return {
        ...listProgramsResult,
        programs: programs.map((program) => mapProgramStudiesAbbrevFallback(program))
    };
}

function mapProgramStudiesAbbrevFallback(program) {
    if (!program?.studies?.length) {
        return program;
    }
    let changed = false;
    const studies = program.studies.map((s) => {
        if (!isStudyAbbreviationEmpty(s?.studyAbbreviation)) {
            return s;
        }
        changed = true;
        return {
            ...s,
            studyAbbreviation: defaultStudyAbbreviationToStudyName(s.studyAbbreviation, s.studyName)
        };
    });
    if (!changed) {
        return program;
    }
    return {
        ...program,
        studies
    };
}

module.exports = {
    defaultStudyAbbreviationToStudyName,
    defaultStudyAbbreviationToNA,
    applyStudyAbbreviationFallbackToListPrograms
};
