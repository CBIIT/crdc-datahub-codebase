import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const GET_APPLICATION_FORM_VERSION: TypedDocumentNode<GetApplicationFormVersionResp> = gql`
  query getApplicationFormVersion {
    getApplicationFormVersion {
      _id
      version: new
    }
  }
`;

export type GetApplicationFormVersionResp = {
  getApplicationFormVersion: {
    /**
     * The UUIDv4 of the form version configuration
     */
    _id: string;
    /**
     * The form version for all new forms.
     *
     * @note This is internally mapped from `new`, since that's a special keyword
     */
    version: string;
  };
};
