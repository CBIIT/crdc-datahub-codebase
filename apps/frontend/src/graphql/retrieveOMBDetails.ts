import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const RETRIEVE_OMB_DETAILS: TypedDocumentNode<RetrieveOMBDetailsResp> = gql`
  query getOMB {
    getOMB {
      _id
      OMBNumber
      expirationDate
      OMBInfo
    }
  }
`;

export type RetrieveOMBDetailsResp = {
  getOMB: {
    _id: string;
    OMBNumber: string;
    expirationDate: string;
    OMBInfo: string[];
  } | null;
};
