import { useMutation, useLazyQuery, ApolloError } from "@apollo/client";
import { isEqual } from "lodash";
import { useSnackbar } from "notistack";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  FC,
  ReactNode,
  useCallback,
  useEffect,
} from "react";

import {
  LIST_POTENTIAL_COLLABORATORS,
  EDIT_SUBMISSION_COLLABORATORS,
  ListPotentialCollaboratorsResp,
  ListPotentialCollaboratorsInput,
  EditSubmissionCollaboratorsResp,
  EditSubmissionCollaboratorsInput,
} from "../../graphql";
import { Logger, userToCollaborator } from "../../utils";

import { useSubmissionContext } from "./SubmissionContext";

/**
 * Types for CollaboratorsContext
 */
type CollaboratorsCtxState = {
  currentCollaborators: Collaborator[];
  remainingPotentialCollaborators: Collaborator[];
  maxCollaborators: number;
  handleAddCollaborator: () => void;
  handleRemoveCollaborator: (collaboratorIdx: number) => void;
  handleUpdateCollaborator: (collaboratorIdx: number, newCollaborator: CollaboratorInput) => void;
  saveCollaborators: () => Promise<Collaborator[]>;
  resetCollaborators: () => void;
  loadPotentialCollaborators: () => void;
  loading: boolean;
  error: ApolloError | null;
};

/**
 * CollaboratorsContext to manage collaborators state
 */
const CollaboratorsContext = createContext<CollaboratorsCtxState | undefined>(undefined);

/**
 * Custom hook to use the CollaboratorsContext
 *
 * @note Do NOT use this context directly. This is exported for testing purposes only.
 * @see {@link CollaboratorsProvider}
 * @see {@link CollaboratorsCtxState}
 * @throws Error if used outside of CollaboratorsProvider
 */
export const useCollaboratorsContext = (): CollaboratorsCtxState => {
  const context = useContext(CollaboratorsContext);
  if (!context) {
    throw new Error("useCollaboratorsContext must be used within a CollaboratorsProvider");
  }
  return context;
};

/**
 * Default empty collaborator object
 */
const defaultEmptyCollaborator: Collaborator = {
  collaboratorID: "",
  permission: "Can Edit",
} as Collaborator;

type ProviderProps = {
  children: ReactNode;
};

/**
 * CollaboratorsProvider component to provide collaborators context
 *
 * @see {@link useCollaboratorsContext} The context hook
 * @returns {JSX.Element | null} The rendered context provider or null
 */
export const CollaboratorsProvider: FC<ProviderProps> = ({ children }) => {
  const { data: submissionData } = useSubmissionContext();
  const { enqueueSnackbar } = useSnackbar();

  const [potentialCollaborators, setPotentialCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApolloError | null>(null);
  const [currentCollaborators, setCurrentCollaborators] = useState<Collaborator[]>([
    { ...defaultEmptyCollaborator },
  ]);

  const submissionID = submissionData?.getSubmission?._id;

  // Collaborators that are no longer considered a 'potential collaborator' from submission
  const unavailableCollaborators = submissionData?.getSubmission?.collaborators
    ?.map((c) => c.collaboratorID)
    ?.filter((c) => !potentialCollaborators?.map((pc) => pc.collaboratorID)?.includes(c));

  const maxCollaborators = useMemo(() => {
    const totalPotential = potentialCollaborators?.length || 0;
    const totalRemaining =
      unavailableCollaborators?.filter(
        (uc) => currentCollaborators?.map((c) => c.collaboratorID)?.includes(uc)
      )?.length || 0;

    return totalPotential + totalRemaining;
  }, [unavailableCollaborators, currentCollaborators, potentialCollaborators]);

  const [loadPotentialCollaboratorsQuery] = useLazyQuery<
    ListPotentialCollaboratorsResp,
    ListPotentialCollaboratorsInput
  >(LIST_POTENTIAL_COLLABORATORS, {
    fetchPolicy: "cache-and-network",
    onCompleted: (data) => {
      const collaborators = (data?.listPotentialCollaborators || [])?.map((user) =>
        userToCollaborator(user)
      );
      setPotentialCollaborators(collaborators);
      setLoading(false);
    },
    onError: (err) => {
      setError(err);
      setLoading(false);
    },
  });

  const [editSubmissionCollaborators, { loading: editLoading }] = useMutation<
    EditSubmissionCollaboratorsResp,
    EditSubmissionCollaboratorsInput
  >(EDIT_SUBMISSION_COLLABORATORS, {
    fetchPolicy: "no-cache",
  });

  /**
   * Creates a new empty collaborator object
   *
   * @returns {Collaborator} An empty Collaborator with "Can Edit" permission
   */
  const createEmptyCollaborator = (): Collaborator => ({ ...defaultEmptyCollaborator });

  /**
   * Resets the current collaborators to the mapped submission collaborators or to a default
   * collaborator if none exist
   *
   * @returns void
   */
  const resetCollaborators = useCallback(() => {
    const collaborators =
      submissionData?.getSubmission?.collaborators?.length > 0
        ? submissionData?.getSubmission?.collaborators
        : [createEmptyCollaborator()];
    if (isEqual(collaborators, currentCollaborators)) {
      return;
    }

    setCurrentCollaborators(collaborators);
  }, [currentCollaborators, submissionData, createEmptyCollaborator]);

  useEffect(() => {
    resetCollaborators();
  }, [potentialCollaborators, submissionData]);

  /**
   * Loads potential collaborators from API
   *
   * @returns void
   */
  const loadPotentialCollaborators = useCallback(() => {
    if (!submissionID) {
      return;
    }
    setLoading(true);
    loadPotentialCollaboratorsQuery({ variables: { submissionID } });
  }, [submissionID, loadPotentialCollaboratorsQuery]);

  /**
   * Filters out already selected potential collaborators and returns
   * the remaining un-selected collaborators
   */
  const remainingPotentialCollaborators = useMemo(() => {
    const currentCollaboratorIDs = currentCollaborators.map((c) => c.collaboratorID);

    return potentialCollaborators
      ?.filter((pc) => !currentCollaboratorIDs.includes(pc.collaboratorID))
      ?.sort((a, b) => a.collaboratorName.localeCompare(b.collaboratorName));
  }, [currentCollaborators, potentialCollaborators]);

  /**
   * Adds a new empty collaborator to the list
   *
   * @returns void
   */
  const handleAddCollaborator = (): void => {
    setCurrentCollaborators((prev) => [...prev, createEmptyCollaborator()]);
  };

  /**
   * Removes a collaborator from the list
   * @param collaboratorIdx Index of the collaborator to remove
   * @returns void
   */
  const handleRemoveCollaborator = (collaboratorIdx: number): void => {
    const currentCollaborator: Collaborator = currentCollaborators[collaboratorIdx];

    if (!currentCollaborator) {
      return;
    }

    setCurrentCollaborators((prev) => {
      const newCollaborators = prev.filter((_, index) => index !== collaboratorIdx);

      if (!newCollaborators?.length) {
        return [createEmptyCollaborator()];
      }

      return newCollaborators;
    });
  };

  /**
   * Updates a collaborator in the list
   * @param collaboratorIdx Index of the collaborator to update
   * @param newCollaborator New collaborator data
   * @returns void
   */
  const handleUpdateCollaborator = (
    collaboratorIdx: number,
    newCollaborator: CollaboratorInput
  ): void => {
    if (
      isNaN(collaboratorIdx) ||
      (!newCollaborator?.collaboratorID && !newCollaborator?.permission)
    ) {
      return;
    }

    let potentialCollaborator = potentialCollaborators.find(
      (pc) => pc.collaboratorID === newCollaborator?.collaboratorID
    );

    const existingCollaborator = currentCollaborators.find(
      (c) => c.collaboratorID === newCollaborator?.collaboratorID
    );

    if (!potentialCollaborator?.collaboratorID && existingCollaborator?.collaboratorID) {
      Logger.error(
        `CollaboratorsContext: The collaborator ${newCollaborator?.collaboratorID} is no longer a valid potential collaborator. Using existing collaborator instead.`,
        existingCollaborator
      );
      potentialCollaborator = { ...existingCollaborator };
    }

    setCurrentCollaborators((prevCollaborators) => {
      const collaboratorsClone = [...prevCollaborators];

      collaboratorsClone[collaboratorIdx] = {
        ...potentialCollaborator,
        ...newCollaborator,
      };

      return collaboratorsClone;
    });
  };

  /**
   * Saves the current collaborators and returns the updated collaborators
   * @returns {Promise<Collaborator[]>} Promise resolving to the updated list of collaborators
   */
  const saveCollaborators = useCallback(async (): Promise<Collaborator[]> => {
    const collaboratorsToSave: CollaboratorInput[] = currentCollaborators
      .filter((c) => !!c.collaboratorID && !!c.permission)
      .map((c) => ({ collaboratorID: c.collaboratorID, permission: c.permission }));

    try {
      const { data, errors } = await editSubmissionCollaborators({
        variables: {
          submissionID,
          collaborators: collaboratorsToSave,
        },
      });

      if (errors || !data?.editSubmissionCollaborators) {
        throw new Error("Failed to save collaborators.");
      }

      enqueueSnackbar("All collaborator changes have been saved successfully.");

      return data.editSubmissionCollaborators.collaborators;
    } catch (err) {
      Logger.error(`CollaboratorsContext: ${err.toString()}`);
      enqueueSnackbar("Unable to edit submission collaborators.", {
        variant: "error",
      });
      return [];
    }
  }, [currentCollaborators, editSubmissionCollaborators, enqueueSnackbar, submissionID]);

  const contextValue = useMemo(
    () => ({
      currentCollaborators,
      remainingPotentialCollaborators,
      maxCollaborators,
      handleAddCollaborator,
      handleRemoveCollaborator,
      handleUpdateCollaborator,
      saveCollaborators,
      resetCollaborators,
      loadPotentialCollaborators,
      loading: loading || editLoading,
      error,
    }),
    [
      currentCollaborators,
      remainingPotentialCollaborators,
      maxCollaborators,
      handleAddCollaborator,
      handleRemoveCollaborator,
      handleUpdateCollaborator,
      saveCollaborators,
      resetCollaborators,
      loadPotentialCollaborators,
      loading,
      editLoading,
      error,
    ]
  );

  return (
    <CollaboratorsContext.Provider value={contextValue}>{children}</CollaboratorsContext.Provider>
  );
};
