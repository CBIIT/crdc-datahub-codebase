const {isLoginGovLogin, isNIHLogin} = require("../services/nih-auth");

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



