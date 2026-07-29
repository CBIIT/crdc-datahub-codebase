const { NIH, LOGIN_GOV } = require('../constants/idp-constants');
const { LOGIN_ERROR } = require('../constants/errors');

jest.mock('../services/nih-auth', () => ({
    getNIHToken: jest.fn(),
    nihUserInfo: jest.fn(),
    nihLogout: jest.fn(),
    getIDP: jest.fn(),
}));

const {
    getNIHToken,
    nihUserInfo,
    nihLogout,
    getIDP,
} = require('../services/nih-auth');
const nihClient = require('../idps/nih');

describe('NIH IDP client', () => {
    const code = 'auth-code';
    const redirectingURL = 'https://example.gov/callback';
    const token = 'access-token';

    beforeEach(() => {
        jest.clearAllMocks();
        getNIHToken.mockResolvedValue(token);
    });

    describe('login', () => {
        test('uses preferred_username for IDP', async () => {
            nihUserInfo.mockResolvedValue({
                preferred_username: 'user@nih.gov',
                email: 'user@login.gov',
                first_name: 'Ada',
                last_name: 'Lovelace',
            });
            getIDP.mockReturnValue(NIH);

            const result = await nihClient.login(code, redirectingURL);

            expect(getNIHToken).toHaveBeenCalledWith(code, redirectingURL);
            expect(nihUserInfo).toHaveBeenCalledWith(token);
            expect(getIDP).toHaveBeenCalledWith('user@nih.gov');
            expect(result).toEqual({
                name: 'Ada',
                lastName: 'Lovelace',
                email: 'user@login.gov',
                tokens: token,
                idp: NIH,
            });
        });

        test('passes undefined to getIDP when preferred_username is missing', async () => {
            nihUserInfo.mockResolvedValue({
                email: 'user@login.gov',
                first_name: 'Ada',
                last_name: 'Lovelace',
            });
            getIDP.mockImplementation(() => {
                throw new Error(LOGIN_ERROR);
            });

            await expect(nihClient.login(code, redirectingURL)).rejects.toThrow(LOGIN_ERROR);
            expect(getIDP).toHaveBeenCalledWith(undefined);
        });

        test('passes empty preferred_username through to getIDP', async () => {
            nihUserInfo.mockResolvedValue({
                preferred_username: '',
                email: 'user@nih.gov',
            });
            getIDP.mockReturnValue(LOGIN_GOV);

            const result = await nihClient.login(code, redirectingURL);

            expect(getIDP).toHaveBeenCalledWith('');
            expect(result).toEqual({
                name: '',
                lastName: '',
                email: 'user@nih.gov',
                tokens: token,
                idp: LOGIN_GOV,
            });
        });
    });

    describe('authenticated', () => {
        test('returns true when nihUserInfo succeeds', async () => {
            nihUserInfo.mockResolvedValue({ email: 'user@nih.gov' });

            await expect(nihClient.authenticated(token)).resolves.toBe(true);
            expect(nihUserInfo).toHaveBeenCalledWith(token);
        });

        test('returns false when tokens are missing', async () => {
            await expect(nihClient.authenticated(null)).resolves.toBe(false);
            expect(nihUserInfo).not.toHaveBeenCalled();
        });

        test('returns false when nihUserInfo throws', async () => {
            nihUserInfo.mockRejectedValue(new Error('invalid token'));

            await expect(nihClient.authenticated(token)).resolves.toBe(false);
        });
    });

    describe('logout', () => {
        test('delegates to nihLogout', async () => {
            const logoutResult = { ok: true };
            nihLogout.mockResolvedValue(logoutResult);

            await expect(nihClient.logout(token)).resolves.toBe(logoutResult);
            expect(nihLogout).toHaveBeenCalledWith(token);
        });
    });
});
