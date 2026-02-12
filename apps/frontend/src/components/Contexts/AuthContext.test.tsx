import { MockedProvider, MockedResponse } from "@apollo/client/testing";
import { GraphQLError } from "graphql";
import React, { FC } from "react";

import { userFactory } from "@/factories/auth/UserFactory";

import { query as GET_MY_USER } from "../../graphql/getMyUser";
import { render, waitFor } from "../../test-utils";

import { AuthProvider, Status as AuthStatus, useAuthContext } from "./AuthContext";

type Props = {
  mocks?: MockedResponse[];
  children?: React.ReactNode;
};

const TestChild: FC = () => {
  const { isLoggedIn, status, user } = useAuthContext();

  if (status === AuthStatus.LOADING) {
    return null;
  }

  return (
    <>
      {/* Generic Context Details  */}
      <div data-testid="status">{status}</div>
      <div data-testid="isLoggedIn">{isLoggedIn ? "true" : "false"}</div>

      {/* User Data */}
      {user?._id && <div data-testid="user-id">{user._id}</div>}
      {typeof user?.firstName === "string" && <div data-testid="first-name">{user.firstName}</div>}
      {typeof user?.lastName === "string" && <div data-testid="last-name">{user.lastName}</div>}
    </>
  );
};

const TestParent: FC<Props> = ({ mocks, children }: Props) => (
  <MockedProvider mocks={mocks}>
    <AuthProvider>{children ?? <TestChild />}</AuthProvider>
  </MockedProvider>
);

describe("AuthContext > useAuthContext Tests", () => {
  it("should throw an exception when used outside of a AuthProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestChild />)).toThrow(
      "AuthContext cannot be used outside of the AuthProvider component"
    );
    vi.spyOn(console, "error").mockRestore();
  });
});

describe("AuthContext > AuthProvider Tests", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("should render without crashing", () => {
    expect(() => render(<TestParent />)).not.toThrow();
  });

  it("should restore the user from localStorage cache", async () => {
    const userData = userFactory.build({
      _id: "aaa-bbb-0101",
      firstName: "Test",
      lastName: "User",
    });

    const mocks = [
      {
        request: {
          query: GET_MY_USER,
        },
        result: {
          data: {
            getMyUser: {
              ...userData,
            },
          },
        },
      },
    ];

    localStorage.setItem("userDetails", JSON.stringify(userData));

    const { findByTestId, getByTestId } = render(<TestParent mocks={mocks} />);

    await findByTestId("status");

    expect(getByTestId("status").textContent).toEqual(AuthStatus.LOADED);
    expect(getByTestId("isLoggedIn").textContent).toEqual("true");
    expect(getByTestId("user-id").textContent).toEqual(userData._id);
    expect(getByTestId("first-name").textContent).toEqual(userData.firstName);
    expect(getByTestId("last-name").textContent).toEqual(userData.lastName);
  });

  it("should successfully verify the cached user with the BE service", async () => {
    const userData = userFactory.build({
      _id: "123-random-id-456",
      firstName: "Random",
      lastName: "Lastname with spaces",
    });

    const mocks = [
      {
        request: {
          query: GET_MY_USER,
        },
        result: {
          data: {
            getMyUser: {
              ...userData,
            },
          },
        },
      },
    ];

    localStorage.setItem("userDetails", JSON.stringify(userData));

    const { findByTestId, getByTestId } = render(<TestParent mocks={mocks} />);

    await findByTestId("status");

    expect(getByTestId("status").textContent).toEqual(AuthStatus.LOADED);
    expect(getByTestId("isLoggedIn").textContent).toEqual("true");
  });

  it("should update the localStorage cache when the user is verified", async () => {
    const userData = userFactory.build({
      _id: "123-random-id-456",
      firstName: "Random",
      lastName: "Lastname with spaces",
    });

    const mocks = [
      {
        request: {
          query: GET_MY_USER,
        },
        result: {
          data: {
            getMyUser: {
              ...userData,
              firstName: "The API updated my first name",
            },
          },
        },
      },
    ];

    localStorage.setItem("userDetails", JSON.stringify(userData));

    const { getByTestId } = render(<TestParent mocks={mocks} />);

    await waitFor(() =>
      expect(getByTestId("first-name").textContent).toEqual(
        mocks[0].result.data.getMyUser.firstName
      )
    );
    await waitFor(
      () => {
        const cachedUser = JSON.parse(localStorage.getItem("userDetails"));
        expect(cachedUser.firstName).toEqual(mocks[0].result.data.getMyUser.firstName);
      },
      { timeout: 1000 }
    );
  });

  it("should logout the user if the BE API call fails", async () => {
    const userData = userFactory.build({
      _id: "GGGG-1393-AAA-9101",
      firstName: "Random",
      lastName: "Lastname",
    });

    const mocks = [
      {
        request: {
          query: GET_MY_USER,
        },
        result: {
          data: null,
          errors: [new GraphQLError("A user must be logged in to perform this action")],
        },
      },
    ];

    localStorage.setItem("userDetails", JSON.stringify(userData));

    const { findByTestId, getByTestId } = render(<TestParent mocks={mocks} />);

    await findByTestId("status");

    expect(getByTestId("status").textContent).toEqual(AuthStatus.LOADED);

    await waitFor(() => expect(getByTestId("isLoggedIn").textContent).toEqual("false"));

    await waitFor(
      () => {
        expect(localStorage.getItem("userDetails")).toBeNull();
      },
      { timeout: 1000 }
    );
  });
});
