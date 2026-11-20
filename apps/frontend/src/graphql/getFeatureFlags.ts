import { gql } from "@apollo/client/core";
import { TypedDocumentNode } from "@apollo/client/core/types";

import { FEATURE_FLAG_KEYS, FeatureFlagKey } from "@/config/FeatureFlags";

export const GET_FEATURE_FLAGS: TypedDocumentNode<Response, null> = gql`
  query getFeatureFlags {
    getFeatureFlags {
      ${FEATURE_FLAG_KEYS.join("\n")}
    }
  }
`;

export type Response = {
  /**
   * The on/off state of each flag.
   */
  getFeatureFlags: Partial<Record<FeatureFlagKey, boolean | null>> | null;
};
