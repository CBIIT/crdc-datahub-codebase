type ApprovedStudy = {
    _id: string;
    originalOrg: Organization["_id"];
    /**
     * Study name
     *
     * @example Genomic Information System
     */
    studyName: string;
    /**
     * Study Abbreviation
     *
     * @example GIS
     */
    studyAbbreviation: string;
    dbGaPID: string;
};
