const {isLoginGovLogin, isNIHLogin, getIDP} = require("../services/nih-auth");
const {NIH, LOGIN_GOV} = require("../constants/idp-constants");
const {LOGIN_ERROR} = require("../constants/errors");

describe('Util Test', () => {
    test('/nih idp test', () => {
        const test = [
            {src: "sdf____ds@nih.gOv", result: true},
            {src: "sddfsnih@nih.GsOV", result: false},
            {src: "sddfsnih@nIH.gOv", result: true},
            {src: "@nIH.gOv", result: false},
            {src: undefined, result: false},
            {src: null, result: false},
            {src: "sdsdfdsf@nih.govLogin.gov", result: false},
            {src: "login.govlogin.gov@loginNIH.gov", result: false}
        ];

        for (let t of test) {
            let result = isNIHLogin(t.src);
            expect(result).toBe(t.result);
        }
    });

    test('/login.gov idp test', () => {
        const test = [
            {src: "sdsdfdsf@login.govAAAAA", result: false},
            {src: "@login.gov", result: false},
            {src: "sss@login.gov", result: true},
            {src: "sss@Login.GOV", result: true},
            {src: "sdsdfdsf@login.gov", result: true},
            {src: "ss_@login.gov", result: true},
            {src: "login.gov@login.gov", result: true},
            {src: null, result: false},
            {src: "sdsdfdsf@nih.govLogin.gov", result: false},
            {src: "sdsdfdsf@sdsdfdsf@olgin.gov", result: false},
            {src: "login.govlogin.gov@loginNIH.gov", result: false}
        ];

        for (let t of test) {
            let result = isLoginGovLogin(t.src);
            expect(result).toBe(t.result);
        }
    });
});

describe('getIDP', () => {
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    test('returns NIH for nih.gov preferred username', () => {
        expect(getIDP('user@nih.gov')).toBe(NIH);
        expect(getIDP('user@NIH.GOV')).toBe(NIH);
    });

    test('returns LOGIN.GOV for login.gov preferred username', () => {
        expect(getIDP('user@login.gov')).toBe(LOGIN_GOV);
        expect(getIDP('user@Login.GOV')).toBe(LOGIN_GOV);
    });

    test('defaults empty preferred username to LOGIN.GOV', () => {
        expect(getIDP('')).toBe(LOGIN_GOV);
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    test('throws LOGIN_ERROR when preferred username is null or undefined', () => {
        expect(() => getIDP(null)).toThrow(LOGIN_ERROR);
        expect(() => getIDP(undefined)).toThrow(LOGIN_ERROR);
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    test('throws LOGIN_ERROR when preferred username format is unrecognized', () => {
        expect(() => getIDP('user@example.com')).toThrow(LOGIN_ERROR);
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            "The preferred_username property from the login response does not match one of the expected formats"
        );
        expect(consoleWarnSpy.mock.calls.flat().join(" ")).not.toContain("user@example.com");
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
});



