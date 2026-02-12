import { TypedDocumentNode } from "@apollo/client";
import gql from "graphql-tag";

export const query: TypedDocumentNode<Response, Input> = gql`
  query retrieveCDEs($cdeInfo: [CDEInput!]!) {
    retrieveCDEs(CDEInfo: $cdeInfo) {
      CDEFullName
      CDECode
      CDEVersion
      PermissibleValues
    }
  }
`;

export type Input = {
  cdeInfo: Pick<CDEInfo, "CDECode" | "CDEVersion">[];
};

export type Response = {
  retrieveCDEs: {
    CDEFullName: string;
    CDECode: string;
    CDEVersion: string;
    PermissibleValues: string[];
  }[];
};
