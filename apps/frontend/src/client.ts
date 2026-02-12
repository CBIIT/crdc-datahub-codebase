import { ApolloClient, InMemoryCache, ApolloLink, HttpLink, DefaultOptions } from "@apollo/client";

import env from "./env";

const defaultOptions: DefaultOptions = {
  query: {
    fetchPolicy: "no-cache",
  },
};

const backendService = new HttpLink({
  uri: env.VITE_BACKEND_API,
});

const mockService = new HttpLink({
  uri: "https://7a242248-52f7-476a-a60f-d64a2db3dd5b.mock.pstmn.io/graphql",
  headers: {
    "x-mock-match-request-body": "true",
  },
});

const cache = new InMemoryCache({
  typePolicies: {
    Submission: {
      keyFields: ["_id"],
      fields: {
        collaborators: {
          merge: false,
        },
      },
    },
    Collaborator: {
      keyFields: ["collaboratorID"],
    },
    PBACDefaults: {
      keyFields: ["role"],
    },
    Permission: {
      keyFields: false,
    },
    Notification: {
      keyFields: false,
    },
  },
});

const client = new ApolloClient({
  cache,
  defaultOptions,
  link: ApolloLink.split(
    (operation) => operation.getContext().clientName === "mockService",
    mockService,
    backendService
  ),
});

export default client;
