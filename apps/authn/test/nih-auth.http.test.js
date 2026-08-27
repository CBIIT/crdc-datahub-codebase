process.env.DOCDB_TLS = 'false';
process.env.docdb_endpoint = '127.0.0.1';
process.env.docdb_port = '27017';
process.env.docdb_username = 'test';
process.env.docdb_password = 'test';
process.env.docdb_db_name = 'crdc-datahub';

const { LOGIN_ERROR } = require("../constants/errors");
const config = require("../config");

jest.mock("node-fetch");

const nodeFetch = require("node-fetch");
const { getNIHToken, nihUserInfo, nihLogout } = require("../services/nih-auth");

/**
 * @param {number} status
 * @param {string} body
 * @returns {{status: number, text: () => Promise<string>}}
 */
const mockFetchResponse = (status, body) => ({
    status,
    text: jest.fn().mockResolvedValue(body),
});

describe("NIH STS HTTP responses", () => {
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe("getNIHToken", () => {
        const code = "auth-code";
        const redirectUri = "https://example.gov/callback";

        test("POSTs the authorization code grant to the token URL", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "the-token",
            })));

            await getNIHToken(code, redirectUri);

            expect(nodeFetch).toHaveBeenCalledTimes(1);
            const [url, options] = nodeFetch.mock.calls[0];
            expect(url).toBe(config.nih.TOKEN_URL);
            expect(options.method).toBe("POST");
            expect(options.headers).toEqual({
                "Content-Type": "application/x-www-form-urlencoded",
            });
            expect(Object.fromEntries(options.body)).toEqual({
                code,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
                client_id: String(config.nih.CLIENT_ID),
                client_secret: String(config.nih.CLIENT_SECRET),
                scope: "openid email profile",
            });
        });

        test("logs body length and throws when HTTP 200 is not JSON", async () => {
            const body = "<html>not json</html>";
            nodeFetch.mockResolvedValue(mockFetchResponse(200, body));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `An error occurred while parsing the token response: not JSON, bodyLength=${body.length}`
            );
            expect(consoleErrorSpy.mock.calls.flat().join(" ")).not.toContain(body);
        });

        test("logs field names without values and throws when HTTP 200 JSON has no access_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                token_type: "Bearer",
                refresh_token: "secret-refresh",
                id_token: "header.payload.signature",
            })));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The token response could not be used: fields with non-empty values: token_type, refresh_token, id_token"
            );
            const logged = consoleErrorSpy.mock.calls.flat().join(" ");
            expect(logged).not.toContain("secret-refresh");
            expect(logged).not.toContain("header.payload.signature");
            expect(logged).not.toContain("Bearer");
            expect(logged).not.toContain("email is missing");
            expect(logged).not.toContain("preferred_username is missing");
            expect(logged).not.toContain("first_name is missing");
            expect(logged).not.toContain("last_name is missing");
        });

        test("logs and throws when HTTP 200 JSON has a non-string access_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: { nested: true },
            })));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The token response could not be used: fields with non-empty values: access_token"
            );
            expect(consoleErrorSpy.mock.calls.flat().join(" ")).not.toContain("nested");
        });

        test("logs and throws when HTTP 200 JSON has a whitespace-only access_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "   ",
            })));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The token response could not be used: fields present but empty: access_token"
            );
        });

        test("returns access_token and logs when HTTP 200 JSON has an invalid id_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "the-token",
                id_token: "",
            })));

            await expect(getNIHToken(code, redirectUri)).resolves.toBe("the-token");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The following optional token fields were present but invalid: id_token"
            );
        });

        test("returns access_token and logs when HTTP 200 JSON has an empty refresh_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "the-token",
                refresh_token: "",
            })));

            await expect(getNIHToken(code, redirectUri)).resolves.toBe("the-token");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The following optional token fields were present but invalid: refresh_token"
            );
        });

        test("returns access_token and logs when HTTP 200 JSON has invalid id_token and refresh_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "the-token",
                refresh_token: "",
                id_token: "",
            })));

            await expect(getNIHToken(code, redirectUri)).resolves.toBe("the-token");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The following optional token fields were present but invalid: refresh_token, id_token"
            );
        });

        test("returns access_token and logs when HTTP 200 JSON has a whitespace-only refresh_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "the-token",
                refresh_token: "   ",
            })));

            await expect(getNIHToken(code, redirectUri)).resolves.toBe("the-token");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The following optional token fields were present but invalid: refresh_token"
            );
        });

        test("returns access_token and logs when HTTP 200 JSON has a non-string id_token", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "the-token",
                id_token: 123,
            })));

            await expect(getNIHToken(code, redirectUri)).resolves.toBe("the-token");
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The following optional token fields were present but invalid: id_token"
            );
        });

        test("logs and throws when HTTP 200 JSON is an empty object", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, "{}"));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "The token response could not be used: response body is an empty object"
            );
        });

        test("escapes CR/LF in non-allowlisted field names without logging values", async () => {
            const secret = "secret-injected-value";
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                "token_type\nERROR": secret,
                "refresh_token\rWARN": "",
            })));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            const logged = consoleErrorSpy.mock.calls[0][0];
            expect(logged).toBe(
                "The token response could not be used: fields with non-empty values: token_type\\nERROR; fields present but empty: refresh_token\\rWARN"
            );
            expect(logged).not.toMatch(/[\r\n]/);
            expect(logged).not.toContain(secret);
        });

        test("logs and throws when HTTP 200 JSON is null", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, "null"));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith("The token response could not be used: response body is null");
        });

        test("logs and throws when HTTP 200 JSON is an array", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, "[]"));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith("The token response could not be used: response body is an array of length 0");
        });

        test("logs type and throws when HTTP 200 JSON is a boolean", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, "true"));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith("The token response could not be used: response body is boolean");
        });

        test("logs type and throws when HTTP 200 JSON is a string without logging the value", async () => {
            const secret = "secret-primitive-token";
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify(secret)));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith("The token response could not be used: response body is string");
            expect(consoleErrorSpy.mock.calls.flat().join(" ")).not.toContain(secret);
        });

        test("returns access_token on HTTP 200 without logging an error", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify({
                access_token: "the-token",
                refresh_token: "secret-refresh",
                id_token: "header.payload.signature",
            })));

            await expect(getNIHToken(code, redirectUri)).resolves.toBe("the-token");
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        test("logs status and throws LOGIN_ERROR on HTTP 400 without logging the body", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(400, JSON.stringify({
                error: "invalid_grant",
            })));

            await expect(getNIHToken(code, redirectUri)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith("token returned HTTP 400");
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe("nihUserInfo", () => {
        const accessToken = "access-token";

        test("logs body length and throws when HTTP 200 is not JSON", async () => {
            const body = "<html>oops</html>";
            nodeFetch.mockResolvedValue(mockFetchResponse(200, body));

            await expect(nihUserInfo(accessToken)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                `An error occurred while parsing the userinfo response: not JSON, bodyLength=${body.length}`
            );
            expect(consoleErrorSpy.mock.calls.flat().join(" ")).not.toContain(body);
        });

        test("logs status and throws LOGIN_ERROR on HTTP 401 without logging the body", async () => {
            nodeFetch.mockResolvedValue(mockFetchResponse(401, JSON.stringify({
                error: "invalid_token",
            })));

            await expect(nihUserInfo(accessToken)).rejects.toThrow(LOGIN_ERROR);
            expect(consoleErrorSpy).toHaveBeenCalledWith("userinfo returned HTTP 401");
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });

        test("returns userinfo JSON on HTTP 200 without logging an error", async () => {
            const userinfo = {
                preferred_username: "user@nih.gov",
                email: "user@nih.gov",
            };
            nodeFetch.mockResolvedValue(mockFetchResponse(200, JSON.stringify(userinfo)));

            await expect(nihUserInfo(accessToken)).resolves.toEqual(userinfo);
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(nodeFetch).toHaveBeenCalledWith(config.nih.USERINFO_URL, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
        });
    });

    describe("nihLogout", () => {
        test("POSTs id_token to the logout URL with Basic auth and returns the response", async () => {
            const tokens = "session-access-token";
            const logoutResponse = mockFetchResponse(200, "");
            nodeFetch.mockResolvedValue(logoutResponse);

            await expect(nihLogout(tokens)).resolves.toBe(logoutResponse);

            expect(nodeFetch).toHaveBeenCalledTimes(1);
            const [url, options] = nodeFetch.mock.calls[0];
            expect(url).toBe(config.nih.LOGOUT_URL);
            expect(options.method).toBe("POST");
            expect(options.headers).toEqual({
                Authorization: "Basic " + Buffer.from(`${config.nih.CLIENT_ID}:${config.nih.CLIENT_SECRET}`).toString("base64"),
            });
            expect(Object.fromEntries(options.body)).toEqual({ id_token: tokens });
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });
});
